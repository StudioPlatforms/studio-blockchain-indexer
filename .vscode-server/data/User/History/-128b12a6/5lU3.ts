import { ethers } from 'ethers';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { BlockData, TransactionData, LogFilterOptions } from './types';

const logger = createLogger('blockchain:core');

class BlockchainCore {
    private providers: Map<string, ethers.providers.JsonRpcProvider> = new Map();
    private providerHealthStatus: Map<string, boolean> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private primaryProvider: ethers.providers.JsonRpcProvider;

    constructor() {
        // Initialize providers for all RPC URLs
        for (const url of config.rpc.urls) {
            const provider = new ethers.providers.JsonRpcProvider(url);
            this.providers.set(url, provider);
            this.providerHealthStatus.set(url, true); // Assume all are healthy initially
        }
        
        // Set the primary provider (for backward compatibility)
        this.primaryProvider = this.providers.get(config.rpc.urls[0])!;
        
        this.setupHealthCheck();
        logger.info(`Initialized with ${config.rpc.urls.length} RPC providers`);
    }

    private setupHealthCheck() {
        // Check health of all providers every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            for (const [url, provider] of this.providers.entries()) {
                try {
                    await provider.getBlockNumber();
                    if (!this.providerHealthStatus.get(url)) {
                        logger.info(`RPC URL ${url} is now healthy`);
                    }
                    this.providerHealthStatus.set(url, true);
                } catch (error) {
                    if (this.providerHealthStatus.get(url)) {
                        logger.error(`RPC URL ${url} health check failed:`, error);
                    }
                    this.providerHealthStatus.set(url, false);
                }
            }
        }, 30000);
    }

    /**
     * Execute a function against multiple providers simultaneously and return the first successful result
     * @param fn Function that takes a provider and returns a promise
     * @returns Promise with the result from the first successful provider
     */
    private async executeWithRedundancy<T>(fn: (provider: ethers.providers.JsonRpcProvider) => Promise<T>): Promise<T> {
        // Create a list of providers to try, prioritizing healthy ones
        const urlsToTry = [...this.providers.keys()].sort((a, b) => {
            const aHealthy = this.providerHealthStatus.get(a) ? 1 : 0;
            const bHealthy = this.providerHealthStatus.get(b) ? 1 : 0;
            return bHealthy - aHealthy; // Healthy providers first
        });
        
        // Try all providers simultaneously
        const errors: Error[] = [];
        
        // Create a promise for each provider
        const promises = urlsToTry.map(async (url) => {
            const provider = this.providers.get(url)!;
            try {
                const result = await fn(provider);
                logger.debug(`Successfully executed request using RPC URL: ${url}`);
                return { result, url };
            } catch (error) {
                errors.push(error as Error);
                this.providerHealthStatus.set(url, false);
                logger.error(`Error executing request with RPC URL ${url}:`, error);
                throw error; // Rethrow so Promise.race can move to the next provider
            }
        });
        
        // Use Promise.race with a manual implementation of "any" functionality
        return new Promise<T>((resolve, reject) => {
            let pending = promises.length;
            
            // If all promises fail, reject with a combined error
            const onError = (err: Error) => {
                pending--;
                if (pending === 0) {
                    reject(new Error(`All RPC providers failed: ${errors.map(e => e.message).join(', ')}`));
                }
            };
            
            // For each promise, handle success or failure
            promises.forEach(promise => {
                promise.then(({ result }) => {
                    resolve(result);
                }).catch(onError);
            });
        });
    }

    async getLatestBlockNumber(): Promise<number> {
        try {
            return await this.executeWithRedundancy(provider => provider.getBlockNumber());
        } catch (error) {
            logger.error('Error getting latest block number:', error);
            throw error;
        }
    }

    async getBlock(blockNumber: number): Promise<BlockData> {
        try {
            const block = await this.executeWithRedundancy(provider => provider.getBlock(blockNumber));
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }
            return {
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                nonce: block.nonce || '0x0',
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: ethers.BigNumber.from(block.gasLimit),
                gasUsed: ethers.BigNumber.from(block.gasUsed),
                miner: block.miner,
                extraData: block.extraData,
                transactions: block.transactions
            };
        } catch (error) {
            logger.error(`Error getting block ${blockNumber}:`, error);
            throw error;
        }
    }

    async getBlockWithTransactions(blockNumber: number): Promise<{ block: BlockData, transactions: TransactionData[] }> {
        try {
            const block = await this.executeWithRedundancy(provider => provider.getBlockWithTransactions(blockNumber));
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }

            const blockData: BlockData = {
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                nonce: block.nonce || '0x0',
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: ethers.BigNumber.from(block.gasLimit),
                gasUsed: ethers.BigNumber.from(block.gasUsed),
                miner: block.miner,
                extraData: block.extraData,
                transactions: block.transactions.map((tx: ethers.providers.TransactionResponse) => tx.hash)
            };

            const transactions: TransactionData[] = block.transactions.map((tx: ethers.providers.TransactionResponse) => ({
                hash: tx.hash,
                blockNumber: tx.blockNumber || block.number,
                from: tx.from,
                to: tx.to || null,
                value: tx.value,
                gasPrice: tx.gasPrice || ethers.BigNumber.from(0),
                gasLimit: tx.gasLimit,
                data: tx.data,
                nonce: tx.nonce,
                transactionIndex: tx.confirmations ? tx.confirmations - 1 : 0, // Use confirmations as a fallback
                timestamp: block.timestamp
            }));

            return { block: blockData, transactions };
        } catch (error) {
            logger.error(`Error getting block with transactions ${blockNumber}:`, error);
            throw error;
        }
    }

    async getTransaction(txHash: string): Promise<TransactionData> {
        try {
            const tx = await this.executeWithRedundancy(provider => provider.getTransaction(txHash));
            if (!tx) {
                throw new Error(`Transaction ${txHash} not found`);
            }

            const receipt = await this.executeWithRedundancy(provider => provider.getTransactionReceipt(txHash));
            const block = await this.executeWithRedundancy(provider => provider.getBlock(tx.blockNumber || 0));

            return {
                hash: tx.hash,
                blockNumber: tx.blockNumber || 0,
                from: tx.from,
                to: tx.to || null,
                value: tx.value,
                gasPrice: tx.gasPrice || ethers.BigNumber.from(0),
                gasLimit: tx.gasLimit,
                data: tx.data,
                nonce: tx.nonce,
                transactionIndex: receipt ? receipt.transactionIndex : 0,
                status: receipt ? receipt.status === 1 : undefined,
                timestamp: block ? block.timestamp : 0
            };
        } catch (error) {
            logger.error(`Error getting transaction ${txHash}:`, error);
            throw error;
        }
    }

    async getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> {
        try {
            return await this.executeWithRedundancy(provider => provider.getTransactionReceipt(txHash));
        } catch (error) {
            logger.error(`Error getting transaction receipt ${txHash}:`, error);
            throw error;
        }
    }

    async getCode(address: string): Promise<string> {
        try {
            return await this.executeWithRedundancy(provider => provider.getCode(address));
        } catch (error) {
            logger.error(`Error getting code for address ${address}:`, error);
            throw error;
        }
    }

    async getBalance(address: string): Promise<ethers.BigNumber> {
        try {
            return await this.executeWithRedundancy(provider => provider.getBalance(address));
        } catch (error) {
            logger.error(`Error getting balance for address ${address}:`, error);
            throw error;
        }
    }

    async isContract(address: string): Promise<boolean> {
        try {
            const code = await this.getCode(address);
            return code !== '0x';
        } catch (error) {
            logger.error(`Error checking if address ${address} is contract:`, error);
            throw error;
        }
    }

    async getContractCreationInfo(address: string): Promise<import('./types').ContractCreationInfo | null> {
        try {
            // First, check if the address is a contract
            const isContract = await this.isContract(address);
            if (!isContract) {
                return null;
            }

            // Get the transaction history for the address
            // This is a simplified approach - in a production environment,
            // you would use a more efficient method like querying an indexer
            // or using a specialized API
            
            // For now, we'll use a simple approach to find the contract creation transaction
            // by looking for the first transaction to the address with empty input data
            
            // Get the latest block number
            const latestBlock = await this.getLatestBlockNumber();
            
            // Start from a reasonable block range (e.g., last 10000 blocks)
            // In a production environment, you would use a more efficient method
            const startBlock = Math.max(0, latestBlock - 10000);
            
            // Create a filter to find transactions to the contract address
            const filter = {
                fromBlock: startBlock,
                toBlock: 'latest',
                address: address
            };
            
            // Get logs for the contract address
            const logs = await this.getLogs(filter);
            
            if (logs.length === 0) {
                return null;
            }
            
            // Sort logs by block number (ascending)
            logs.sort((a, b) => a.blockNumber - b.blockNumber);
            
            // Get the first log's transaction
            const firstLog = logs[0];
            const tx = await this.getTransaction(firstLog.transactionHash);
            
            // Get the block for timestamp
            const block = await this.getBlock(firstLog.blockNumber);
            
            return {
                creator: tx.from,
                transactionHash: tx.hash,
                blockNumber: tx.blockNumber,
                timestamp: block.timestamp
            };
        } catch (error) {
            logger.error(`Error getting contract creation info for ${address}:`, error);
            return null;
        }
    }

    async getLogs(filter: LogFilterOptions): Promise<ethers.providers.Log[]> {
        try {
            // Convert our LogFilterOptions to the format expected by ethers
            const ethersFilter: ethers.providers.Filter = {
                fromBlock: filter.fromBlock,
                toBlock: filter.toBlock,
                topics: filter.topics
            };
            
            // Handle address separately since ethers expects a different type
            if (filter.address) {
                if (Array.isArray(filter.address)) {
                    // If it's an array, we need to handle it differently
                    // For simplicity, we'll just use the first address
                    // In a real implementation, you might want to make multiple requests
                    ethersFilter.address = filter.address[0];
                } else {
                    ethersFilter.address = filter.address;
                }
            }
            
            return await this.executeWithRedundancy(provider => provider.getLogs(ethersFilter));
        } catch (error) {
            logger.error('Error getting logs:', error);
            throw error;
        }
    }

    async getPendingTransactions(): Promise<TransactionData[]> {
        try {
            const pendingTxs = await this.executeWithRedundancy(provider => 
                provider.send('eth_pendingTransactions', [])
            );
            
            return pendingTxs.map((tx: any) => ({
                hash: tx.hash,
                blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 0,
                from: tx.from,
                to: tx.to || null,
                value: ethers.BigNumber.from(tx.value),
                gasPrice: ethers.BigNumber.from(tx.gasPrice),
                gasLimit: ethers.BigNumber.from(tx.gas),
                data: tx.input,
                nonce: parseInt(tx.nonce, 16),
                transactionIndex: 0,
                timestamp: Math.floor(Date.now() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting pending transactions:', error);
            return [];
        }
    }

    async callContractMethod(
        contractAddress: string,
        abi: string[] | ethers.ContractInterface,
        methodName: string,
        args: any[]
    ): Promise<any> {
        return this.executeWithRedundancy(provider => {
            const contract = new ethers.Contract(contractAddress, abi, provider);
            return contract[methodName](...args);
        });
    }

    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    getProvider(): ethers.providers.JsonRpcProvider {
        return this.primaryProvider;
    }
}

export const blockchainCore = new BlockchainCore();
