import { ethers } from 'ethers';
import { config } from '../config';
import { createLogger } from '../utils/logger';

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

    // Clean up resources when shutting down
    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
}

export const blockchain = new Blockchain();
