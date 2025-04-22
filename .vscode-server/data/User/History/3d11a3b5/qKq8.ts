import { blockchain } from './blockchain';
import { db } from './database';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('indexer');

class Indexer {
    private _isRunning: boolean = false;
    private _latestProcessedBlock: number = 0;

    // Public getters for private properties
    get isRunning(): boolean {
        return this._isRunning;
    }

    get latestProcessedBlock(): number {
        return this._latestProcessedBlock;
    }

    async start() {
        if (this._isRunning) {
            return;
        }

        this._isRunning = true;
        logger.info('Starting indexer...');

        try {
            // Get the latest block from the chain
            const latestBlockNumber = await blockchain.getLatestBlockNumber();
            
            // Get the latest block we've processed
            this._latestProcessedBlock = await db.getLatestBlock();
            
            // If we're starting fresh, use the configured start block
            if (this._latestProcessedBlock === 0) {
                this._latestProcessedBlock = config.indexer.startBlock;
            }

            // Start processing blocks
            this.processBlocks();
        } catch (error) {
            logger.error('Error starting indexer:', error);
            this._isRunning = false;
        }
    }

    private async processBlocks() {
        while (this._isRunning) {
            try {
                // Get the latest block number from the chain
                const latestBlockNumber = await blockchain.getLatestBlockNumber();

                // Don't process if we're caught up
                if (this._latestProcessedBlock >= latestBlockNumber - config.indexer.confirmations) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }

                // Process the next block
                const nextBlock = this._latestProcessedBlock + 1;
                logger.info(`Processing block ${nextBlock}`);

                const { block, transactions } = await blockchain.getBlockWithTransactions(nextBlock);
                
                // Store the block
                await db.insertBlock(block);

                // Store each transaction
                for (const tx of transactions) {
                    try {
                        await db.insertTransaction(tx);
                        logger.info(`Processed transaction ${tx.hash} in block ${block.number}`);
                    } catch (error) {
                        logger.error(`Error processing transaction ${tx.hash}:`, error);
                    }
                }

                this._latestProcessedBlock = nextBlock;
                
                // Log progress every 10 blocks
                if (nextBlock % 10 === 0) {
                    logger.info(`Processed up to block ${nextBlock}, chain head is at ${latestBlockNumber}`);
                }

            } catch (error) {
                logger.error('Error processing blocks:', error);
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    stop() {
        this._isRunning = false;
        logger.info('Stopping indexer...');
    }
}

export const indexer = new Indexer();
