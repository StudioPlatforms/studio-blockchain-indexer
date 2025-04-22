import { ethers } from 'ethers';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import axios from 'axios';

const logger = createLogger('blockchain');

export interface BlockData {
    number: number;
    hash: string;
    parentHash: string;
    timestamp: number;
    nonce: string;
    difficulty: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    gasUsed: ethers.BigNumber;
    miner: string;
    extraData: string;
    transactions: string[];
}

export interface TransactionData {
    hash: string;
    blockNumber: number;
    from: string;
    to: string | null;
    value: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    gasPrice: ethers.BigNumber;
    data: string;
    nonce: number;
    transactionIndex: number;
    status?: boolean;
    timestamp: number;
}

// Use the ethers.js Filter type directly
export type LogFilter = ethers.providers.Filter;

// ERC-20 and ERC-721 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ERC-165 interface ID for ERC-721
const ERC721_INTERFACE_ID = '0x80ac58cd';

// ERC-165 interface ID for ERC-1155
const ERC1155_INTERFACE_ID = '0xd9b67a26';

// ERC-165 supportsInterface function signature
const SUPPORTS_INTERFACE_SIGNATURE = '0x01ffc9a7';

class Blockchain {
    private providers: ethers.providers.JsonRpcProvider[];
    private currentProviderIndex: number = 0;
    private lastProviderSwitch: number = 0;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private readonly PROVIDER_RETRY_TIMEOUT = 30000; // 30 seconds before retrying a failed provider

    constructor() {
        // Initialize providers from all URLs
        this.providers = config.rpc.urls.map(url => new ethers.providers.JsonRpcProvider(url));
        logger.info(`Initialized ${this.providers.length} RPC providers`);
        
        // Start health check interval
        this.startHealthCheck();
    }

    private startHealthCheck() {
        // Check provider health every 60 seconds
        this.healthCheckInterval = setInterval(async () => {
            await this.checkProvidersHealth();
        }, 60000);
    }

    private async checkProvidersHealth() {
        logger.info('Checking RPC providers health...');
        for (let i = 0; i < this.providers.length; i++) {
            try {
                await this.providers[i].getBlockNumber();
                logger.info(`Provider ${config.rpc.urls[i]} is healthy`);
            } catch (error: any) {
                logger.warn(`Provider ${config.rpc.urls[i]} is unhealthy: ${error.message || 'Unknown error'}`);
            }
        }
    }

    /**
     * Execute a function with RPC provider failover
     * @param operation Function that takes a provider and returns a promise
     * @returns Result of the operation
     */
    private async executeWithFailover<T>(
        operation: (provider: ethers.providers.JsonRpcProvider) => Promise<T>
    ): Promise<T> {
        const startIndex = this.currentProviderIndex;
        let lastError: Error = new Error('Unknown error');

        // Try each provider in sequence, starting with the current one
        for (let attempt = 0; attempt < this.providers.length; attempt++) {
            const providerIndex = (startIndex + attempt) % this.providers.length;
            const provider = this.providers[providerIndex];
            const providerUrl = config.rpc.urls[providerIndex];

            try {
                const result = await operation(provider);
                
                // If this isn't the provider we started with, update the current provider
                if (providerIndex !== this.currentProviderIndex) {
                    logger.info(`Switched to RPC provider: ${providerUrl}`);
                    this.currentProviderIndex = providerIndex;
                    this.lastProviderSwitch = Date.now();
                }
                
                return result;
            } catch (error: any) {
                lastError = error instanceof Error ? error : new Error(error?.message || 'Unknown error');
                logger.warn(`RPC provider ${providerUrl} failed: ${lastError.message}`);
                
                // Continue to the next provider
                continue;
            }
        }

        // If we get here, all providers failed
        logger.error('All RPC providers failed');
        throw lastError;
    }

    async getLatestBlockNumber(): Promise<number> {
        try {
            return await this.executeWithFailover(provider => provider.getBlockNumber());
        } catch (error: any) {
            logger.error('Error getting latest block number:', error);
            throw error;
        }
    }

