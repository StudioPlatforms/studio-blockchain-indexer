import express from 'express';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';
import { blockchain } from '../blockchain';
import { formatResponse, handleError } from './utils';

const logger = createLogger('api:contracts');

/**
 * API service for contract-related endpoints
 */
export class ContractsApiService {
    private database: IDatabase;
    private indexer: any;
    private app: express.Application;

    constructor(database: IDatabase, indexer: any, port: number, app: express.Application) {
        this.database = database;
        this.indexer = indexer;
        this.app = app;

        this.setupRoutes();
    }

    private setupRoutes() {
        // Get contract details
        this.app.get('/contracts/:address', this.getContract.bind(this));

        // Get contracts by creator
        this.app.get('/address/:address/contracts', this.getContractsByCreator.bind(this));

        // Get token contracts
        this.app.get('/tokens', this.getTokenContracts.bind(this));

        // Get contract creation info
        this.app.get('/contracts/:address/creation', this.getContractCreationInfo.bind(this));

        // Get account balances (tokens and native)
        this.app.get('/account/:address/balances', this.getAccountBalances.bind(this));

        // Get address tokens
        this.app.get('/address/:address/tokens', this.getAddressTokens.bind(this));

        // NOTE: Removed duplicate token-transfers endpoint to avoid conflict with TokensApiService
        // The endpoint is already registered in TokensApiService

        // Get token information
        this.app.get('/tokens/:tokenAddress', this.getTokenInfo.bind(this));

        // Get token holders
        this.app.get('/tokens/:tokenAddress/holders', this.getTokenHolders.bind(this));

        // Contract verification endpoints
        this.app.post('/contracts/verify', this.verifyContract.bind(this));
        this.app.get('/contracts/:address/verified', this.isContractVerified.bind(this));
        this.app.get('/contracts/:address/abi', this.getContractABI.bind(this));
        this.app.get('/contracts/:address/source', this.getContractSource.bind(this));
        this.app.post('/contracts/:address/interact', this.interactWithContract.bind(this));
    }

    /**
     * Get contract details
     */
    private async getContract(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Get contract from database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                // If not in database, check if it's a contract on-chain
                const isContract = await blockchain.isContract(address);
                
                if (!isContract) {
                    return formatResponse(res, { error: 'Not a contract address' }, 404);
                }
                
                // Get contract creation info
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                if (!creationInfo) {
                    return formatResponse(res, { error: 'Contract creation info not found' }, 404);
                }
                
                // Get contract type and details
                const tokenType = await blockchain.getTokenType(address);
                const nameResult = tokenType ? await blockchain.getTokenName(address) : null;
                const symbolResult = tokenType ? await blockchain.getTokenSymbol(address) : null;
                let decimalsResult;
                let totalSupply;
                
                if (tokenType === 'ERC20') {
                    decimalsResult = await blockchain.getTokenDecimals(address);
                    totalSupply = await blockchain.getTokenTotalSupply(address);
                }
                
                // Convert null values to undefined
                const name = nameResult || undefined;
                const symbol = symbolResult || undefined;
                const decimals = decimalsResult || undefined;
                
                // Create contract data
                const contractData: import('../blockchain/types').ContractData = {
                    address,
                    creatorAddress: creationInfo.creator,
                    blockNumber: creationInfo.blockNumber,
                    timestamp: creationInfo.timestamp,
                    transactionHash: creationInfo.transactionHash,
                    contractType: (tokenType as 'ERC20' | 'ERC721' | 'ERC1155' | 'UNKNOWN') || 'UNKNOWN',
                    name,
                    symbol,
                    decimals,
                    totalSupply: totalSupply ? totalSupply.toString() : undefined
                };
                
                // Store contract in database
                await this.database.storeContract(contractData);
                
                return formatResponse(res, contractData);
            }
            
