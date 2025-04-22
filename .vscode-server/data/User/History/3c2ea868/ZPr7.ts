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

        // Get token transfers for an address
        this.app.get('/address/:address/token-transfers', this.getAddressTokenTransfers.bind(this));

        // Get token information
        this.app.get('/tokens/:tokenAddress', this.getTokenInfo.bind(this));

        // Get token holders
        this.app.get('/tokens/:tokenAddress/holders', this.getTokenHolders.bind(this));
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
                const name = tokenType ? await blockchain.getTokenName(address) : undefined;
                const symbol = tokenType ? await blockchain.getTokenSymbol(address) : undefined;
                let decimals;
                let totalSupply;
                
                if (tokenType === 'ERC20') {
                    decimals = await blockchain.getTokenDecimals(address);
                    totalSupply = await blockchain.getTokenTotalSupply(address);
                }
                
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
}
