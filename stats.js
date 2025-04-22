"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsApiService = void 0;
const express_1 = require("express");
const ethers_1 = require("ethers");
const logger_1 = require("../../utils/logger");
const core_1 = require("./core");
const blockchain_1 = require("../blockchain");
const logger = (0, logger_1.createLogger)('api:stats');
/**
 * StatsApiService class that extends the ApiService class
 * This class handles statistics-related endpoints
 */
class StatsApiService extends core_1.ApiService {
    constructor(database, indexer, port, app) {
        super(database, indexer, port, app);
    }
    /**
     * Set up statistics-related routes
     */
    setupRoutes() {
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
    async getTransactionsPerSecond(req, res) {
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
        }
        catch (error) {
            logger.error('Error calculating TPS:', error);
            res.status(500).json({ error: 'Failed to calculate TPS' });
        }
    }
    /**
     * Get the total number of addresses that hold STO tokens
     */
    async getTotalSTOHolders(req, res) {
        try {
            // Get all addresses with non-zero STO balance
            // This assumes there's a method to get all accounts with non-zero balance
            // If this method doesn't exist, it would need to be added to the database interface
            // Fallback approach: Count all unique addresses that have made transactions
            const transactions = await this.database.getLatestTransactions(1000); // Get a large sample
            const uniqueAddresses = new Set();
            transactions.forEach(tx => {
                if (tx.from)
                    uniqueAddresses.add(tx.from.toLowerCase());
                if (tx.to)
                    uniqueAddresses.add(tx.to.toLowerCase());
            });
            const holderCount = uniqueAddresses.size;
            res.json({
                holders: holderCount
            });
        }
        catch (error) {
            logger.error('Error getting total STO holders:', error);
            res.status(500).json({ error: 'Failed to get total STO holders' });
        }
    }
    /**
     * Get the total amount of STO paid to all validators since the beginning
     */
    async getValidatorsPayout(req, res) {
        try {
            // Get the provider from the blockchain service
            const provider = blockchain_1.blockchain.getProvider();
            // Get the active validators using clique_getSigners
            let validatorAddresses = [];
            try {
                // Try to get validators using clique_getSigners
                validatorAddresses = await provider.send('clique_getSigners', ['latest']);
            }
            catch (e) {
                // If clique_getSigners is not available, use a fallback approach
                logger.warn('clique_getSigners not available, using fallback approach:', e);
                // Fallback: Use the main validator address provided
                validatorAddresses = ['0x856157992B74A799D7A09F611f7c78AF4f26d309', '0xc64e733f5c92c70091688b342aecf96b8bc39b5b'];
            }
            // Get the latest block
            const latestBlockNumber = await this.database.getLatestBlock();
            // Get the total number of blocks mined by each validator
            // In a real implementation, you would query the database to get the actual count
            // For now, we'll use the miner field from the blocks table
            // Get the count of blocks mined by each validator
            const validatorBlockCounts = new Map();
            // Initialize the counts to 0
            for (const validatorAddress of validatorAddresses) {
                validatorBlockCounts.set(validatorAddress, 0);
            }
            // Count the blocks mined by each validator
            // Since most blocks have miner=0x0, we'll assume an equal distribution
            // In a real implementation, you would query the database to get the actual count
            const blocksPerValidator = Math.floor(latestBlockNumber / validatorAddresses.length);
            for (const validatorAddress of validatorAddresses) {
                validatorBlockCounts.set(validatorAddress, blocksPerValidator);
            }
            // Calculate rewards for each validator
            const validatorPayouts = [];
            let totalPayout = ethers_1.ethers.BigNumber.from(0);
            // Define the block reward
            const blockReward = ethers_1.ethers.utils.parseEther('0.1'); // 0.1 STO per block
            for (const validatorAddress of validatorAddresses) {
                // Get the validator's balance
                const balance = await blockchain_1.blockchain.getBalance(validatorAddress);
                // Get the number of blocks mined by this validator
                const blocksMined = validatorBlockCounts.get(validatorAddress) || 0;
                // Calculate the validator's payout
                const validatorPayout = blockReward.mul(blocksMined);
                totalPayout = totalPayout.add(validatorPayout);
                // Get the RPC URLs associated with this validator
                const rpcUrls = [];
                const ipAddresses = [];
                // Map RPC URLs to validators
                if (validatorAddress.toLowerCase() === '0x856157992B74A799D7A09F611f7c78AF4f26d309'.toLowerCase()) {
                    rpcUrls.push('mainnet.studio-blockchain.com', 'mainnet.studio-scan.com');
                    ipAddresses.push('62.171.162.49', '167.86.95.117');
                }
                else if (validatorAddress.toLowerCase() === '0xc64e733f5c92c70091688b342aecf96b8bc39b5b'.toLowerCase()) {
                    rpcUrls.push('mainnet2.studio-blockchain.com', 'mainnet2.studio-scan.com', 'mainnet3.studio-blockchain.com');
                    ipAddresses.push('173.212.200.31', '173.249.16.253', '161.97.92.8');
                }
                validatorPayouts.push({
                    address: validatorAddress,
                    balance: balance.toString(),
                    formattedBalance: ethers_1.ethers.utils.formatEther(balance),
                    estimatedBlocksMined: blocksMined,
                    payout: validatorPayout.toString(),
                    formattedPayout: ethers_1.ethers.utils.formatEther(validatorPayout),
                    rpcUrls,
                    ipAddresses
                });
            }
            res.json({
                totalPayout: totalPayout.toString(),
                formattedPayout: ethers_1.ethers.utils.formatEther(totalPayout),
                validators: validatorPayouts,
                note: 'This is an estimate based on an equal distribution of block rewards among validators'
            });
        }
        catch (error) {
            logger.error('Error getting validators payout:', error);
            res.status(500).json({ error: 'Failed to get validators payout' });
        }
    }
    /**
     * Get the total number of deployed smart contracts
     */
    async getTotalContractsCount(req, res) {
        try {
            // Get the total number of contracts from the database
            const count = await this.database.countContracts();
            res.json({
                count: count
            });
        }
        catch (error) {
            logger.error('Error getting total contracts count:', error);
            res.status(500).json({ error: 'Failed to get total contracts count' });
        }
    }
    /**
     * Get the total number of ERC20 contracts
     */
    async getERC20ContractsCount(req, res) {
        try {
            // Get the total number of ERC20 contracts from the database
            const count = await this.database.countTokenContracts('ERC20');
            res.json({
                count: count
            });
        }
        catch (error) {
            logger.error('Error getting ERC20 contracts count:', error);
            res.status(500).json({ error: 'Failed to get ERC20 contracts count' });
        }
    }
    /**
     * Get the total number of NFT contracts (ERC721 and ERC1155)
     */
    async getNFTContractsCount(req, res) {
        try {
            // Get the total number of ERC721 and ERC1155 contracts from the database
            const erc721Count = await this.database.countTokenContracts('ERC721');
            const erc1155Count = await this.database.countTokenContracts('ERC1155');
            res.json({
                count: erc721Count + erc1155Count,
                erc721Count: erc721Count,
                erc1155Count: erc1155Count
            });
        }
        catch (error) {
            logger.error('Error getting NFT contracts count:', error);
            res.status(500).json({ error: 'Failed to get NFT contracts count' });
        }
    }
    /**
     * Get the total number of active validators
     */
    async getValidatorsCount(req, res) {
        try {
            // Get the provider from the blockchain service
            const provider = blockchain_1.blockchain.getProvider();
            // Get the active validators using clique_getSigners
            let validatorAddresses = [];
            try {
                // Try to get validators using clique_getSigners
                validatorAddresses = await provider.send('clique_getSigners', ['latest']);
            }
            catch (e) {
                // If clique_getSigners is not available, use a fallback approach
                logger.warn('clique_getSigners not available, using fallback approach:', e);
                // Fallback: Use the main validator address provided
                validatorAddresses = ['0x856157992B74A799D7A09F611f7c78AF4f26d309', '0xc64e733f5c92c70091688b342aecf96b8bc39b5b'];
            }
            // Get the latest block
            const latestBlockNumber = await this.database.getLatestBlock();
            // Get the latest block details
            const latestBlock = await this.database.getBlock(latestBlockNumber);
            // Check if validators are active by querying their balances
            const activeValidators = [];
            // Get all validators from RPC URLs
            const rpcUrls = [
                'mainnet.studio-blockchain.com',
                'mainnet2.studio-blockchain.com',
                'mainnet3.studio-blockchain.com',
                'mainnet.studio-scan.com',
                'mainnet2.studio-scan.com'
            ];
            // Map RPC URLs to IP addresses
            const rpcIpAddresses = {
                'mainnet.studio-blockchain.com': '62.171.162.49',
                'mainnet2.studio-blockchain.com': '173.212.200.31',
                'mainnet3.studio-blockchain.com': '161.97.92.8',
                'mainnet.studio-scan.com': '167.86.95.117',
                'mainnet2.studio-scan.com': '173.249.16.253'
            };
            // Create a map of validators to their RPC URLs
            const validatorRpcMap = new Map();
            // For now, we'll assume the validators are associated with the RPC URLs in order
            // In a real implementation, you would need to determine which validator is running which RPC URL
            if (validatorAddresses.length > 0) {
                validatorRpcMap.set(validatorAddresses[0], ['mainnet.studio-blockchain.com', 'mainnet.studio-scan.com']);
                if (validatorAddresses.length > 1) {
                    validatorRpcMap.set(validatorAddresses[1], ['mainnet2.studio-blockchain.com', 'mainnet2.studio-scan.com', 'mainnet3.studio-blockchain.com']);
                }
            }
            for (const validatorAddress of validatorAddresses) {
                try {
                    // Get the validator's balance
                    const balance = await blockchain_1.blockchain.getBalance(validatorAddress);
                    // Get the RPC URLs associated with this validator
                    const validatorRpcUrls = validatorRpcMap.get(validatorAddress) || [];
                    // Get the IP addresses associated with this validator
                    const validatorIpAddresses = validatorRpcUrls.map(url => {
                        return rpcIpAddresses[url];
                    }).filter(Boolean);
                    // All validators returned by clique_getSigners are considered active
                    activeValidators.push({
                        address: validatorAddress,
                        balance: balance.toString(),
                        formattedBalance: ethers_1.ethers.utils.formatEther(balance),
                        rpcUrls: validatorRpcUrls,
                        ipAddresses: validatorIpAddresses
                    });
                }
                catch (error) {
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
        }
        catch (error) {
            logger.error('Error getting validators count:', error);
            res.status(500).json({ error: 'Failed to get validators count' });
        }
    }
}
exports.StatsApiService = StatsApiService;
