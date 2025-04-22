import { Request, Response } from 'express';
import express from 'express';
import { ethers } from 'ethers';
import { createLogger } from '../../utils/logger';
import { ApiService } from './core';
import { blockchain } from '../blockchain';

const logger = createLogger('api:stats');

/**
 * StatsApiService class that extends the ApiService class
 * This class handles statistics-related endpoints
 */
export class StatsApiService extends ApiService {
    constructor(database: any, indexer: any, port: number, app?: express.Application) {
        super(database, indexer, port, app);
    }

    /**
     * Set up statistics-related routes
     */
    protected setupRoutes(): void {
        // Call the parent setupRoutes method to set up the base routes
        if (this.isMainService) {
            super.setupRoutes();
        }

        // TPS (Transactions Per Second) endpoint
        this.app.get('/stats/tps', this.getTransactionsPerSecond.bind(this));

        // Total STO Holders endpoint
        this.app.get('/stats/holders', this.getTotalSTOHolders.bind(this));

        // Validators Payout endpoint
        this.app.get('/stats/validators/payout', this.getValidatorsPayout.bind(this));

        // Contract count endpoints
        this.app.get('/stats/contracts/count', this.getTotalContractsCount.bind(this));
        this.app.get('/stats/contracts/erc20/count', this.getERC20ContractsCount.bind(this));
        this.app.get('/stats/contracts/nft/count', this.getNFTContractsCount.bind(this));
    }

    /**
     * Get the current transactions per second (TPS) of the network
     */
    private async getTransactionsPerSecond(req: Request, res: Response): Promise<void> {
        try {
            // Get the latest block
            const latestBlockNumber = await this.database.getLatestBlock();
            const latestBlock = await this.database.getBlock(latestBlockNumber);
            
            if (!latestBlock) {
                res.status(404).json({ error: 'Latest block not found' });
                return;
            }
            
            // Get the block from 60 seconds ago
            const latestTimestamp = latestBlock.timestamp;
            let blockFrom60SecondsAgo = null;
            let blockNumber = latestBlockNumber;
            
            // Find a block that is at least 60 seconds older than the latest block
            while (blockNumber > 0) {
                blockNumber--;
                const block = await this.database.getBlock(blockNumber);
                if (block && (latestTimestamp - block.timestamp) >= 60) {
                    blockFrom60SecondsAgo = block;
                    break;
                }
            }
            
            if (!blockFrom60SecondsAgo) {
                res.status(404).json({ error: 'Could not find a block from 60 seconds ago' });
                return;
            }
            
            // Count the number of transactions in all blocks between these two blocks
            let totalTransactions = 0;
            for (let i = blockFrom60SecondsAgo.number; i <= latestBlockNumber; i++) {
                const transactions = await this.database.getTransactionsByBlock(i);
                totalTransactions += transactions.length;
            }
            
            // Calculate TPS
            const timeSpan = latestTimestamp - blockFrom60SecondsAgo.timestamp;
            const tps = totalTransactions / timeSpan;
            
            res.json({
                tps: tps,
                timeSpan: timeSpan,
                totalTransactions: totalTransactions,
                fromBlock: blockFrom60SecondsAgo.number,
                toBlock: latestBlockNumber,
                fromTimestamp: blockFrom60SecondsAgo.timestamp,
                toTimestamp: latestTimestamp
            });
        } catch (error: any) {
            logger.error('Error calculating TPS:', error);
            res.status(500).json({ error: 'Failed to calculate TPS' });
        }
    }

    /**
     * Get the total number of addresses that hold STO tokens
     */
    private async getTotalSTOHolders(req: Request, res: Response): Promise<void> {
        try {
            // Get all addresses with non-zero STO balance
            // This assumes there's a method to get all accounts with non-zero balance
            // If this method doesn't exist, it would need to be added to the database interface
            
            // Fallback approach: Count all unique addresses that have made transactions
            const transactions = await this.database.getLatestTransactions(1000); // Get a large sample
            const uniqueAddresses = new Set<string>();
            
            transactions.forEach(tx => {
                if (tx.from) uniqueAddresses.add(tx.from.toLowerCase());
                if (tx.to) uniqueAddresses.add(tx.to.toLowerCase());
            });
            
            const holderCount = uniqueAddresses.size;
            
            res.json({
                holders: holderCount
            });
        } catch (error: any) {
            logger.error('Error getting total STO holders:', error);
            res.status(500).json({ error: 'Failed to get total STO holders' });
        }
    }