            return formatResponse(res, contract);
        } catch (error) {
            return handleError(res, error, 'Error getting contract');
        }
    }

    /**
     * Get contracts created by an address
     */
    private async getContractsByCreator(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const contracts = await this.database.getContractsByCreator(address, limit, offset);
            
            return formatResponse(res, contracts);
        } catch (error) {
            return handleError(res, error, 'Error getting contracts by creator');
        }
    }

    /**
     * Get token contracts
     */
    private async getTokenContracts(req: express.Request, res: express.Response) {
        try {
            const tokenType = req.query.type as 'ERC20' | 'ERC721' | 'ERC1155' | undefined;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const contracts = await this.database.getTokenContracts(tokenType, limit, offset);
            
            return formatResponse(res, contracts);
        } catch (error) {
            return handleError(res, error, 'Error getting token contracts');
        }
    }

    /**
     * Get contract creation info
     */
    private async getContractCreationInfo(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { error: 'Not a contract address' }, 404);
            }
            
            // Get contract creation info
            const creationInfo = await blockchain.getContractCreationInfo(address);
            
            if (!creationInfo) {
                return formatResponse(res, { error: 'Contract creation info not found' }, 404);
            }
            
            return formatResponse(res, creationInfo);
        } catch (error) {
            return handleError(res, error, 'Error getting contract creation info');
        }
    }

    /**
     * Get account balances (tokens and native)
     */
    private async getAccountBalances(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Get native balance
            const nativeBalance = await blockchain.getBalance(address);
            
            // Get token balances
            const tokenBalances = await this.database.getAddressTokenBalances(address);
            
            // Format token balances
            const formattedTokens = await Promise.all(
                tokenBalances.map(async (balance) => {
                    try {
                        const tokenAddress = balance.tokenAddress;
                        const tokenType = balance.tokenType;
                        
                        // Get token details
                        const name = await blockchain.getTokenName(tokenAddress);
                        const symbol = await blockchain.getTokenSymbol(tokenAddress);
                        let decimals = 18; // Default to 18 decimals
                        
                        if (tokenType === 'ERC20') {
                            const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                            if (tokenDecimals !== null) {
                                decimals = tokenDecimals;
                            }
                        }
                        
                        // Convert balance from wei to token units
                        const balanceValue = parseFloat(balance.balance) / Math.pow(10, decimals);
                        
                        return {
                            contractAddress: tokenAddress,
                            symbol: symbol || 'UNKNOWN',
                            name: name || 'Unknown Token',
                            balance: balanceValue,
                            decimals,
                            type: tokenType
                        };
                    } catch (error) {
                        logger.error(`Error formatting token balance for ${balance.tokenAddress}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out null values
            const tokens = formattedTokens.filter(token => token !== null);
            
            // Convert native balance from wei to ether
            const nativeValue = parseFloat(nativeBalance.toString()) / 1e18;
            
            return formatResponse(res, {
                native: nativeValue,
                tokens
            });
        } catch (error) {
            return handleError(res, error, 'Error getting account balances');
        }
    }

    /**
     * Get address tokens
     */
    private async getAddressTokens(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Get token balances
            const tokenBalances = await this.database.getAddressTokenBalances(address);
            
            // Format token balances
            const formattedTokens = await Promise.all(
                tokenBalances.map(async (balance) => {
                    try {
                        const tokenAddress = balance.tokenAddress;
                        const tokenType = balance.tokenType;
                        
                        // Get token details
                        const name = await blockchain.getTokenName(tokenAddress);
                        const symbol = await blockchain.getTokenSymbol(tokenAddress);
                        let decimals = 18; // Default to 18 decimals
                        
                        if (tokenType === 'ERC20') {
                            const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                            if (tokenDecimals !== null) {
                                decimals = tokenDecimals;
                            }
                        }
                        
                        // Convert balance from wei to token units
                        const balanceValue = parseFloat(balance.balance) / Math.pow(10, decimals);
                        
                        return {
                            contractAddress: tokenAddress,
                            symbol: symbol || 'UNKNOWN',
                            name: name || 'Unknown Token',
                            balance: balanceValue,
                            decimals,
                            type: tokenType
                        };
                    } catch (error) {
                        logger.error(`Error formatting token balance for ${balance.tokenAddress}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out null values
            const tokens = formattedTokens.filter(token => token !== null);
            
            return formatResponse(res, tokens);
        } catch (error) {
            return handleError(res, error, 'Error getting address tokens');
        }
    }

    /**
     * Get token transfers for an address
     * NOTE: This method is kept for reference but not registered as an endpoint
     * to avoid conflict with TokensApiService
     */
    private async getAddressTokenTransfers(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            // Get token transfers
            const transfers = await this.database.getAddressTokenTransfers(address, {
                limit,
                offset
            });
            
            // Format token transfers
            const formattedTransfers = await Promise.all(
                transfers.map(async (transfer) => {
                    try {
                        const tokenAddress = transfer.tokenAddress;
                        
                        // Get token details
                        const name = await blockchain.getTokenName(tokenAddress);
                        const symbol = await blockchain.getTokenSymbol(tokenAddress);
                        let decimals = 18; // Default to 18 decimals
                        
                        if (transfer.tokenType === 'ERC20') {
                            const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                            if (tokenDecimals !== null) {
                                decimals = tokenDecimals;
                            }
                        }
                        
                        return {
                            hash: transfer.transactionHash,
                            blockNumber: transfer.blockNumber,
                            timestamp: transfer.timestamp,
                            from: transfer.fromAddress,
                            to: transfer.toAddress,
                            tokenAddress,
                            tokenSymbol: symbol || 'UNKNOWN',
                            tokenName: name || 'Unknown Token',
                            value: transfer.value,
                            decimals
                        };
                    } catch (error) {
                        logger.error(`Error formatting token transfer for ${transfer.transactionHash}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out null values
            const result = formattedTransfers.filter(transfer => transfer !== null);
            
            return formatResponse(res, result);
        } catch (error) {
            return handleError(res, error, 'Error getting token transfers');
        }
    }

    /**
     * Get token information
     */
    private async getTokenInfo(req: express.Request, res: express.Response) {
        try {
            const tokenAddress = req.params.tokenAddress.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(tokenAddress);
            
            if (!isContract) {
                return formatResponse(res, { error: 'Not a contract address' }, 404);
            }
            
            // Get token type
            const tokenType = await blockchain.getTokenType(tokenAddress);
            
            if (!tokenType) {
                return formatResponse(res, { error: 'Not a token contract' }, 404);
            }
            
            // Get token details
            const name = await blockchain.getTokenName(tokenAddress);
            const symbol = await blockchain.getTokenSymbol(tokenAddress);
            let decimals;
            let totalSupply;
            
            if (tokenType === 'ERC20') {
                decimals = await blockchain.getTokenDecimals(tokenAddress);
                totalSupply = await blockchain.getTokenTotalSupply(tokenAddress);
            }
            
            // Get token stats from database
            const holderCount = 0; // This would require additional indexing
            const transferCount = 0; // This would require additional indexing
            
            return formatResponse(res, {
                address: tokenAddress,
                symbol: symbol || 'UNKNOWN',
                name: name || 'Unknown Token',
                decimals: decimals || 18,
                totalSupply: totalSupply ? totalSupply.toString() : '0',
                type: tokenType,
                holders: holderCount,
                transfers: transferCount
            });
        } catch (error) {
            return handleError(res, error, 'Error getting token info');
        }
    }

    /**
     * Get token holders
     */
    private async getTokenHolders(req: express.Request, res: express.Response) {
        try {
            const tokenAddress = req.params.tokenAddress.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(tokenAddress);
            
            if (!isContract) {
                return formatResponse(res, { error: 'Not a contract address' }, 404);
            }
            
            // Get token type
            const tokenType = await blockchain.getTokenType(tokenAddress);
            
            if (!tokenType) {
                return formatResponse(res, { error: 'Not a token contract' }, 404);
            }
            
            // This would require additional indexing to track all token holders
            // For now, return an empty array
            return formatResponse(res, []);
        } catch (error) {
            return handleError(res, error, 'Error getting token holders');
        }
    }

    /**
     * Verify a contract by submitting its source code
     */
    private async verifyContract(req: express.Request, res: express.Response) {
        try {
            const { address, sourceCode, compilerVersion, optimizationUsed, runs, constructorArguments, contractName, libraries, evmVersion } = req.body;
            
            if (!address || !sourceCode || !compilerVersion || !contractName) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Missing required parameters' 
                }, 400);
            }
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Not a contract address' 
                }, 404);
            }
            
            // Get the contract from the database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Contract not found in database' 
                }, 404);
            }
            
            // Get the contract bytecode from the blockchain
            const onChainBytecode = await blockchain.getCode(address);
            
            // Import the verification service
            const { verificationService } = await import('../verification');
            
            // Validate constructor arguments
            if (constructorArguments && !verificationService.validateConstructorArguments(constructorArguments)) {
                return formatResponse(res, {
                    success: false,
                    error: 'Invalid constructor arguments. Must be a valid hex string.'
                }, 400);
            }
            
            // Verify the contract
            const verificationResult = await verificationService.verifyContract(
                sourceCode,
                compilerVersion,
                contractName,
                onChainBytecode,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries,
                evmVersion
            );
            
            if (!verificationResult.success) {
                return formatResponse(res, {
                    success: false,
                    error: verificationResult.message
                }, 400);
            }
            
            // Extract metadata hash from bytecode
            const metadataHash = verificationService.extractMetadataHash(onChainBytecode);
            
            // Update the contract with verification data
            await this.database.updateContractVerification(
                address,
                true,
                sourceCode,
                verificationResult.abi,
                compilerVersion,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries,
                evmVersion
            );
            
            return formatResponse(res, {
                success: true,
                message: 'Contract verified successfully',
                address,
                abi: verificationResult.abi,
                metadata: verificationResult.metadata,
                metadataHash
            });
        } catch (error) {
            return handleError(res, error, 'Error verifying contract');
        }
    }

    /**
     * Check if a contract is verified
     */
    private async isContractVerified(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { 
                    verified: false,
                    error: 'Not a contract address' 
                });
            }
            
            // Get the contract verification data
            const verification = await this.database.getContractVerification(address);
            
            // Return whether the contract is verified and has ABI and source code
            const isVerified = verification && verification.verified && verification.abi && verification.sourceCode;
            
            return formatResponse(res, {
                verified: isVerified ? true : false
            });
        } catch (error) {
            return handleError(res, error, 'Error checking if contract is verified');
        }
    }

    /**
     * Get the ABI of a verified contract
     */
    private async getContractABI(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { error: 'Not a contract address' }, 404);
            }
            
            // Get the contract from the database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                return formatResponse(res, { error: 'Contract not found in database' }, 404);
            }
            
            // Get the contract verification data
            const verification = await this.database.getContractVerification(address);
            
            // If the contract is verified and has an ABI, return it
            if (verification && verification.verified && verification.abi) {
                return formatResponse(res, {
                    address,
                    abi: verification.abi
                });
            }
            
            // If the contract is not verified, return an error
            return formatResponse(res, { 
                success: false,
                error: 'Contract is not verified' 
            }, 404);
        } catch (error) {
            return handleError(res, error, 'Error getting contract ABI');
        }
    }

    /**
     * Get the source code of a verified contract
     */
    private async getContractSource(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { error: 'Not a contract address' }, 404);
            }
            
            // Get the contract from the database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                return formatResponse(res, { error: 'Contract not found in database' }, 404);
            }
            
            // Get the contract verification data
            const verification = await this.database.getContractVerification(address);
            
            // If the contract is verified and has source code, return it
            if (verification && verification.verified && verification.sourceCode) {
                return formatResponse(res, {
                    address,
                    sourceCode: verification.sourceCode
                });
            }
            
            // If the contract is not verified, return an error
            return formatResponse(res, { 
                success: false,
                error: 'Contract is not verified' 
            }, 404);
        } catch (error) {
            return handleError(res, error, 'Error getting contract source code');
        }
    }

    /**
     * Interact with a verified contract
     */
    private async interactWithContract(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            const { method, params, value } = req.body;
            
            if (!method) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Missing required parameters' 
                }, 400);
            }
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Not a contract address' 
                }, 404);
            }
            
            // Get the contract from the database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Contract not found in database' 
                }, 404);
            }
            
            // Get the contract verification data
            const verification = await this.database.getContractVerification(address);
            
            // Check if the contract is verified
            if (!verification || !verification.verified) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Contract is not verified' 
                }, 400);
            }
            
            // Check if the contract has an ABI
            if (!verification.abi) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Contract does not have an ABI' 
                }, 400);
            }
            
            try {
                // Import ethers
                const { ethers } = await import('ethers');
                
                // Create a contract instance using the ABI from the verification data
                const contractInstance = new ethers.Contract(
                    address,
                    verification.abi,
                    blockchain.getProvider()
                );
                
                // Check if the method exists in the ABI
                const methodAbi = verification.abi.find((item: any) => 
                    item.name === method && 
                    (item.type === 'function' || item.type === undefined)
                );
                
                if (!methodAbi) {
                    return formatResponse(res, { 
                        success: false,
                        error: `Method ${method} not found in contract ABI` 
                    }, 400);
                }
                
                // Determine if the method is a read or write operation
                const isReadOperation = methodAbi.constant || 
                                       methodAbi.stateMutability === 'view' || 
                                       methodAbi.stateMutability === 'pure';
                
                let result;
                
                if (isReadOperation) {
                    // Call the method (read operation)
                    result = await contractInstance[method](...(params || []));
                } else {
                    // For write operations, we would need a private key to sign the transaction
                    // Since we don't have that in this implementation, we'll return an error
                    return formatResponse(res, { 
                        success: false,
                        error: 'Write operations are not supported in this implementation' 
                    }, 400);
                }
                
                return formatResponse(res, {
                    success: true,
                    address,
                    method,
                    params: params || [],
                    result
                });
            } catch (error: any) {
                return formatResponse(res, { 
                    success: false,
                    error: `Error calling contract method: ${error.message}` 
                }, 400);
            }
        } catch (error) {
            return handleError(res, error, 'Error interacting with contract');
        }
    }
}
