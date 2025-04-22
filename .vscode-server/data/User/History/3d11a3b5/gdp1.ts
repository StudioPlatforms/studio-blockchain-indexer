import { blockchain } from './blockchain';
import { db } from './database/index';
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

                // Store each transaction and process token transfers
                for (const tx of transactions) {
                    try {
                        await db.insertTransaction(tx);
                        
                        // Process token transfers
                        await this.processTokenTransfers(tx.hash, tx.blockNumber, block.timestamp);
                        
                        logger.info(`Processed transaction ${tx.hash} in block ${block.number}`);
                    } catch (error) {
                        logger.error(`Error processing transaction ${tx.hash}:`, error);
                    }
                }
                
                // Process new contracts in this block
                await this.processNewContracts(nextBlock, nextBlock);

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

    private async processTokenTransfers(txHash: string, blockNumber: number, timestamp: number) {
        try {
            // Get the transaction receipt
            const receipt = await blockchain.getTransactionReceipt(txHash);
            if (!receipt) {
                logger.warn(`Receipt not found for transaction ${txHash}`);
                return;
            }
            
            // Get token transfers from the receipt
            const transfers = await blockchain.getTokenTransfersFromReceipt(receipt);
            
            // Store each token transfer
            for (const transfer of transfers) {
                try {
                    await db.insertTokenTransfer({
                        transactionHash: txHash,
                        blockNumber,
                        tokenAddress: transfer.tokenAddress,
                        fromAddress: transfer.from,
                        toAddress: transfer.to,
                        value: transfer.value,
                        tokenType: transfer.tokenType,
                        tokenId: transfer.tokenId,
                        timestamp
                    });
                    
                    // If this is an NFT transfer, update the NFT metadata
                    if ((transfer.tokenType === 'ERC721' || transfer.tokenType === 'ERC1155') && transfer.tokenId) {
                        await this.processNFTMetadata(transfer.tokenAddress, transfer.tokenId);
                    }
                    
                    // If this is a new token, update the token collection info
                    await this.processTokenCollection(transfer.tokenAddress);
                    
                    logger.info(`Processed ${transfer.tokenType} transfer in transaction ${txHash}`);
                } catch (error) {
                    logger.error(`Error processing token transfer in transaction ${txHash}:`, error);
                }
            }
        } catch (error) {
            logger.error(`Error processing token transfers for transaction ${txHash}:`, error);
        }
    }

    private async processNFTMetadata(tokenAddress: string, tokenId: string) {
        try {
            // Check if we already have metadata for this token
            const existingMetadata = await db.getNFTMetadata(tokenAddress, tokenId);
            if (existingMetadata) {
                // We already have metadata for this token
                return;
            }
            
            // Get the token URI
            const tokenURI = await blockchain.getTokenURI(tokenAddress, tokenId);
            if (!tokenURI) {
                logger.warn(`Token URI not found for token ${tokenAddress} with ID ${tokenId}`);
                return;
            }
            
            // Get the token metadata
            const metadata = await blockchain.getTokenMetadata(tokenAddress, tokenId);
            if (!metadata) {
                logger.warn(`Metadata not found for token ${tokenAddress} with ID ${tokenId}`);
                return;
            }
            
            // Store the metadata
            await db.updateNFTMetadata(tokenAddress, tokenId, metadata);
            
            logger.info(`Processed metadata for token ${tokenAddress} with ID ${tokenId}`);
        } catch (error) {
            logger.error(`Error processing NFT metadata for token ${tokenAddress} with ID ${tokenId}:`, error);
        }
    }

    private async processTokenCollection(tokenAddress: string) {
        try {
            // Check if we already have collection info for this token
            const existingCollection = await db.getNFTCollection(tokenAddress);
            if (existingCollection) {
                // We already have collection info for this token
                return;
            }
            
            // Get the token type
            const tokenType = await blockchain.getTokenType(tokenAddress);
            if (!tokenType || tokenType === 'ERC20') {
                // We only care about NFT collections
                return;
            }
            
            // Get the token name and symbol
            const name = await blockchain.getTokenName(tokenAddress);
            const symbol = await blockchain.getTokenSymbol(tokenAddress);
            
            // Get the token total supply
            const totalSupply = await blockchain.getTokenTotalSupply(tokenAddress);
            
            // Store the collection info
            await db.updateNFTCollection(
                tokenAddress,
                name || 'Unknown',
                symbol || 'UNKNOWN',
                totalSupply ? totalSupply.toNumber() : undefined
            );
            
            logger.info(`Processed collection info for token ${tokenAddress}`);
        } catch (error) {
            logger.error(`Error processing token collection for token ${tokenAddress}:`, error);
        }
    }

    stop() {
        this._isRunning = false;
        logger.info('Stopping indexer...');
    }
}

export const indexer = new Indexer();