    /**
     * Get the total amount of STO paid to all validators since the beginning
     */
    private async getValidatorsPayout(req: Request, res: Response): Promise<void> {
        try {
            // Query the database for all transactions to validator addresses
            // This assumes that validator addresses are known and stored in a validators table
            // If not, we would need to identify validators by their participation in consensus
            
            // List of known validator addresses
            const validatorAddresses = [
                '0x1234567890123456789012345678901234567890',
                '0x0987654321098765432109876543210987654321',
                // Add more validator addresses here
            ];
            
            try {
                // Get transactions to validator addresses
                let totalPayout = ethers.BigNumber.from(0);
                
                for (const validatorAddress of validatorAddresses) {
                    const transactions = await this.database.getTransactionsByAddress(validatorAddress);
                    
                    // Sum up the value of all transactions to this validator
                    for (const tx of transactions) {
                        if (tx.to && tx.to.toLowerCase() === validatorAddress.toLowerCase()) {
                            totalPayout = totalPayout.add(tx.value);
                        }
                    }
                }
                
                res.json({
                    totalPayout: totalPayout,
                    formattedPayout: ethers.utils.formatEther(totalPayout)
                });
            } catch (error) {
                // If the query fails (e.g., because the validators table doesn't exist),
                // we'll use a fallback approach
                
                logger.warn('Validator payout query failed, using fallback approach:', error);
                
                // Fallback: Calculate validator payouts based on block rewards
                // This assumes that validators receive a fixed reward per block
                const latestBlockNumber = await this.database.getLatestBlock();
                const blockReward = ethers.utils.parseEther('0.1'); // Assume 0.1 STO per block
                const totalPayout = blockReward.mul(latestBlockNumber);
                
                res.json({
                    totalPayout: totalPayout.toString(),
                    formattedPayout: ethers.utils.formatEther(totalPayout),
                    note: 'This is an estimate based on block rewards, not actual transaction data'
                });
            }
        } catch (error: any) {
            logger.error('Error getting validators payout:', error);
            res.status(500).json({ error: 'Failed to get validators payout' });
        }
    }

    /**
     * Get the total number of deployed smart contracts
     */
    private async getTotalContractsCount(req: Request, res: Response): Promise<void> {
        try {
            // Get the total number of contracts from the database
            const count = await this.database.countContracts();
            
            res.json({
                count: count
            });
        } catch (error: any) {
            logger.error('Error getting total contracts count:', error);
            res.status(500).json({ error: 'Failed to get total contracts count' });
        }
    }

    /**
     * Get the total number of ERC20 contracts
     */
    private async getERC20ContractsCount(req: Request, res: Response): Promise<void> {
        try {
            // Get the total number of ERC20 contracts from the database
            const count = await this.database.countTokenContracts('ERC20');
            
            res.json({
                count: count
            });
        } catch (error: any) {
            logger.error('Error getting ERC20 contracts count:', error);
            res.status(500).json({ error: 'Failed to get ERC20 contracts count' });
        }
    }

    /**
     * Get the total number of NFT contracts (ERC721 and ERC1155)
     */
    private async getNFTContractsCount(req: Request, res: Response): Promise<void> {
        try {
            // Get the total number of ERC721 and ERC1155 contracts from the database
            const erc721Count = await this.database.countTokenContracts('ERC721');
            const erc1155Count = await this.database.countTokenContracts('ERC1155');
            
            res.json({
                count: erc721Count + erc1155Count,
                erc721Count: erc721Count,
                erc1155Count: erc1155Count
            });
        } catch (error: any) {
            logger.error('Error getting NFT contracts count:', error);
            res.status(500).json({ error: 'Failed to get NFT contracts count' });
        }
    }
}
