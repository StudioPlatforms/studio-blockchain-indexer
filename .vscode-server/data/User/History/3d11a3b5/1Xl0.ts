import { blockchain } from './blockchain';
import { db } from './database/index';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('indexer');

class Indexer {
    private _isRunning: boolean = false;
    private _latestProcessedBlock: number = 0;
    private _addressesToUpdate: Set<string> = new Set<string>();
    private _lastBalanceUpdateTime: number = 0;
    private _balanceUpdateInterval: number = 60 * 1000; // Update balances every 60 seconds

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
                    
                    // Add addresses involved in token transfers to the update queue
                    if (transfer.tokenType === 'ERC20') {
                        if (transfer.from !== '0x0000000000000000000000000000000000000000') {
                            this._addressesToUpdate.add(transfer.from.toLowerCase());
                        }
                        if (transfer.to !== '0x0000000000000000000000000000000000000000') {
                            this._addressesToUpdate.add(transfer.to.toLowerCase());
                        }
                    }
                    
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
            
            // Check if it's time to update token balances
            await this.checkAndUpdateTokenBalances();
        } catch (error) {
            logger.error(`Error processing token transfers for transaction ${txHash}:`, error);
        }
    }
    
    /**
     * Check if it's time to update token balances and update them if needed
     */
    private async checkAndUpdateTokenBalances() {
        const now = Date.now();
        
        // Only update balances if enough time has passed since the last update
        if (now - this._lastBalanceUpdateTime < this._balanceUpdateInterval) {
            return;
        }
        
        // Update token balances for addresses that have had recent activity
        if (this._addressesToUpdate.size > 0) {
            logger.info(`Updating token balances for ${this._addressesToUpdate.size} addresses`);
            
            // Get known token addresses
            const knownTokenAddresses = await blockchain.getKnownTokenAddresses();
            
            // Process addresses in batches to avoid overloading the blockchain provider
            const batchSize = 5;
            const addresses = Array.from(this._addressesToUpdate);
            
            for (let i = 0; i < addresses.length; i += batchSize) {
                const batch = addresses.slice(i, i + batchSize);
                
                // Process each address in the batch
                await Promise.all(batch.map(async (address) => {
                    try {
                        // Get token balances directly from the blockchain
                        const balances = await blockchain.getAddressTokenBalances(address, knownTokenAddresses);
                        
                        // Update the database with the latest balances
                        for (const balance of balances) {
                            try {
                                // Insert a token transfer to trigger the balance update
                                await db.insertTokenTransfer({
                                    transactionHash: `0x${Date.now().toString(16)}_${Math.random().toString(16).substring(2)}`,
                                    blockNumber: this._latestProcessedBlock,
                                    tokenAddress: balance.tokenAddress,
                                    fromAddress: '0x0000000000000000000000000000000000000000', // Zero address as placeholder
                                    toAddress: address,
                                    value: balance.balance,
                                    tokenType: balance.tokenType,
                                    timestamp: Math.floor(Date.now() / 1000)
                                });
                                
                                logger.info(`Updated token balance for ${address} and token ${balance.tokenAddress}: ${balance.balance}`);
                            } catch (error) {
                                logger.error(`Error updating token balance for ${address} and token ${balance.tokenAddress}:`, error);
                            }
                        }
                    } catch (error) {
                        logger.error(`Error updating token balances for ${address}:`, error);
                    }
                }));
                
                // Wait a bit between batches to avoid rate limiting
                if (i + batchSize < addresses.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Clear the addresses to update
            this._addressesToUpdate.clear();
        }
        
        // Update the last balance update time
        this._lastBalanceUpdateTime = now;
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

    private async processNewContracts(fromBlock: number, toBlock: number) {
        try {
            logger.info(`Detecting new contracts from block ${fromBlock} to ${toBlock}`);
            
            // Use the blockchain service to detect new contracts
            const contracts = await blockchain.detectNewContracts(fromBlock, toBlock);
            
            // Store each contract in the database
            for (const contract of contracts) {
                try {
                    await db.storeContract(contract);
                    logger.info(`Stored contract ${contract.address} in the database`);
                    
                    // If this is a token contract, update token information
                    if (contract.contractType && contract.contractType !== 'UNKNOWN') {
                        // Process token information
                        if (contract.contractType === 'ERC20') {
                            // For ERC20 tokens, update token balances
                            logger.info(`Processing ERC20 token ${contract.address}`);
                            // This would be handled by the token transfers processing
                        } else if (contract.contractType === 'ERC721' || contract.contractType === 'ERC1155') {
                            // For NFT tokens, update collection information
                            logger.info(`Processing NFT collection ${contract.address}`);
                            await this.processTokenCollection(contract.address);
                        }
                    }
                } catch (error) {
                    logger.error(`Error storing contract ${contract.address}:`, error);
                }
            }
            
            logger.info(`Processed ${contracts.length} new contracts from block ${fromBlock} to ${toBlock}`);
        } catch (error) {
            logger.error(`Error processing new contracts from block ${fromBlock} to ${toBlock}:`, error);
        }
    }

    stop() {
        this._isRunning = false;
        logger.info('Stopping indexer...');
    }
}

export const indexer = new Indexer();
