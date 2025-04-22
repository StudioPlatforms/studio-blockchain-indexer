import { ethers } from 'ethers';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { BlockData, TransactionData, LogFilterOptions } from './types';

const logger = createLogger('blockchain:core');

class BlockchainCore {
    private provider: ethers.providers.JsonRpcProvider;
    private currentRpcIndex: number = 0;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(config.rpc.urls[0]);
        this.setupHealthCheck();
    }

    private setupHealthCheck() {
        // Check RPC health every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.provider.getBlockNumber();
            } catch (error) {
                logger.error('RPC health check failed, switching to next RPC URL', error);
                this.switchRpcProvider();
            }
        }, 30000);
    }

    private switchRpcProvider() {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % config.rpc.urls.length;
        const newRpcUrl = config.rpc.urls[this.currentRpcIndex];
        logger.info(`Switching to RPC URL: ${newRpcUrl}`);
        this.provider = new ethers.providers.JsonRpcProvider(newRpcUrl);
    }

    async getLatestBlockNumber(): Promise<number> {
        try {
            return await this.provider.getBlockNumber();
        } catch (error) {
            logger.error('Error getting latest block number:', error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getBlock(blockNumber: number): Promise<BlockData> {
        try {
            const block = await this.provider.getBlock(blockNumber);
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
            this.switchRpcProvider();
            throw error;
        }
    }

    async getBlockWithTransactions(blockNumber: number): Promise<{ block: BlockData, transactions: TransactionData[] }> {
        try {
            const block = await this.provider.getBlockWithTransactions(blockNumber);
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
                transactions: block.transactions.map(tx => tx.hash)
            };

            const transactions: TransactionData[] = block.transactions.map(tx => ({
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
            this.switchRpcProvider();
            throw error;
        }
    }

    async getTransaction(txHash: string): Promise<TransactionData> {
        try {
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) {
                throw new Error(`Transaction ${txHash} not found`);
            }

            const receipt = await this.provider.getTransactionReceipt(txHash);
            const block = await this.provider.getBlock(tx.blockNumber || 0);

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
            this.switchRpcProvider();
            throw error;
        }
    }

    async getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> {
        try {
            return await this.provider.getTransactionReceipt(txHash);
        } catch (error) {
            logger.error(`Error getting transaction receipt ${txHash}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getCode(address: string): Promise<string> {
        try {
            return await this.provider.getCode(address);
        } catch (error) {
            logger.error(`Error getting code for address ${address}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getBalance(address: string): Promise<ethers.BigNumber> {
        try {
            return await this.provider.getBalance(address);
        } catch (error) {
            logger.error(`Error getting balance for address ${address}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async isContract(address: string): Promise<boolean> {
        try {
            const code = await this.getCode(address);
            return code !== '0x';
        } catch (error) {
            logger.error(`Error checking if address ${address} is contract:`, error);
            this.switchRpcProvider();
            throw error;
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
            
            return await this.provider.getLogs(ethersFilter);
        } catch (error) {
            logger.error('Error getting logs:', error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getPendingTransactions(): Promise<TransactionData[]> {
        try {
            const pendingTxs = await this.provider.send('eth_pendingTransactions', []);
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
            this.switchRpcProvider();
            return [];
        }
    }

    async callContractMethod(
        contractAddress: string,
        abi: string[] | ethers.ContractInterface,
        methodName: string,
        args: any[]
    ): Promise<any> {
        try {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);
            return await contract[methodName](...args);
        } catch (error) {
            throw error;
        }
    }

    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    getProvider(): ethers.providers.JsonRpcProvider {
        return this.provider;
    }
}

export const blockchainCore = new BlockchainCore();
