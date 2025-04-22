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
            // Query the database for all addresses with non-zero STO balance
            const query = `
                SELECT COUNT(DISTINCT address) as holder_count
                FROM accounts
                WHERE balance > 0
            `;
            
            const result = await this.database.pool.query(query);
            const holderCount = parseInt(result.rows[0]?.holder_count) || 0;
            
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
            
            const query = `
                SELECT SUM(CAST(value AS NUMERIC)) as total_payout
                FROM transactions
                WHERE to_address IN (
                    SELECT address FROM validators
                )
            `;
            
            // If there's no validators table, we can use a list of known validator addresses
            // const validatorAddresses = [
            //     '0x1234567890123456789012345678901234567890',
            //     '0x0987654321098765432109876543210987654321',
            //     // Add more validator addresses here
            // ];
            
            // const query = `
            //     SELECT SUM(CAST(value AS NUMERIC)) as total_payout
            //     FROM transactions
            //     WHERE to_address IN (${validatorAddresses.map(addr => `'${addr}'`).join(',')})
            // `;
            
            try {
                const result = await this.database.pool.query(query);
                const totalPayout = result.rows[0]?.total_payout || '0';
                
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
}