    async getBlock(blockNumber: number): Promise<BlockData> {
        try {
            const block = await this.executeWithFailover(provider => provider.getBlock(blockNumber));
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }

            return {
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                nonce: block.nonce || '0x',
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: block.gasLimit,
                gasUsed: block.gasUsed,
                miner: block.miner,
                extraData: block.extraData,
                transactions: block.transactions
            };
        } catch (error: any) {
            logger.error(`Error getting block ${blockNumber}:`, error);
            throw error;
        }
    }

    async getBlockWithTransactions(blockNumber: number): Promise<{
        block: BlockData;
        transactions: TransactionData[];
    }> {
        try {
            const block = await this.executeWithFailover(provider => 
                provider.getBlockWithTransactions(blockNumber)
            );
            
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }

            const transactions: TransactionData[] = await Promise.all(
                block.transactions.map(async (tx: ethers.providers.TransactionResponse) => {
                    const receipt = await this.getTransactionReceipt(tx.hash);
                    if (!receipt) {
                        throw new Error(`Receipt not found for transaction ${tx.hash}`);
                    }
                    
                    return {
                        hash: tx.hash,
                        blockNumber: tx.blockNumber || block.number,
                        from: tx.from,
                        to: tx.to || null,
                        value: tx.value,
                        gasLimit: tx.gasLimit,
                        gasPrice: tx.gasPrice || ethers.BigNumber.from(0),
                        data: tx.data,
                        nonce: tx.nonce,
                        transactionIndex: receipt.transactionIndex,
                        status: receipt.status === 1,
                        timestamp: block.timestamp
                    };
                })
            );

            const blockData: BlockData = {
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                nonce: block.nonce || '0x',
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: block.gasLimit,
                gasUsed: block.gasUsed,
                miner: block.miner,
                extraData: block.extraData,
                transactions: block.transactions.map(tx => tx.hash)
            };

            return { block: blockData, transactions };
        } catch (error: any) {
            logger.error(`Error getting block with transactions ${blockNumber}:`, error);
            throw error;
        }
    }

    async getTransaction(txHash: string): Promise<TransactionData> {
        try {
            const tx = await this.executeWithFailover(provider => provider.getTransaction(txHash));
            
            if (!tx) {
                throw new Error(`Transaction ${txHash} not found`);
            }
            
            const receipt = await this.getTransactionReceipt(txHash);
            if (!receipt) {
                throw new Error(`Receipt not found for transaction ${txHash}`);
            }
            
            const block = await this.getBlock(tx.blockNumber!);
            
            return {
                hash: tx.hash,
                blockNumber: tx.blockNumber!,
                from: tx.from,
                to: tx.to || null,
                value: tx.value,
                gasLimit: tx.gasLimit,
                gasPrice: tx.gasPrice || ethers.BigNumber.from(0),
                data: tx.data,
                nonce: tx.nonce,
                transactionIndex: receipt.transactionIndex,
                status: receipt.status === 1,
                timestamp: block.timestamp
            };
        } catch (error: any) {
            logger.error(`Error getting transaction ${txHash}:`, error);
            throw error;
        }
    }

    async getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> {
        try {
            return await this.executeWithFailover(provider => provider.getTransactionReceipt(txHash));
        } catch (error: any) {
            logger.error(`Error getting transaction receipt ${txHash}:`, error);
            throw error;
        }
    }

    async getLogs(filter: LogFilter): Promise<ethers.providers.Log[]> {
        try {
            return await this.executeWithFailover(provider => provider.getLogs(filter));
        } catch (error: any) {
            logger.error(`Error getting logs:`, error);
            throw error;
        }
    }

    async getPendingTransactions(): Promise<any[]> {
        try {
            // This requires a node that supports eth_pendingTransactions
            // or a custom RPC method depending on the node implementation
            return await this.executeWithFailover(provider => 
                provider.send('eth_pendingTransactions', [])
            );
        } catch (error: any) {
            logger.error(`Error getting pending transactions:`, error);
            throw error;
        }
    }

    async getCode(address: string): Promise<string> {
        try {
            return await this.executeWithFailover(provider => provider.getCode(address));
        } catch (error: any) {
            logger.error(`Error getting code for address ${address}:`, error);
            throw error;
        }
    }

    async getBalance(address: string): Promise<ethers.BigNumber> {
        try {
            return await this.executeWithFailover(provider => provider.getBalance(address));
        } catch (error: any) {
            logger.error(`Error getting balance for address ${address}:`, error);
            throw error;
        }
    }

    async isContract(address: string): Promise<boolean> {
        try {
            const code = await this.getCode(address);
            return code !== '0x';
        } catch (error: any) {
            logger.error(`Error checking if address ${address} is contract:`, error);
            throw error;
        }
    }

    async supportsInterface(address: string, interfaceId: string): Promise<boolean> {
        try {
            // Check if the contract implements ERC-165
            const data = SUPPORTS_INTERFACE_SIGNATURE + interfaceId.slice(2).padStart(64, '0');
            
            const result = await this.executeWithFailover(provider => 
                provider.call({
                    to: address,
                    data
                })
            );
            
            return result === '0x0000000000000000000000000000000000000000000000000000000000000001';
        } catch (error) {
            // If the call fails, the contract doesn't support ERC-165
            return false;
        }
    }

    async isERC721(address: string): Promise<boolean> {
        try {
            return await this.supportsInterface(address, ERC721_INTERFACE_ID);
        } catch (error) {
            return false;
        }
    }

    async isERC1155(address: string): Promise<boolean> {
        try {
            return await this.supportsInterface(address, ERC1155_INTERFACE_ID);
        } catch (error) {
            return false;
        }
    }

    async getTokenType(address: string): Promise<'ERC20' | 'ERC721' | 'ERC1155' | null> {
        try {
            // First check if it's an ERC-721 or ERC-1155
            if (await this.isERC721(address)) {
                return 'ERC721';
            }
            
            if (await this.isERC1155(address)) {
                return 'ERC1155';
            }
            
            // If it's not an ERC-721 or ERC-1155, check if it's a contract
            const isContract = await this.isContract(address);
            if (isContract) {
                // Assume it's an ERC-20 if it's a contract but not an ERC-721 or ERC-1155
                return 'ERC20';
            }
            
            return null;
        } catch (error) {
            logger.error(`Error determining token type for address ${address}:`, error);
            return null;
        }
    }

    async getTokenURI(tokenAddress: string, tokenId: string): Promise<string | null> {
        try {
            // Check if it's an ERC-721
            if (await this.isERC721(tokenAddress)) {
                // Call tokenURI(uint256) function
                const data = '0xc87b56dd' + ethers.utils.defaultAbiCoder.encode(['uint256'], [tokenId]).slice(2);
                
                const result = await this.executeWithFailover(provider => 
                    provider.call({
                        to: tokenAddress,
                        data
                    })
                );
                
                // Decode the result (string)
                const decoded = ethers.utils.defaultAbiCoder.decode(['string'], result);
                return decoded[0];
            }
            
            // Check if it's an ERC-1155
            if (await this.isERC1155(tokenAddress)) {
                // Call uri(uint256) function
                const data = '0x0e89341c' + ethers.utils.defaultAbiCoder.encode(['uint256'], [tokenId]).slice(2);
                
                const result = await this.executeWithFailover(provider => 
                    provider.call({
                        to: tokenAddress,
                        data
                    })
                );
                
                // Decode the result (string)
                const decoded = ethers.utils.defaultAbiCoder.decode(['string'], result);
                return decoded[0];
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token URI for token ${tokenAddress} with ID ${tokenId}:`, error);
            return null;
        }
    }

    async getTokenMetadata(tokenAddress: string, tokenId: string): Promise<any | null> {
        try {
            const uri = await this.getTokenURI(tokenAddress, tokenId);
            if (!uri) {
                return null;
            }
            
            // Handle IPFS URIs
            let url = uri;
            if (url.startsWith('ipfs://')) {
                url = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
            
            // Replace token ID placeholder if present
            url = url.replace('{id}', tokenId);
            
            // Fetch metadata
            const response = await axios.get(url, { timeout: 5000 });
            return response.data;
        } catch (error) {
            logger.error(`Error getting token metadata for token ${tokenAddress} with ID ${tokenId}:`, error);
            return null;
        }
    }

    async getTokenName(tokenAddress: string): Promise<string | null> {
        try {
            // Call name() function
            const data = '0x06fdde03';
            
            const result = await this.executeWithFailover(provider => 
                provider.call({
                    to: tokenAddress,
                    data
                })
            );
            
            // Decode the result (string)
            const decoded = ethers.utils.defaultAbiCoder.decode(['string'], result);
            return decoded[0];
        } catch (error) {
            logger.error(`Error getting token name for token ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenSymbol(tokenAddress: string): Promise<string | null> {
        try {
            // Call symbol() function
            const data = '0x95d89b41';
            
            const result = await this.executeWithFailover(provider => 
                provider.call({
                    to: tokenAddress,
                    data
                })
            );
            
            // Decode the result (string)
            const decoded = ethers.utils.defaultAbiCoder.decode(['string'], result);
            return decoded[0];
        } catch (error) {
            logger.error(`Error getting token symbol for token ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenTotalSupply(tokenAddress: string): Promise<ethers.BigNumber | null> {
        try {
            // Call totalSupply() function
            const data = '0x18160ddd';
            
            const result = await this.executeWithFailover(provider => 
                provider.call({
                    to: tokenAddress,
                    data
                })
            );
            
            // Decode the result (uint256)
            const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], result);
            return decoded[0];
        } catch (error) {
            logger.error(`Error getting token total supply for token ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenTransfersFromReceipt(receipt: ethers.providers.TransactionReceipt): Promise<{
        tokenAddress: string;
        from: string;
        to: string;
        tokenId?: string;
        value: string;
        tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
    }[]> {
        const transfers: {
            tokenAddress: string;
            from: string;
            to: string;
            tokenId?: string;
            value: string;
            tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
        }[] = [];
        
        // Filter logs for Transfer events
        const transferLogs = receipt.logs.filter(log => 
            log.topics[0] === TRANSFER_EVENT_SIGNATURE
        );
        
        for (const log of transferLogs) {
            const tokenAddress = log.address;
            
            // Determine token type
            let tokenType = await this.getTokenType(tokenAddress);
            if (!tokenType) {
                // Skip if we can't determine the token type
                continue;
            }
            
            // Parse the event based on token type
            if (tokenType === 'ERC721' || tokenType === 'ERC1155') {
                // ERC-721 and ERC-1155 Transfer events have the same signature
                // topics[1] = from address
                // topics[2] = to address
                // topics[3] = token ID
                const from = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[1])[0];
                const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
                const tokenId = ethers.utils.defaultAbiCoder.decode(['uint256'], log.topics[3])[0].toString();
                
                transfers.push({
                    tokenAddress,
                    from,
                    to,
                    tokenId,
                    value: '1', // ERC-721 transfers always have a value of 1
                    tokenType
                });
            } else if (tokenType === 'ERC20') {
                // ERC-20 Transfer events
                // topics[1] = from address
                // topics[2] = to address
                // data = value
                const from = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[1])[0];
                const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
                const value = ethers.utils.defaultAbiCoder.decode(['uint256'], log.data)[0].toString();
                
                transfers.push({
                    tokenAddress,
                    from,
                    to,
                    value,
                    tokenType
                });
            }
        }
        
        return transfers;
    }

    // Clean up resources when shutting down
    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
}

export const blockchain = new Blockchain();
