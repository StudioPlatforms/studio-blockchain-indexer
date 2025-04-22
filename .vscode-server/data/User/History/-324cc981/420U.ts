import { ethers } from 'ethers';
import axios from 'axios';
import { createLogger } from '../../utils/logger';
import { blockchainCore } from './core';
import { 
    ERC20_ABI, 
    ERC721_ABI, 
    ERC1155_ABI, 
    OWNABLE_ABI, 
    CONTRACT_CREATION_TOPIC 
} from './abis';
import { 
    TokenTransferData, 
    ContractData, 
    TokenBalance 
} from './types';

const logger = createLogger('blockchain:tokens');

class TokenService {
    async getTokenTransfersFromReceipt(receipt: ethers.providers.TransactionReceipt): Promise<TokenTransferData[]> {
        const transfers: TokenTransferData[] = [];

        try {
            // Check for ERC20 Transfer events
            const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
            const erc20TransferTopic = erc20Interface.getEventTopic('Transfer');

            // Check for ERC721 Transfer events
            const erc721Interface = new ethers.utils.Interface(ERC721_ABI);
            const erc721TransferTopic = erc721Interface.getEventTopic('Transfer');

            // Check for ERC1155 TransferSingle events
            const erc1155Interface = new ethers.utils.Interface(ERC1155_ABI);
            const erc1155SingleTransferTopic = erc1155Interface.getEventTopic('TransferSingle');
            const erc1155BatchTransferTopic = erc1155Interface.getEventTopic('TransferBatch');

            for (const log of receipt.logs) {
                try {
                    if (log.topics[0] === erc20TransferTopic && log.topics.length === 3) {
                        // ERC20 Transfer
                        const parsedLog = erc20Interface.parseLog(log);
                        transfers.push({
                            tokenAddress: log.address,
                            from: ethers.utils.getAddress('0x' + log.topics[1].substring(26)),
                            to: ethers.utils.getAddress('0x' + log.topics[2].substring(26)),
                            value: parsedLog.args.value.toString(),
                            tokenType: 'ERC20'
                        });
                    } else if (log.topics[0] === erc721TransferTopic && log.topics.length === 4) {
                        // ERC721 Transfer
                        const tokenId = ethers.BigNumber.from(log.topics[3]).toString();
                        transfers.push({
                            tokenAddress: log.address,
                            from: ethers.utils.getAddress('0x' + log.topics[1].substring(26)),
                            to: ethers.utils.getAddress('0x' + log.topics[2].substring(26)),
                            value: '1',
                            tokenType: 'ERC721',
                            tokenId
                        });
                    } else if (log.topics[0] === erc1155SingleTransferTopic) {
                        // ERC1155 TransferSingle
                        const parsedLog = erc1155Interface.parseLog(log);
                        transfers.push({
                            tokenAddress: log.address,
                            from: parsedLog.args.from,
                            to: parsedLog.args.to,
                            value: parsedLog.args.value.toString(),
                            tokenType: 'ERC1155',
                            tokenId: parsedLog.args.id.toString()
                        });
                    } else if (log.topics[0] === erc1155BatchTransferTopic) {
                        // ERC1155 TransferBatch
                        try {
                            const parsedLog = erc1155Interface.parseLog(log);
                            
                            // Skip if we don't have the expected arguments
                            if (!parsedLog.args || !parsedLog.args.from || !parsedLog.args.to) {
                                continue;
                            }
                            
                            // Extract ids and values safely
                            const extractArrayData = (data: any): any[] => {
                                if (!data) return [];
                                if (Array.isArray(data)) return data;
                                return [data]; // Convert single item to array
                            };
                            
                            const ids = extractArrayData(parsedLog.args.ids);
                            const values = extractArrayData(parsedLog.args.values);
                            
                            // Process each id/value pair if we have both arrays
                            const length = Math.min(ids.length, values.length);
                            for (let i = 0; i < length; i++) {
                                transfers.push({
                                    tokenAddress: log.address,
                                    from: parsedLog.args.from,
                                    to: parsedLog.args.to,
                                    value: String(values[i]),
                                    tokenType: 'ERC1155',
                                    tokenId: String(ids[i])
                                });
                            }
                        } catch (batchError) {
                            logger.error(`Error processing ERC1155 batch transfer in transaction ${receipt.transactionHash}:`, batchError);
                        }
                    }
                } catch (error) {
                    logger.error(`Error parsing log in transaction ${receipt.transactionHash}:`, error);
                    continue;
                }
            }
        } catch (error) {
            logger.error(`Error getting token transfers from receipt ${receipt.transactionHash}:`, error);
        }

        return transfers;
    }

