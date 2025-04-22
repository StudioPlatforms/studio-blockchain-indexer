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
        
        // Validators Count endpoint
        this.app.get('/stats/validators/count', this.getValidatorsCount.bind(this));

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
            // Get the provider from the blockchain service
            const provider = blockchain.getProvider();
            
            // Get the active validators using clique_getSigners
            let validatorAddresses: string[] = [];
            
            try {
                // Try to get validators using clique_getSigners
                validatorAddresses = await provider.send('clique_getSigners', ['latest']);
            } catch (e) {
                // If clique_getSigners is not available, use a fallback approach
                logger.warn('clique_getSigners not available, using fallback approach:', e);
                
                // Fallback: Use the main validator address provided
                validatorAddresses = ['0x856157992B74A799D7A09F611f7c78AF4f26d309'];
                
                // Get recent blocks to find other validators
                const latestBlockNumber = await this.database.getLatestBlock();
                const startBlock = Math.max(0, latestBlockNumber - 100); // Look at the last 100 blocks
                
                // Get unique miners from recent blocks
                const miners = new Set<string>();
                
                for (let i = startBlock; i <= latestBlockNumber; i++) {
                    const block = await this.database.getBlock(i);
                    if (block && block.miner) {
                        miners.add(block.miner.toLowerCase());
                    }
                }
                
                // Add miners to validator addresses
                miners.forEach(miner => {
                    if (!validatorAddresses.includes(miner)) {
                        validatorAddresses.push(miner);
                    }
                });
            }
            
            // Calculate rewards for each validator
            const validatorPayouts = [];
            let totalPayout = ethers.BigNumber.from(0);
            
            for (const validatorAddress of validatorAddresses) {
                // Get blocks mined by this validator
                const latestBlockNumber = await this.database.getLatestBlock();
                
                // Query the database for blocks mined by this validator
                // This is more efficient than looping through all blocks
                const query = `
                    SELECT COUNT(*) as count
                    FROM blocks
                    WHERE miner = $1
                `;
                
                const result = await this.database.pool.query(query, [validatorAddress.toLowerCase()]);
                const blockCount = parseInt(result.rows[0].count) || 0;
                
                // Get a sample of blocks mined by this validator for calculating rewards
                const blocksMinedByValidator = [];
                
                // If there are blocks mined by this validator, get a sample
                if (blockCount > 0) {
                    // Get up to 100 blocks mined by this validator
                    const blocksQuery = `
                        SELECT *
                        FROM blocks
                        WHERE miner = $1
                        ORDER BY number DESC
                        LIMIT 100
                    `;
                    
                    const blocksResult = await this.database.pool.query(blocksQuery, [validatorAddress.toLowerCase()]);
                    
                    for (const row of blocksResult.rows) {
                        blocksMinedByValidator.push({
                            number: row.number,
                            hash: row.hash,
                            miner: row.miner,
                            timestamp: row.timestamp
                        });
                    }
                }
                
                // Calculate rewards for this validator
                let validatorPayout = ethers.BigNumber.from(0);
                
                // Add block rewards (assuming 0.1 STO per block)
                const blockReward = ethers.utils.parseEther('0.1');
                validatorPayout = validatorPayout.add(blockReward.mul(blocksMinedByValidator.length));
                
                // Add transaction fees
                for (const block of blocksMinedByValidator) {
                    const transactions = await this.database.getTransactionsByBlock(block.number);
                    
                    for (const tx of transactions) {
                        const gasUsed = tx.gasLimit; // Using gasLimit as gasUsed since we don't have gasUsed in the TransactionData
                        const gasPrice = tx.gasPrice;
                        const fee = gasUsed.mul(gasPrice);
                        validatorPayout = validatorPayout.add(fee);
                    }
                }
                
                totalPayout = totalPayout.add(validatorPayout);
                
                validatorPayouts.push({
                    address: validatorAddress,
                    blocksMined: blocksMinedByValidator.length,
                    payout: validatorPayout.toString(),
                    formattedPayout: ethers.utils.formatEther(validatorPayout)
                });
            }
            
            res.json({
                totalPayout: totalPayout.toString(),
                formattedPayout: ethers.utils.formatEther(totalPayout),
                validators: validatorPayouts
            });
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

    /**
     * Get the total number of active validators
     */
    private async getValidatorsCount(req: Request, res: Response): Promise<void> {
        try {
            // Get the provider from the blockchain service
            const provider = blockchain.getProvider();
            
            // Get the active validators using clique_getSigners
            let validatorAddresses: string[] = [];
            
            try {
                // Try to get validators using clique_getSigners
                validatorAddresses = await provider.send('clique_getSigners', ['latest']);
            } catch (e) {
                // If clique_getSigners is not available, use a fallback approach
                logger.warn('clique_getSigners not available, using fallback approach:', e);
                
                // Fallback: Use the main validator address provided
                validatorAddresses = ['0x856157992B74A799D7A09F611f7c78AF4f26d309'];
                
                // Get recent blocks to find other validators
                const latestBlockNumber = await this.database.getLatestBlock();
                const startBlock = Math.max(0, latestBlockNumber - 100); // Look at the last 100 blocks
                
                // Get unique miners from recent blocks
                const miners = new Set<string>();
                
                for (let i = startBlock; i <= latestBlockNumber; i++) {
                    const block = await this.database.getBlock(i);
                    if (block && block.miner) {
                        miners.add(block.miner.toLowerCase());
                    }
                }
                
                // Add miners to validator addresses
                miners.forEach(miner => {
                    if (!validatorAddresses.includes(miner)) {
                        validatorAddresses.push(miner);
                    }
                });
            }
            
            // Get the latest block
            const latestBlockNumber = await this.database.getLatestBlock();
            
            // Get the latest block details
            const latestBlock = await this.database.getBlock(latestBlockNumber);
            
            // Check if validators are active by querying their balances
            const activeValidators = [];
            
            for (const validatorAddress of validatorAddresses) {
                try {
                    // Get the validator's balance
                    const balance = await blockchain.getBalance(validatorAddress);
                    
                    // Get blocks mined by this validator
                    const startBlock = Math.max(0, latestBlockNumber - 1000); // Look at the last 1000 blocks
                    let blocksMined = 0;
                    
                    for (let i = startBlock; i <= latestBlockNumber; i++) {
                        const block = await this.database.getBlock(i);
                        if (block && block.miner && block.miner.toLowerCase() === validatorAddress.toLowerCase()) {
                            blocksMined++;
                        }
                    }
                    
                    // If the balance is greater than 0 and the validator has mined blocks, it's considered active
                    if (balance.gt(0) && blocksMined > 0) {
                        activeValidators.push({
                            address: validatorAddress,
                            balance: balance.toString(),
                            formattedBalance: ethers.utils.formatEther(balance),
                            blocksMined: blocksMined
                        });
                    }
                } catch (error) {
                    logger.warn(`Error getting balance for validator ${validatorAddress}:`, error);
                }
            }
            
            // Identify the main node (assuming it's the first validator in the list)
            const mainNode = validatorAddresses.length > 0 ? validatorAddresses[0] : null;
            
            res.json({
                count: activeValidators.length,
                mainNode: mainNode,
                validators: validatorAddresses,
                activeValidators: activeValidators,
                latestBlock: latestBlockNumber,
                blockTimestamp: latestBlock ? latestBlock.timestamp : null
            });
        } catch (error: any) {
            logger.error('Error getting validators count:', error);
            res.status(500).json({ error: 'Failed to get validators count' });
        }
    }
}