    async getTokenType(tokenAddress: string): Promise<'ERC20' | 'ERC721' | 'ERC1155' | null> {
        try {
            // Check if it's a contract
            const isContract = await blockchainCore.isContract(tokenAddress);
            if (!isContract) {
                return null;
            }

            // Try ERC721 supportsInterface
            try {
                const erc721Interface = '0x80ac58cd'; // ERC721 interface id
                const erc1155Interface = '0xd9b67a26'; // ERC1155 interface id
                
                // Check for ERC165 support
                const supportsERC165 = await blockchainCore.callContractMethod(
                    tokenAddress,
                    ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
                    'supportsInterface',
                    ['0x01ffc9a7'] // ERC165 interface id
                );

                if (supportsERC165) {
                    // Check for ERC721 support
                    const supportsERC721 = await blockchainCore.callContractMethod(
                        tokenAddress,
                        ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
                        'supportsInterface',
                        [erc721Interface]
                    );

                    if (supportsERC721) {
                        return 'ERC721';
                    }

                    // Check for ERC1155 support
                    const supportsERC1155 = await blockchainCore.callContractMethod(
                        tokenAddress,
                        ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
                        'supportsInterface',
                        [erc1155Interface]
                    );

                    if (supportsERC1155) {
                        return 'ERC1155';
                    }
                }
            } catch (error) {
                // Ignore errors, continue with other checks
            }

            // Try ERC20 methods
            try {
                // Check for basic ERC20 methods
                const [name, symbol, decimals, totalSupply] = await Promise.all([
                    blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'name', []),
                    blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'symbol', []),
                    blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'decimals', []),
                    blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'totalSupply', [])
                ]);

                // If we got here without errors, it's likely an ERC20
                return 'ERC20';
            } catch (error) {
                // Not an ERC20
            }

            // Try ERC721 methods
            try {
                // Check for basic ERC721 methods
                const [name, symbol, tokenURI] = await Promise.all([
                    blockchainCore.callContractMethod(tokenAddress, ERC721_ABI, 'name', []),
                    blockchainCore.callContractMethod(tokenAddress, ERC721_ABI, 'symbol', []),
                    blockchainCore.callContractMethod(tokenAddress, ERC721_ABI, 'tokenURI', [0])
                ]);

                // If we got here without errors, it's likely an ERC721
                return 'ERC721';
            } catch (error) {
                // Not an ERC721
            }

            // Try ERC1155 methods
            try {
                // Check for basic ERC1155 methods
                const uri = await blockchainCore.callContractMethod(tokenAddress, ERC1155_ABI, 'uri', [0]);

                // If we got here without errors, it's likely an ERC1155
                return 'ERC1155';
            } catch (error) {
                // Not an ERC1155
            }

            return null;
        } catch (error) {
            logger.error(`Error determining token type for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenName(tokenAddress: string): Promise<string | null> {
        try {
            return await blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'name', []);
        } catch (error) {
            logger.error(`Error getting token name for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenSymbol(tokenAddress: string): Promise<string | null> {
        try {
            return await blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'symbol', []);
        } catch (error) {
            logger.error(`Error getting token symbol for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenDecimals(tokenAddress: string): Promise<number | null> {
        try {
            const decimals = await blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'decimals', []);
            return parseInt(decimals);
        } catch (error) {
            logger.error(`Error getting token decimals for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenTotalSupply(tokenAddress: string, tokenId?: string): Promise<ethers.BigNumber | null> {
        try {
            const tokenType = await this.getTokenType(tokenAddress);
            
            if (tokenType === 'ERC20') {
                return await blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'totalSupply', []);
            } else if (tokenType === 'ERC721') {
                return await blockchainCore.callContractMethod(tokenAddress, ERC721_ABI, 'totalSupply', []);
            } else if (tokenType === 'ERC1155' && tokenId) {
                return await blockchainCore.callContractMethod(tokenAddress, ERC1155_ABI, 'totalSupply', [tokenId]);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token total supply for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenURI(tokenAddress: string, tokenId: string): Promise<string | null> {
        try {
            const tokenType = await this.getTokenType(tokenAddress);
            
            if (tokenType === 'ERC721') {
                return await blockchainCore.callContractMethod(tokenAddress, ERC721_ABI, 'tokenURI', [tokenId]);
            } else if (tokenType === 'ERC1155') {
                return await blockchainCore.callContractMethod(tokenAddress, ERC1155_ABI, 'uri', [tokenId]);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token URI for ${tokenAddress} with ID ${tokenId}:`, error);
            return null;
        }
    }

    async getTokenMetadata(tokenAddress: string, tokenId: string): Promise<any | null> {
        try {
            const tokenURI = await this.getTokenURI(tokenAddress, tokenId);
            if (!tokenURI) {
                return null;
            }
            
            // Handle IPFS URIs
            let uri = tokenURI;
            if (uri.startsWith('ipfs://')) {
                uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
            
            // Fetch metadata
            const response = await axios.get(uri, { timeout: 5000 });
            return response.data;
        } catch (error) {
            logger.error(`Error getting token metadata for ${tokenAddress} with ID ${tokenId}:`, error);
            return null;
        }
    }

    async getTokenBalance(tokenAddress: string, ownerAddress: string, tokenId?: string): Promise<ethers.BigNumber | null> {
        try {
            const tokenType = await this.getTokenType(tokenAddress);
            
            if (tokenType === 'ERC20') {
                return await blockchainCore.callContractMethod(tokenAddress, ERC20_ABI, 'balanceOf', [ownerAddress]);
            } else if (tokenType === 'ERC721') {
                return await blockchainCore.callContractMethod(tokenAddress, ERC721_ABI, 'balanceOf', [ownerAddress]);
            } else if (tokenType === 'ERC1155' && tokenId) {
                return await blockchainCore.callContractMethod(tokenAddress, ERC1155_ABI, 'balanceOf', [ownerAddress, tokenId]);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token balance for ${tokenAddress} owned by ${ownerAddress}:`, error);
            return null;
        }
    }

    async getTokenHolders(tokenAddress: string): Promise<{ address: string, balance: string }[] | null> {
        try {
            // This is a complex operation that would require indexing all Transfer events
            // For now, we'll return null as this would be implemented in the indexer
            return null;
        } catch (error) {
            logger.error(`Error getting token holders for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getContractOwner(contractAddress: string): Promise<string | null> {
        try {
            // Try to call the owner() method from Ownable
            return await blockchainCore.callContractMethod(contractAddress, OWNABLE_ABI, 'owner', []);
        } catch (error) {
            logger.error(`Error getting contract owner for ${contractAddress}:`, error);
            return null;
        }
    }

    async detectNewContracts(fromBlock: number, toBlock: number): Promise<ContractData[]> {
        try {
            logger.info(`Detecting new contracts from block ${fromBlock} to ${toBlock}`);
            const contracts: ContractData[] = [];
            
            // Get all blocks in the range
            for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
                try {
                    const { block, transactions } = await blockchainCore.getBlockWithTransactions(blockNumber);
                    
                    // Check each transaction for contract creation
                    for (const tx of transactions) {
                        // Contract creation transactions have null 'to' address
                        if (tx.to === null) {
                            try {
                                const receipt = await blockchainCore.getTransactionReceipt(tx.hash);
                                if (receipt && receipt.contractAddress) {
                                    logger.info(`Detected new contract at ${receipt.contractAddress} in transaction ${tx.hash}`);
                                    
                                    // Get contract details
                                    const contractData: ContractData = {
                                        address: receipt.contractAddress,
                                        creatorAddress: tx.from,
                                        blockNumber: tx.blockNumber,
                                        timestamp: tx.timestamp,
                                        transactionHash: tx.hash,
                                        balance: (await blockchainCore.getBalance(receipt.contractAddress)).toString()
                                    };
                                    
                                    // Get contract type and details
                                    const contractType = await this.getTokenType(receipt.contractAddress);
                                    if (contractType) {
                                        contractData.contractType = contractType;
                                        contractData.name = await this.getTokenName(receipt.contractAddress) || undefined;
                                        contractData.symbol = await this.getTokenSymbol(receipt.contractAddress) || undefined;
                                        
                                        if (contractType === 'ERC20') {
                                            const decimals = await this.getTokenDecimals(receipt.contractAddress);
                                            if (decimals !== null) {
                                                contractData.decimals = decimals;
                                            }
                                            
                                            const totalSupply = await this.getTokenTotalSupply(receipt.contractAddress);
                                            if (totalSupply) {
                                                contractData.totalSupply = totalSupply.toString();
                                            }
                                        }
                                    } else {
                                        contractData.contractType = 'UNKNOWN';
                                    }
                                    
                                    // Get contract owner
                                    const owner = await this.getContractOwner(receipt.contractAddress);
                                    if (owner) {
                                        contractData.ownerAddress = owner;
                                    }
                                    
                                    // Get token balances
                                    const tokenBalances = await this.getAddressTokenBalances(receipt.contractAddress);
                                    if (tokenBalances && tokenBalances.length > 0) {
                                        contractData.tokenBalances = tokenBalances;
                                    }
                                    
                                    contracts.push(contractData);
                                }
                            } catch (error) {
                                logger.error(`Error processing contract creation transaction ${tx.hash}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`Error processing block ${blockNumber}:`, error);
                }
            }
            
            return contracts;
        } catch (error) {
            logger.error(`Error detecting new contracts from block ${fromBlock} to ${toBlock}:`, error);
            return [];
        }
    }

    async getAddressTokenBalances(address: string): Promise<TokenBalance[]> {
        try {
            // This would typically require indexing all token transfer events
            // For a real implementation, we would need to track all tokens in the system
            // For now, we'll return an empty array
            return [];
        } catch (error) {
            logger.error(`Error getting token balances for address ${address}:`, error);
            return [];
        }
    }
}

export const tokenService = new TokenService();
