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
EOL

docker cp /root/mainnet-indexer/stats.js efacbe2f0de5_mainnet-indexer_indexer_1:/app/dist/services/api/stats.js && docker restart efacbe2f0de5_mainnet-indexer_indexer_1
curl -s "http://localhost:3000/stats/validators/payout" | jq
cat /root/mainnet-indexer/stats.js | grep -A10 "if (validatorAddress === '0x856157992B74A799D7A09F611f7c78AF4f26d309')"
cat > /root/mainnet-indexer/stats.js << 'EOL'
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
EOL

docker cp /root/mainnet-indexer/stats.js efacbe2f0de5_mainnet-indexer_indexer_1:/app/dist/services/api/stats.js && docker restart efacbe2f0de5_mainnet-indexer_indexer_1
curl -s "http://localhost:3000/stats/validators/payout" | jq
curl -s "http://localhost:3000/stats/validators/count" | jq
curl -s "http://localhost:3000/contracts/0x856157992b74a799d7a09f611f7c78af4f26d309/verification" | jq
curl -s "http://localhost:3000/contracts/0x856157992b74a799d7a09f611f7c78af4f26d309/verification"
cat /root/mainnet-indexer/src/services/api/contracts.ts
ls
curl -s -X GET http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/abi
chmod +x mainnet-indexer/apply-evm-version-migration.sh
cd /root/mainnet-indexer && ./apply-evm-version-migration.sh
cd "/root"
cd /root/mainnet-indexer && npm run build
cd "/root"
node --version
ls -la mainnet-indexer/scripts/
ls -la mainnet-indexer/ | grep -i docker
docker ps
cd /root/mainnet-indexer && docker-compose build indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
curl -X POST -H "Content-Type: application/json" -d '{"address":"0x1234567890123456789012345678901234567890","sourceCode":"pragma solidity ^0.8.0; contract TestContract { }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"constructorArguments":"0x","contractName":"TestContract","libraries":{},"evmVersion":"shanghai"}' http://localhost:3000/contracts/verify
docker logs efacbe2f0de5_mainnet-indexer_indexer_1 | tail -n 20
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d contracts"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d contracts" | grep -i evm
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'contracts' ORDER BY ordinal_position;"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT address FROM contracts LIMIT 1;"
curl -X POST -H "Content-Type: application/json" -d '{"address":"0x5de8c9a0a16bfda29390f9bdc3d660421ed81b5f","sourceCode":"pragma solidity ^0.8.0; contract TestContract { }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"constructorArguments":"0x","contractName":"TestContract","libraries":{},"evmVersion":"shanghai"}' http://localhost:3000/contracts/verify
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT evm_version FROM contracts WHERE address = '0x5de8c9a0a16bfda29390f9bdc3d660421ed81b5f';"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT verified FROM contracts WHERE address = '0x5de8c9a0a16bfda29390f9bdc3d660421ed81b5f';"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "UPDATE contracts SET evm_version = 'shanghai' WHERE address = '0x5de8c9a0a16bfda29390f9bdc3d660421ed81b5f';"
curl -X POST -H "Content-Type: application/json" -d '{
  "address": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
  "sourceCode": "pragma solidity ^0.4.17;\n\n/**\n * @title SafeMath\n * @dev Math operations with safety checks that throw on error\n */\nlibrary SafeMath {\n    function mul(uint256 a, uint256 b) internal pure returns (uint256) {\n        if (a == 0) {\n            return 0;\n        }\n        uint256 c = a * b;\n        assert(c / a == b);\n        return c;\n    }\n\n    function div(uint256 a, uint256 b) internal pure returns (uint256) {\n        // assert(b > 0); // Solidity automatically throws when dividing by 0\n        uint256 c = a / b;\n        // assert(a == b * c + a % b); // There is no case in which this doesn't hold\n        return c;\n    }\n\n    function sub(uint256 a, uint256 b) internal pure returns (uint256) {\n        assert(b <= a);\n        return a - b;\n    }\n\n    function add(uint256 a, uint256 b) internal pure returns (uint256) {\n        uint256 c = a + b;\n        assert(c >= a);\n        return c;\n    }\n}\n\n/**\n * @title Ownable\n * @dev The Ownable contract has an owner address, and provides basic authorization control\n * functions, this simplifies the implementation of \"user permissions\".\n */\ncontract Ownable {\n    address public owner;\n\n    /**\n      * @dev The Ownable constructor sets the original `owner` of the contract to the sender\n      * account.\n      */\n    function Ownable() public {\n        owner = msg.sender;\n    }\n\n    /**\n      * @dev Throws if called by any account other than the owner.\n      */\n    modifier onlyOwner() {\n        require(msg.sender == owner);\n        _;\n    }\n\n    /**\n    * @dev Allows the current owner to transfer control of the contract to a newOwner.\n    * @param newOwner The address to transfer ownership to.\n    */\n    function transferOwnership(address newOwner) public onlyOwner {\n        if (newOwner != address(0)) {\n            owner = newOwner;\n        }\n    }\n\n}\n\n/**\n * @title ERC20Basic\n * @dev Simpler version of ERC20 interface\n * @dev see https://github.com/ethereum/EIPs/issues/20\n */\ncontract ERC20Basic {\n    uint public _totalSupply;\n    function totalSupply() public constant returns (uint);\n    function balanceOf(address who) public constant returns (uint);\n    function transfer(address to, uint value) public;\n    event Transfer(address indexed from, address indexed to, uint value);\n}\n\n/**\n * @title ERC20 interface\n * @dev see https://github.com/ethereum/EIPs/issues/20\n */\ncontract ERC20 is ERC20Basic {\n    function allowance(address owner, address spender) public constant returns (uint);\n    function transferFrom(address from, address to, uint value) public;\n    function approve(address spender, uint value) public;\n    event Approval(address indexed owner, address indexed spender, uint value);\n}\n\n/**\n * @title Basic token\n * @dev Basic version of StandardToken, with no allowances.\n */\ncontract BasicToken is Ownable, ERC20Basic {\n    using SafeMath for uint;\n\n    mapping(address => uint) public balances;\n\n    // additional variables for use if transaction fees ever became necessary\n    uint public basisPointsRate = 0;\n    uint public maximumFee = 0;\n\n    /**\n    * @dev Fix for the ERC20 short address attack.\n    */\n    modifier onlyPayloadSize(uint size) {\n        require(!(msg.data.length < size + 4));\n        _;\n    }\n\n    /**\n    * @dev transfer token for a specified address\n    * @param _to The address to transfer to.\n    * @param _value The amount to be transferred.\n    */\n    function transfer(address _to, uint _value) public onlyPayloadSize(2 * 32) {\n        uint fee = (_value.mul(basisPointsRate)).div(10000);\n        if (fee > maximumFee) {\n            fee = maximumFee;\n        }\n        uint sendAmount = _value.sub(fee);\n        balances[msg.sender] = balances[msg.sender].sub(_value);\n        balances[_to] = balances[_to].add(sendAmount);\n        if (fee > 0) {\n            balances[owner] = balances[owner].add(fee);\n            Transfer(msg.sender, owner, fee);\n        }\n        Transfer(msg.sender, _to, sendAmount);\n    }\n\n    /**\n    * @dev Gets the balance of the specified address.\n    * @param _owner The address to query the the balance of.\n    * @return An uint representing the amount owned by the passed address.\n    */\n    function balanceOf(address _owner) public constant returns (uint balance) {\n        return balances[_owner];\n    }\n\n}\n\n/**\n * @title Standard ERC20 token\n *\n * @dev Implementation of the basic standard token.\n * @dev https://github.com/ethereum/EIPs/issues/20\n * @dev Based oncode by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol\n */\ncontract StandardToken is BasicToken, ERC20 {\n\n    mapping (address => mapping (address => uint)) public allowed;\n\n    uint public constant MAX_UINT = 2**256 - 1;\n\n    /**\n    * @dev Transfer tokens from one address to another\n    * @param _from address The address which you want to send tokens from\n    * @param _to address The address which you want to transfer to\n    * @param _value uint the amount of tokens to be transferred\n    */\n    function transferFrom(address _from, address _to, uint _value) public onlyPayloadSize(3 * 32) {\n        var _allowance = allowed[_from][msg.sender];\n\n        // Check is not needed because sub(_allowance, _value) will already throw if this condition is not met\n        // if (_value > _allowance) throw;\n\n        uint fee = (_value.mul(basisPointsRate)).div(10000);\n        if (fee > maximumFee) {\n            fee = maximumFee;\n        }\n        if (_allowance < MAX_UINT) {\n            allowed[_from][msg.sender] = _allowance.sub(_value);\n        }\n        uint sendAmount = _value.sub(fee);\n        balances[_from] = balances[_from].sub(_value);\n        balances[_to] = balances[_to].add(sendAmount);\n        if (fee > 0) {\n            balances[owner] = balances[owner].add(fee);\n            Transfer(_from, owner, fee);\n        }\n        Transfer(_from, _to, sendAmount);\n    }\n\n    /**\n    * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.\n    * @param _spender The address which will spend the funds.\n    * @param _value The amount of tokens to be spent.\n    */\n    function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {\n\n        // To change the approve amount you first have to reduce the addresses`\n        //  allowance to zero by calling `approve(_spender, 0)` if it is not\n        //  already 0 to mitigate the race condition described here:\n        //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729\n        require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));\n\n        allowed[msg.sender][_spender] = _value;\n        Approval(msg.sender, _spender, _value);\n    }\n\n    /**\n    * @dev Function to check the amount of tokens than an owner allowed to a spender.\n    * @param _owner address The address which owns the funds.\n    * @param _spender address The address which will spend the funds.\n    * @return A uint specifying the amount of tokens still available for the spender.\n    */\n    function allowance(address _owner, address _spender) public constant returns (uint remaining) {\n        return allowed[_owner][_spender];\n    }\n\n}\n\n\n/**\n * @title Pausable\n * @dev Base contract which allows children to implement an emergency stop mechanism.\n */\ncontract Pausable is Ownable {\n  event Pause();\n  event Unpause();\n\n  bool public paused = false;\n\n\n  /**\n   * @dev Modifier to make a function callable only when the contract is not paused.\n   */\n  modifier whenNotPaused() {\n    require(!paused);\n    _;\n  }\n\n  /**\n   * @dev Modifier to make a function callable only when the contract is paused.\n   */\n  modifier whenPaused() {\n    require(paused);\n    _;\n  }\n\n  /**\n   * @dev called by the owner to pause, triggers stopped state\n   */\n  function pause() onlyOwner whenNotPaused public {\n    paused = true;\n    Pause();\n  }\n\n  /**\n   * @dev called by the owner to unpause, returns to normal state\n   */\n  function unpause() onlyOwner whenPaused public {\n    paused = false;\n    Unpause();\n  }\n}\n\ncontract BlackList is Ownable, BasicToken {\n\n    /////// Getters to allow the same blacklist to be used also by other contracts (including upgraded Tether) ///////\n    function getBlackListStatus(address _maker) external constant returns (bool) {\n        return isBlackListed[_maker];\n    }\n\n    function getOwner() external constant returns (address) {\n        return owner;\n    }\n\n    mapping (address => bool) public isBlackListed;\n    \n    function addBlackList (address _evilUser) public onlyOwner {\n        isBlackListed[_evilUser] = true;\n        AddedBlackList(_evilUser);\n    }\n\n    function removeBlackList (address _clearedUser) public onlyOwner {\n        isBlackListed[_clearedUser] = false;\n        RemovedBlackList(_clearedUser);\n    }\n\n    function destroyBlackFunds (address _blackListedUser) public onlyOwner {\n        require(isBlackListed[_blackListedUser]);\n        uint dirtyFunds = balanceOf(_blackListedUser);\n        balances[_blackListedUser] = 0;\n        _totalSupply -= dirtyFunds;\n        DestroyedBlackFunds(_blackListedUser, dirtyFunds);\n    }\n\n    event DestroyedBlackFunds(address _blackListedUser, uint _balance);\n\n    event AddedBlackList(address _user);\n\n    event RemovedBlackList(address _user);\n\n}\n\ncontract UpgradedStandardToken is StandardToken{\n    // those methods are called by the legacy contract\n    // and they must ensure msg.sender to be the contract address\n    function transferByLegacy(address from, address to, uint value) public;\n    function transferFromByLegacy(address sender, address from, address spender, uint value) public;\n    function approveByLegacy(address from, address spender, uint value) public;\n}\n\ncontract TetherToken is Pausable, StandardToken, BlackList {\n\n    string public name;\n    string public symbol;\n    uint public decimals;\n    address public upgradedAddress;\n    bool public deprecated;\n\n    //  The contract can be initialized with a number of tokens\n    //  All the tokens are deposited to the owner address\n    //\n    // @param _balance Initial supply of the contract\n    // @param _name Token Name\n    // @param _symbol Token symbol\n    // @param _decimals Token decimals\n    function TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals) public {\n        _totalSupply = _initialSupply;\n        name = _name;\n        symbol = _symbol;\n        decimals = _decimals;\n        balances[owner] = _initialSupply;\n        deprecated = false;\n    }\n\n    // Forward ERC20 methods to upgraded contract if this one is deprecated\n    function transfer(address _to, uint _value) public whenNotPaused {\n        require(!isBlackListed[msg.sender]);\n        if (deprecated) {\n            return UpgradedStandardToken(upgradedAddress).transferByLegacy(msg.sender, _to, _value);\n        } else {\n            return super.transfer(_to, _value);\n        }\n    }\n\n    // Forward ERC20 methods to upgraded contract if this one is deprecated\n    function transferFrom(address _from, address _to, uint _value) public whenNotPaused {\n        require(!isBlackListed[_from]);\n        if (deprecated) {\n            return UpgradedStandardToken(upgradedAddress).transferFromByLegacy(msg.sender, _from, _to, _value);\n        } else {\n            return super.transferFrom(_from, _to, _value);\n        }\n    }\n\n    // Forward ERC20 methods to upgraded contract if this one is deprecated\n    function balanceOf(address who) public constant returns (uint) {\n        if (deprecated) {\n            return UpgradedStandardToken(upgradedAddress).balanceOf(who);\n        } else {\n            return super.balanceOf(who);\n        }\n    }\n\n    // Forward ERC20 methods to upgraded contract if this one is deprecated\n    function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {\n        if (deprecated) {\n            return UpgradedStandardToken(upgradedAddress).approveByLegacy(msg.sender, _spender, _value);\n        } else {\n            return super.approve(_spender, _value);\n        }\n    }\n\n    // Forward ERC20 methods to upgraded contract if this one is deprecated\n    function allowance(address _owner, address _spender) public constant returns (uint remaining) {\n        if (deprecated) {\n            return StandardToken(upgradedAddress).allowance(_owner, _spender);\n        } else {\n            return super.allowance(_owner, _spender);\n        }\n    }\n\n    // deprecate current contract in favour of a new one\n    function deprecate(address _upgradedAddress) public onlyOwner {\n        deprecated = true;\n        upgradedAddress = _upgradedAddress;\n        Deprecate(_upgradedAddress);\n    }\n\n    // deprecate current contract if favour of a new one\n    function totalSupply() public constant returns (uint) {\n        if (deprecated) {\n            return StandardToken(upgradedAddress).totalSupply();\n        } else {\n            return _totalSupply;\n        }\n    }\n\n    // Issue a new amount of tokens\n    // these tokens are deposited into the owner address\n    //\n    // @param _amount Number of tokens to be issued\n    function issue(uint amount) public onlyOwner {\n        require(_totalSupply + amount > _totalSupply);\n        require(balances[owner] + amount > balances[owner]);\n\n        balances[owner] += amount;\n        _totalSupply += amount;\n        Issue(amount);\n    }\n\n    // Redeem tokens.\n    // These tokens are withdrawn from the owner address\n    // if the balance must be enough to cover the redeem\n    // or the call will fail.\n    // @param _amount Number of tokens to be issued\n    function redeem(uint amount) public onlyOwner {\n        require(_totalSupply >= amount);\n        require(balances[owner] >= amount);\n\n        _totalSupply -= amount;\n        balances[owner] -= amount;\n        Redeem(amount);\n    }\n\n    function setParams(uint newBasisPoints, uint newMaxFee) public onlyOwner {\n        // Ensure transparency by hardcoding limit beyond which fees can never be added\n        require(newBasisPoints < 20);\n        require(newMaxFee < 50);\n\n        basisPointsRate = newBasisPoints;\n        maximumFee = newMaxFee.mul(10**decimals);\n\n        Params(basisPointsRate, maximumFee);\n    }\n\n    // Called when new token are issued\n    event Issue(uint amount);\n\n    // Called when tokens are redeemed\n    event Redeem(uint amount);\n\n    // Called when contract is deprecated\n    event Deprecate(address newAddress);\n\n    // Called if contract ever adds fees\n    event Params(uint feeBasisPoints, uint maxFee);\n}",
}' http://localhost:3000/contracts/verify
curl -X GET http://localhost:3000/stats/tps
docker ps | grep indexer
docker logs efacbe2f0de5_mainnet-indexer_indexer_1 | tail -n 20
curl -X POST -H "Content-Type: application/json" -d '{"address":"0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E","sourceCode":"pragma solidity ^0.4.17;","compilerVersion":"0.4.26+commit.4563c3fc","optimizationUsed":true,"runs":200,"constructorArguments":"","contractName":"TetherToken","libraries":{},"evmVersion":"cancun"}' http://localhost:3000/contracts/verify
docker logs efacbe2f0de5_mainnet-indexer_indexer_1 | grep -A 10 "POST /contracts/verify"
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT verified, evm_version FROM contracts WHERE address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT compiler_version, optimization_used, runs FROM contracts WHERE address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT created_at, updated_at FROM contracts WHERE address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\dt"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d contracts"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT verified, verified_at, evm_version FROM contracts WHERE address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
cd /root/mainnet-indexer && npm install solc @ethereumjs/util
cd "/root"
cd /root/mainnet-indexer && docker-compose build indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose up -d indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose down && docker-compose up -d
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose build indexer && docker-compose up -d
cd "/root"
cd /root/mainnet-indexer && docker-compose down --volumes && docker-compose up -d
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer yarn migrate
cd "/root"
cd /root/mainnet-indexer && ls -la scripts/
cd "/root"
cd /root/mainnet-indexer && ls -la apply-migration.sh
cd "/root"
cd /root/mainnet-indexer && ./apply-migration.sh
cd "/root"
cd /root/mainnet-indexer && cat apply-migration.sh
cd "/root"
cd /root/mainnet-indexer && cat migrations/009_contract_verification.sql
cd "/root"
cd /root/mainnet-indexer && cat migrations/010_add_evm_version.sql
cd "/root"
cd /root/mainnet-indexer && cat apply-evm-version-migration.sh
cd "/root"
cd /root/mainnet-indexer && cat scripts/apply-migration.js
cd "/root"
cd /root/mainnet-indexer && node scripts/apply-migration.js 009_contract_verification.sql
cd "/root"
cd /root/mainnet-indexer && ls -la migrations/
cd "/root"
cd /root/mainnet-indexer && chmod +x apply-all-migrations.sh && ./apply-all-migrations.sh
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
cd /root/mainnet-indexer && cat API_ENDPOINTS.md
cd "/root"
cd /root/mainnet-indexer && cat README-EVM-VERSION-SUPPORT.md
cd "/root"
cd /root/mainnet-indexer && chmod +x test-contract-verification.js
./test-contract-verification.js
cd "/root"
cd /root/mainnet-indexer && cat src/services/api/stats.ts
cd "/root"
cd /root/mainnet-indexer && cat src/services/database/types.ts
cd "/root"
cd /root/mainnet-indexer && chmod +x rebuild-and-restart.sh
cd "/root"
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
curl -s http://localhost:3000/stats/validators/payout | jq
curl -s http://localhost:3000/contracts/verify -X POST -H "Content-Type: application/json" -d '{"address": "0x1234567890123456789012345678901234567890", "sourceCode": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract SimpleStorage {\n    uint256 private value;\n    \n    event ValueChanged(uint256 newValue);\n    \n    constructor(uint256 initialValue) {\n        value = initialValue;\n    }\n    \n    function setValue(uint256 newValue) public {\n        value = newValue;\n        emit ValueChanged(newValue);\n    }\n    \n    function getValue() public view returns (uint256) {\n        return value;\n    }\n}", "compilerVersion": "0.8.0", "contractName": "SimpleStorage", "optimizationUsed": true, "runs": 200, "constructorArguments": "0x0000000000000000000000000000000000000000000000000000000000000064", "evmVersion": "cancun"}' | jq
curl -s http://localhost:3000/api/routes | jq
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
curl -s http://localhost:3000/stats/validators/payout | jq
curl -s http://173.212.200.31 | head -n 20
curl -s https://173.212.200.31 --insecure | head -n 20
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":1}' https://mainnet.studio-blockchain.com
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":1}' https://mainnet2.studio-blockchain.com
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":1}' https://mainnet3.studio-blockchain.com
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x856157992b74a799d7a09f611f7c78af4f26d309", "latest"],"id":1}' https://mainnet.studio-blockchain.com
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xc64e733f5c92c70091688b342aecf96b8bc39b5b", "latest"],"id":1}' https://mainnet.studio-blockchain.com
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":1}' http://173.212.200.31:8545
cd /root/mainnet-indexer && cat src/services/blockchain/index.ts
cd "/root"
cd /root/mainnet-indexer && cat src/services/blockchain/core.ts
cd "/root"
cd /root/mainnet-indexer && ls -la src/services/api/
cd "/root"
cd /root/mainnet-indexer && cat src/services/api/index.ts
cd "/root"
cd /root/mainnet-indexer && cat API_ENDPOINTS.md
cd "/root"
cd /root/mainnet-indexer && cat README-NEW-ENDPOINTS.md
cd "/root"
cd /root/mainnet-indexer && cat README-EVM-VERSION-SUPPORT.md
cd "/root"
cd /root/mainnet-indexer && cat README-CONTRACT-VERIFICATION.md
cd "/root"
cd /root/mainnet-indexer && cat FRONTEND-INTEGRATION-GUIDE.md
ls
ls -la
find mainnet-indexer -type f -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.sql" | sort
curl -s https://binaries.soliditylang.org/bin/list.json | grep -E "0.4.(17|26)" | head -10
curl -s https://binaries.soliditylang.org/bin/list.json | grep -E "0.4.17\+commit" | head -5
curl -s https://binaries.soliditylang.org/bin/list.json | grep -E "0.4.26" | head -5
curl -s https://binaries.soliditylang.org/bin/list.json | grep -E "0.4.26\+commit" | head -5
curl -I https://binaries.soliditylang.org/bin/soljson-v0.4.26+commit.4563c3fc.js
curl -I https://binaries.soliditylang.org/bin/soljson-v0.4.17+commit.bdeb9e52.js
curl -s https://binaries.soliditylang.org/bin/list.json | head -20
curl -s https://binaries.soliditylang.org/bin/list.json | tail -20
curl -s https://binaries.soliditylang.org/bin/list.json | grep -A 1 -B 1 "0.4.26"
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
docker-compose -f /root/mainnet-indexer/docker-compose.yml ps
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=50 indexer | grep -i "compiler"
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=20 indexer
curl -s http://localhost:3000/health | jq
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=100 indexer | grep -i "compiler\|releases"
grep -A 5 "solc" /root/mainnet-indexer/package.json
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=20 indexer
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=100 indexer | grep -i "compiler\|version\|0.4.26"
curl -I https://binaries.soliditylang.org/bin/soljson-0.4.26.js
curl -I https://binaries.soliditylang.org/bin/soljson-0.4.26+commit.4563c3fc.js
curl -s https://binaries.soliditylang.org/bin/list.json | grep -A 2 "0.4.26"
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=20 indexer
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=100 indexer | grep -i "evm\|version\|0.4.17"
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
docker-compose -f /root/mainnet-indexer/docker-compose.yml logs --tail=20 indexer
cd /root/frontend-contract-interaction-guide.md
ls
rm -rf /root/frontend-contract-interaction-guide.md
ls
rm -rf frontend-integration-guide-complete.md
ls
cat /root/mainnet-indexer/src/services/api/contracts.ts
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
node /root/mainnet-indexer/test-contract-verification.js
curl -X GET http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/verified
curl -X GET http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/abi
curl -X GET http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/source
curl -X POST -H "Content-Type: application/json" -d '{"method":"getValue","params":[]}' http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/interact
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified
docker-compose logs -f indexer | grep -i error
cd /root/mainnet-indexer && docker-compose logs -f indexer | grep -i error
cd "/root"
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source
docker-compose exec postgres psql -U postgres -d studio_indexer -c "SELECT verified, source_code, abi FROM contracts WHERE address = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E'"
cd /root/mainnet-indexer && docker-compose exec postgres psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM contracts WHERE address = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E'"
cd "/root"
cd /root/mainnet-indexer && docker-compose logs indexer | grep -i "contract is not verified"
cd "/root"
cd /root/mainnet-indexer && docker-compose logs indexer | tail -n 50
cd "/root"
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified
cd /root && ./mainnet-indexer/rebuild-and-restart.sh
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source
curl -X POST -H "Content-Type: application/json" -d '{"method":"getValue","params":[]}' http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/interact
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified
cd /root/mainnet-indexer && docker-compose exec postgres psql -U postgres -d studio_indexer -c "SELECT verified, source_code IS NOT NULL AS has_source, abi IS NOT NULL AS has_abi FROM contracts WHERE address = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E'"
cd "/root"
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E
cd /root/mainnet-indexer && docker-compose exec -T indexer node /app/remove-verification.js
cd "/root"
cd /root/mainnet-indexer && docker cp /root/remove-verification.js mainnet-indexer_indexer_1:/app/
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer node /app/remove-verification.js
cd "/root"
cd /root/mainnet-indexer && docker cp /root/remove-verification.js mainnet-indexer_indexer_1:/app/ && docker-compose exec indexer node /app/remove-verification.js
cd "/root"
cd /root/mainnet-indexer && docker cp /root/remove-verification.js mainnet-indexer_indexer_1:/app/ && docker-compose exec indexer node /app/remove-verification.js
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'postgres', port: 5432, database: 'studio_indexer_new', user: 'new_user', password: 'new_strong_password' }); (async () => { try { const result = await pool.query('SELECT address FROM contracts LIMIT 10'); console.log(result.rows); } catch (err) { console.error(err); } finally { await pool.end(); } })();"
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer env | grep DB_
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'postgres', port: 5432, database: 'studio_indexer_new', user: 'new_user', password: 'new_strong_password' }); (async () => { try { const result = await pool.query('SELECT COUNT(*) FROM contracts WHERE address ILIKE $1', ['%0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E%']); console.log(result.rows[0]); } catch (err) { console.error(err); } finally { await pool.end(); } })();"
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'postgres', port: 5432, database: 'studio_indexer_new', user: 'new_user', password: 'new_strong_password' }); (async () => { try { const result = await pool.query('SELECT COUNT(*) FROM contracts WHERE address = $1', ['0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E']); console.log(result.rows[0]); } catch (err) { console.error(err); } finally { await pool.end(); } })();"
cd "/root"
curl -X GET http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E
cd /root && npm install axios && node verify-contract.js
cd /root && node verify-contract.js
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source" | head -n 20
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verification" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi" | jq
ls
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source" | head -n 5
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verification" 2>/dev/null || echo "Endpoint not found"
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E" | jq
chmod +x mainnet-indexer/test-contract-verification-details.js
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
cd /root/mainnet-indexer && node test-contract-verification-details.js
cd "/root"
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verification" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E" | jq
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verification" | jq
cd /root/mainnet-indexer && node test-contract-verification-details.js
cd "/root"
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transactions" | head -n 20
curl -s "http://localhost:3000/address/0x846c234adc6d8e74353c0c355b0c2b6a1e46634f/transactions" | head -n 20
curl -s "http://localhost:3000/address/0x846c234adc6d8e74353c0c355b0c2b6a1e46634f/token-transfers" | head -n 20
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/events" | head -n 20
curl -s "http://localhost:3000/transactions/0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46" | jq
chmod +x mainnet-indexer/test-transaction-decoding.js
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
cd /root/mainnet-indexer && node test-transaction-decoding.js
cd "/root"
curl -s "http://localhost:3000/transactions/0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46/decoded" | jq
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
cd /root/mainnet-indexer && node test-transaction-decoding.js
curl -s "http://localhost:3000/transactions/0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46/decoded" | jq
cd "/root"
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers" | head -n 20
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/transactions" | head -n 20
curl -s "https://mainnetindexer.studio-blockchain.com/transactions/0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46/decoded" | head -n 20
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/tokens" | head -n 20
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers?tokenAddress=0xfccc20bf4f0829e121bc99ff2222456ad4465a1e" | head -n 20
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/transactions" | grep -i "0xa9059cbb" | head -n 5
curl -s "https://mainnetindexer.studio-blockchain.com/transactions/0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19/decoded" | jq
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/transactions" | grep -i "0xa9059cbb" | wc -l
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/transactions" | grep -c "0xa9059cbb"
curl -s "https://mainnetindexer.studio-blockchain.com/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/transactions" > /tmp/transactions.json && cat /tmp/transactions.json | grep -o "0xa9059cbb" | wc -l
cat /tmp/transactions.json | grep -o '"hash":"[^"]*".*"data":"0xa9059cbb[^"]*"' | grep -o '"hash":"[^"]*"' | cut -d'"' -f4
curl -s "https://mainnetindexer.studio-blockchain.com/transactions/0x7c5258e49968bb21de11161b968480162ca391ad0615b221244851126d2ac4e3/decoded" | jq
cat /tmp/transactions.json | grep -o '"hash":"[^"]*".*"data":"0x095ea7b3[^"]*"' | grep -o '"hash":"[^"]*"' | cut -d'"' -f4
cat /tmp/transactions.json | grep -o "0x095ea7b3" | wc -l
cat /tmp/transactions.json | grep -o '"hash":"[^"]*"' | head -n 5 | cut -d'"' -f4
clear
cd /root/mainnet-indexer && grep -r "getAddressTokenTransfers" --include="*.ts" .
cd "/root"
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers" | head -n 20
docker exec mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM token_transfers;"
docker exec -it mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM token_transfers;"
cat /root/mainnet-indexer/docker-compose.yml
docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
docker logs mainnet-indexer_indexer_1 | tail -n 20
docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM transactions;"
docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_balances;"
docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_balances;"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i error | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM transactions WHERE \"to\" = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d transactions"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM transactions WHERE to_address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d token_transfers"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM pg_indexes WHERE tablename = 'token_transfers';"
cd "/root"
cd /root/mainnet-indexer && ./apply-migration.sh 011_add_token_transfers_unique_constraint.sql
cd "/root"
cd /root/mainnet-indexer && chmod +x apply-token-transfers-migration.sh && ./apply-token-transfers-migration.sh
cd "/root"
sleep 30 && cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | tail -n 50
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions WHERE to_address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e' ORDER BY block_number DESC LIMIT 5;"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getTokenTransfersFromReceipt" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processTokenTransfers" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions WHERE hash = '0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46';"
cd "/root"
cd /root/mainnet-indexer && node -e "console.log('0x095ea7b3'.substring(2) + ' = ' + Buffer.from('approve(address,uint256)').toString('hex').substring(0, 8))"
cd "/root"
cd /root/mainnet-indexer && node -e "console.log('0x' + require('web3-utils').keccak256('approve(address,uint256)').substring(2, 10))"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions WHERE hash = '0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_transfers WHERE transaction_hash = '0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions WHERE hash = '0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_transfers WHERE transaction_hash = '0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19';"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); provider.getTransactionReceipt('0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19').then(receipt => console.log(JSON.stringify(receipt, null, 2)));"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); provider.getTransactionReceipt('0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19').then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(error => console.error('Error:', error));"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "error" | grep -i "token" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\dt"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM pg_indexes WHERE tablename = 'token_transfers';"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getTokenTransfersFromReceipt" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processTokenTransfers" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processed transaction" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processing block" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM transactions WHERE block_number > 216470;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM blocks WHERE number > 216470;"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); provider.getBlockWithTransactions(216490).then(block => console.log(JSON.stringify({ number: block.number, transactions: block.transactions.length }, null, 2)));"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); provider.getBlockWithTransactions(178978).then(block => console.log(JSON.stringify({ number: block.number, transactions: block.transactions.length }, null, 2)));"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM blocks WHERE number = 178978;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d blocks"
cd "/root"
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
cd /root/mainnet-indexer && ./apply-token-transfers-migration.sh
cd "/root"
sleep 30 && cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT number, transactions_count FROM blocks WHERE number = 178978;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "UPDATE blocks SET transactions_count = (SELECT COUNT(*) FROM transactions WHERE block_number = 178978) WHERE number = 178978;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT number, transactions_count FROM blocks WHERE number = 178978;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_transfers WHERE transaction_hash = '0x2299f76dff8e9dc0e68387cb4e8fcc4dd5afaa39a3601b5575aee51906b80c19';"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processTokenTransfers" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getTransactionReceipt" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "insertTokenTransfer" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getBlockWithTransactions" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processBlocks" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processed transaction" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "insertTransaction" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "insertBlock" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getLatestBlockNumber" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getLatestBlock" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "start" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processing block" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_transfers ORDER BY id DESC LIMIT 5;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions ORDER BY block_number DESC LIMIT 5;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions WHERE hash = '0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT number FROM blocks ORDER BY number DESC LIMIT 1;"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); provider.getTransaction('0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d').then(tx => console.log(JSON.stringify({ blockNumber: tx.blockNumber }, null, 2)));"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM blocks WHERE number = 216632;"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d token_transfers"
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
cd /root/mainnet-indexer && ./apply-token-transfers-migration.sh
cd "/root"
sleep 30 && cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_transfers WHERE transaction_hash = '0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d';"
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/transactions/0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d | jq
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/transactions/0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d/decoded | jq
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/address/0x846c234adc6d8e74353c0c355b0c2b6a1e46634f/token-transfers | jq
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/address/0x188Ed01066D35CF6CE9E68c8289bAbb37e5bC219/token-transfers | jq
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/tokens/0xfccc20bf4f0829e121bc99ff2222456ad4465a1e/transfers | jq
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/address/0x846c234adc6d8e74353c0c355b0c2b6a1e46634f/tokens | jq
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/address/0x188Ed01066D35CF6CE9E68c8289bAbb37e5bC219/tokens | jq
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM token_balances WHERE token_address = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "insertTokenTransfer" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processTokenTransfers" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getTokenTransfersFromReceipt" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "token_transfers" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getTokenTransfersFromReceipt" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); provider.getTransactionReceipt('0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d').then(receipt => console.log(JSON.stringify(receipt, null, 2)));"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); const erc20Interface = new ethers.utils.Interface(['function transfer(address to, uint256 value)']); provider.getTransaction('0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d').then(tx => { const decodedData = erc20Interface.decodeFunctionData('transfer', tx.data); console.log(JSON.stringify({ to: decodedData.to, value: decodedData.value.toString() }, null, 2)); });"
cd "/root"
cd /root/mainnet-indexer && node -e "const { blockchain } = require('./dist/services/blockchain'); const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); provider.getTransactionReceipt('0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d').then(receipt => blockchain.getTokenTransfersFromReceipt(receipt).then(transfers => console.log(JSON.stringify(transfers, null, 2))));"
cd "/root"
cd /root/mainnet-indexer && node -e "const { ethers } = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://mainnet.studio-blockchain.com'); const erc20Interface = new ethers.utils.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']); provider.getTransactionReceipt('0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d').then(receipt => { const transfers = receipt.logs.map(log => { try { if (log.topics[0] === erc20Interface.getEventTopic('Transfer')) { const parsedLog = erc20Interface.parseLog(log); return { tokenAddress: log.address, from: parsedLog.args.from, to: parsedLog.args.to, value: parsedLog.args.value.toString(), tokenType: 'ERC20' }; } } catch (e) {} return null; }).filter(Boolean); console.log(JSON.stringify(transfers, null, 2)); });"
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "processTokenTransfers" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "getTokenTransfersFromReceipt" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d" | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "insertTokenTransfer" | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "token_transfers" | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 20
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
cd "/root"
cd /root/mainnet-indexer && docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT * FROM transactions WHERE hash = '0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d';"
cd "/root"
cd /root/mainnet-indexer && node -e "const { blockchain } = require('./dist/services/blockchain'); console.log(Object.keys(blockchain));"
curl -s "https://indexermainnet.studio-blockchain.com/transactions/0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46/decoded" | jq
ls
ls -la /root/mainnet-indexer
ps aux | grep node
netstat -tuln | grep 3000
ss -tuln | grep 3000
curl -s http://localhost:3000/health | jq
curl -s "http://localhost:3000/tokens?type=ERC20&limit=5" | jq
curl -s "http://localhost:3000/tokens/0xfccc20bf4f0829e121bc99ff2222456ad4465a1e/transfers?limit=5" | jq
curl -s "http://localhost:3000/address/0x846c234adc6d8e74353c0c355b0c2b6a1e46634f/token-transfers?tokenType=ERC20&limit=5" | jq
curl -s "http://localhost:3000/transactions?limit=5" | jq
curl -s "http://localhost:3000/transactions/0x315b077abac00e0a3fb5ac1133bf4dfefe0f15ab7fa9a37326185c18f8a85292/decoded" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/tokens" | jq
curl -s "http://localhost:3000/stats/contracts/erc20/count" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers?tokenType=ERC20&limit=5" | jq
curl -s "http://localhost:3000/stats/contracts/count" | jq
curl -s "http://localhost:3000/tokens/0xfccc20bf4f0829e121bc99ff2222456ad4465a1e" | jq
curl -s "http://localhost:3000/tokens/0xfccc20bf4f0829e121bc99ff2222456ad4465a1e/holders" | jq
cat /root/mainnet-indexer/migrations/006_token_balances_trigger.sql
grep -r "CREATE TABLE token_transfers" /root/mainnet-indexer/migrations/
find /root/mainnet-indexer/migrations/ -type f -name "*.sql" | xargs grep -l "token_transfers"
cat /root/mainnet-indexer/migrations/002_token_transfers.sql
cat /root/mainnet-indexer/migrations/011_add_token_transfers_unique_constraint.sql
docker exec -it mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM token_transfers;"
ls -la /root/mainnet-indexer/logs/
tail -n 100 /root/mainnet-indexer/error.log
tail -n 100 /root/mainnet-indexer/combined.log
grep -A 20 "getTokenTransfersFromReceipt" /root/mainnet-indexer/src/services/blockchain/tokens.ts
grep -A 20 "ERC20_ABI" /root/mainnet-indexer/src/services/blockchain/abis.ts
grep -A 50 "processTokenTransfers" /root/mainnet-indexer/src/services/indexer.ts
grep -A 50 "if (log.topics\[0\] === erc20TransferTopic)" /root/mainnet-indexer/src/services/blockchain/tokens.ts
grep -r "Error processing token transfer" /root/mainnet-indexer/logs/
grep -r "token transfer" /root/mainnet-indexer/logs/
grep -r "ERC20" /root/mainnet-indexer/logs/
curl -s "http://localhost:3000/transactions/0x315b077abac00e0a3fb5ac1133bf4dfefe0f15ab7fa9a37326185c18f8a85292/receipt" | jq
curl -s "http://localhost:3000/transactions?limit=20" | jq '[.[] | {hash: .hash, to: .to, from: .from, data: .data}]'
curl -s "http://localhost:3000/transactions/0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d/receipt" | jq
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
cd /root && node test-token-transfers.js
find /root/mainnet-indexer -name "*.js" | grep -i test
cd /root && node test-token-transfers.js
cat /root/mainnet-indexer/apply-token-transfers-migration.sh
cat /root/mainnet-indexer/apply-all-migrations.sh
docker exec -it mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "\d token_transfers"
cd /root && node apply-token-transfers-migration-to-current-db.js
cd /root && npm install pg
cd /root && node apply-token-transfers-migration-to-current-db.js
cd /root && node fix-token-transfers.js
docker restart mainnet-indexer_indexer_1
sleep 10 && curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
cd /root && npm install ethers
cd /root && node process-token-transfer.js
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=1" | jq
docker ps | grep indexer
docker logs mainnet-indexer_indexer_1 | grep -i error | tail -n 20
docker exec -it mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "CREATE UNIQUE INDEX IF NOT EXISTS idx_token_transfers_unique ON token_transfers(transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''));"
cd /root/mainnet-indexer && docker-compose build indexer && docker-compose up -d indexer
cd "/root"
docker restart mainnet-indexer_indexer_1
docker ps
cd /root/mainnet-indexer && docker-compose up -d
cd "/root"
cd /root/mainnet-indexer && npm install && npm run build && npm start
cd "/root"
cd /root/mainnet-indexer && sh apply-token-transfers-migration.sh
cd "/root"
cd /root/mainnet-indexer && docker-compose up -d
cd "/root"
cd /root/mainnet-indexer && sh rebuild-and-restart.sh
cd "/root"
docker ps
sleep 10 && curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
docker logs mainnet-indexer_indexer_1 | grep -i error | tail -n 20
docker logs mainnet-indexer_indexer_1 | tail -n 50
docker exec -it mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM token_transfers;"
cd /root && node process-token-transfer.js
curl -s "http://localhost:3000/stats/tps" | jq
curl -s "http://localhost:3000/transactions/0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d" | jq
docker exec -it mainnet-indexer_indexer_1 curl -s "http://localhost:3000/stats/tps" | jq
chmod +x /root/scan-past-blocks.js
cd /root && node scan-past-blocks.js 216632 216642 2
chmod +x /root/scan-past-blocks-docker.js
cd /root && node scan-past-blocks-docker.js 100000 100010 2
cd /root && node scan-past-blocks-docker.js 100000 200000 50
chmod +x /root/scan-past-blocks-quiet.js
cd /root && node scan-past-blocks-quiet.js 100000 200000 50
cd /root && node scan-past-blocks-quiet.js 216600 216700 10
chmod +x /root/scan-specific-blocks.js
cd /root && node scan-specific-blocks.js
cat /root/token-transfers-specific.json | head -n 5
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/tokens" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers" | jq
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/holders" | jq
curl -s "http://localhost:3000/account/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/balances" | jq
curl -s "http://localhost:3000/transactions/0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d" | jq
curl -s "http://localhost:3000/transactions/0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d/decoded" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified" | jq
curl -s "http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi" | jq
grep -r "token-transfers" /root/mainnet-indexer
grep -r "transfers" --include="*.ts" /root/mainnet-indexer/src/services/api
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers?limit=5" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/nft-transfers?limit=5" | jq
grep -r "CREATE TABLE token_transfers" /root/mainnet-indexer/migrations
find /root/mainnet-indexer/migrations -type f -name "*.sql" | xargs grep -l "token_transfers"
grep -r "admin/token-transfers" /root/mainnet-indexer
grep -r "insertTokenTransfer" /root/mainnet-indexer
cd /root/mainnet-indexer && ./rebuild-and-restart.sh
cd "/root"
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
docker exec -it mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM token_transfers;"
cat /root/mainnet-indexer/docker-compose.yml
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_balances;"
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/holders" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers?limit=5" | jq
docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 20
docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 20
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "\d token_transfers"
node /root/fix-token-transfers.js
docker restart mainnet-indexer_indexer_1
sleep 5 && docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
docker logs mainnet-indexer_indexer_1 | grep -i "processing block" | tail -n 5
cat /root/mainnet-indexer/src/services/database/tokens.ts | grep -A 20 "insertTokenTransfer"
docker logs mainnet-indexer_indexer_1 | grep -i "error" | grep -i "token_transfers" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "syntax error" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "sql" | grep -i "error" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 10
docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "processed transaction" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "processed up to block" | tail -n 5
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM transactions;"
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
docker logs mainnet-indexer_indexer_1 | grep -i "token transfers from receipt" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "processing token transfers" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "insert token transfer" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "token transfer" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "transfers from receipt" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "process token" | tail -n 5
cat /root/mainnet-indexer/src/services/database/tokens.ts | grep -A 20 "insertTokenTransfer"
node /root/fix-token-transfers-properly.js
docker restart mainnet-indexer_indexer_1
sleep 5 && docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
docker logs mainnet-indexer_indexer_1 | grep -i "processed up to block" | tail -n 5
docker logs mainnet-indexer_indexer_1 | grep -i "error" | tail -n 10
docker logs --since 1m mainnet-indexer_indexer_1 | grep -i "token transfer"
docker logs --since 5m mainnet-indexer_indexer_1 | grep -i "token transfer"
ls
cd mainnet-indexer
ls
./reset-indexer.sh
cd ..
ls
rm -rf apply-token-transfers-migration-to-current-db.js
lsfix-token-transfers.js
rm -rf fix-token-transfers.js
rm -rf fix-token-transfers-properly.js
rm -rf process-token-transfer.js
rm -rf scan-past-blocks-docker.js
rm -rf scan-past-blocks.js
rm -rf scan-past-blocks-quiet.js
rm -rf scan-specific-blocks.js
rm -rf test-token-transfers.js
rm -rf verify-contract.js
clear
ls
rm -rf get_all_transactions.js
rm -rf get_total_transactions.js
ls
clear
ls
rm -rf check-balance.js
rm -rf indexer-analysis.md
rm -rf remove-verification.js
rm -rf token-transfers-specific.json
rm -rf token-transfers.json
ls
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "SELECT COUNT(*) FROM token_transfers;"
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers?limit=5" | jq
curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/tokens" | jq
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/holders?limit=5" | jq
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/holders-count" | jq
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/holders-count"
curl -i https://mainneindexer.studio-blockchain.com/health
curl -i https://mainnetindexer.studio-blockchain.com/health
curl -i https://mainnetindexer.studio-blockchain.com/contracts/verify -X OPTIONS
curl -i https://mainnetindexer.studio-blockchain.com/contracts/verify -X POST -H "Content-Type: application/json" -d '{"address":"0x1234567890123456789012345678901234567890"}'
curl -i https://api.etherscan.io/api?module=contract&action=getabi&address=0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413
curl -s https://raw.githubusercontent.com/NomicFoundation/hardhat/main/packages/hardhat-verify/README.md | grep -A 20 "Custom networks"
curl -s https://raw.githubusercontent.com/NomicFoundation/hardhat/main/packages/hardhat-verify/src/etherscan/EtherscanVerifyContractRequest.ts | head -n 50
curl -s https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify | grep -A 20 "Custom networks"
curl -s https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify
curl -i https://mainnetindexer.studio-blockchain.com/api/contract/verify -X OPTIONS
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","contractName":"StudioPresale","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","evmVersion":"cancun"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","evmVersion":"london"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","evmVersion":"berlin"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","evmVersion":"istanbul"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale"}'
mkdir -p /root/verify-contract && cd /root/verify-contract && npm init -y && npm install --save-dev hardhat @nomicfoundation/hardhat-verify @nomicfoundation/hardhat-ethers
cd "/root"
cd /root/verify-contract && npx hardhat init
cd "/root"
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","evmVersion":"paris"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","evmVersion":"byzantium"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\nimport \"../security/ReentrancyGuard.sol\";\nimport \"../security/Pausable.sol\";\nimport \"../security/Ownable.sol\";\nimport \"../interfaces/IERC20.sol\";\nimport \"../ERC20SafeFixed.sol\";\n\ncontract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed { /* Contract code omitted for brevity */ }","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale"}'
curl -i -X OPTIONS https://mainnetindexer.studio-blockchain.com/contracts/verify
curl -i https://mainnetindexer.studio-blockchain.com/contracts/0xe0ae105f3a9Dcd740949A73597Fc397F8F208871/verified
curl -i https://mainnetindexer.studio-blockchain.com/contracts/0xEf66f88082c592F30357AB648CA0d4e26b009A46/verified
curl -i https://mainnetindexer.studio-blockchain.com/contracts/0x7FD526dC3d193a3dA6C330956813A6B358BCA1Ff/verified
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\n// Full contract code would go here","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","constructorArguments":"0x000000000000000000000000fccc20bf4f0829e121bc99ff2222456ad4465a1e000000000000000000000000000000000000000000000000000000000000ea600000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000000001176592e000000000000000000000000000000000000000000000108b2a2c28029094000000","evmVersion":"istanbul"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\n// Full contract code would go here","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","constructorArguments":"0x000000000000000000000000fccc20bf4f0829e121bc99ff2222456ad4465a1e000000000000000000000000000000000000000000000000000000000000ea600000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000000001176592e000000000000000000000000000000000000000000000108b2a2c28029094000000"}'
curl -i -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\n// Full contract code would go here","compilerVersion":"0.8.0","optimizationUsed":true,"runs":200,"contractName":"StudioPresale","constructorArguments":"0x000000000000000000000000fccc20bf4f0829e121bc99ff2222456ad4465a1e000000000000000000000000000000000000000000000000000000000000ea600000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000000001176592e000000000000000000000000000000000000000000000108b2a2c28029094000000","evmVersion":"london"}'
curl -i https://mainnetindexer.studio-blockchain.com/contracts/0xe0ae105f3a9Dcd740949A73597Fc397F8F208871
curl -i https://mainnetindexer.studio-blockchain.com/contracts/0xe0ae105f3a9Dcd740949A73597Fc397F8F208871/abi
clear
chmod +x /root/apply-verification-fix.sh
./apply-verification-fix.sh
find /root/mainnet-indexer -name "*.sh" | grep -i restart
find /root/mainnet-indexer -type d -name "contracts" | grep -v "node_modules"
find /root/mainnet-indexer -type d -name "verification" | grep -v "node_modules"
ls -la /root/mainnet-indexer/src/services/verification
find /root -name "*.sol" | grep -v "node_modules"
find /root/mainnet-indexer -name "test*" | grep -v "node_modules"
rm /root/verify-studio-contracts.js
cat /root/apply-verification-fix.sh
./apply-verification-fix.sh
docker-compose logs -f
cd /root/mainnet-indexer && docker-compose logs -f
cd "/root"
cat /root/mainnet-indexer/docker-compose.yml
curl -i http://localhost:3000/health
curl -i -X OPTIONS http://localhost:3000/contracts/verify
curl -i http://localhost:3000/contracts/0xe0ae105f3a9Dcd740949A73597Fc397F8F208871/verified
curl -i -X POST -H "Content-Type: application/json" http://localhost:3000/contracts/verify -d '{"address":"0xe0ae105f3a9Dcd740949A73597Fc397F8F208871","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\ncontract SimpleStorage {\n    uint256 private value;\n    \n    event ValueChanged(uint256 newValue);\n    \n    constructor(uint256 initialValue) {\n        value = initialValue;\n    }\n    \n    function setValue(uint256 newValue) public {\n        value = newValue;\n        emit ValueChanged(newValue);\n    }\n    \n    function getValue() public view returns (uint256) {\n        return value;\n    }\n}","compilerVersion":"0.8.0","contractName":"SimpleStorage","optimizationUsed":true,"runs":200}'
curl -i -X POST -H "Content-Type: application/json" http://localhost:3000/contracts/verify -d '{"address":"0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E","sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity 0.8.0;\n\ncontract SimpleStorage {\n    uint256 private value;\n    \n    event ValueChanged(uint256 newValue);\n    \n    constructor(uint256 initialValue) {\n        value = initialValue;\n    }\n    \n    function setValue(uint256 newValue) public {\n        value = newValue;\n        emit ValueChanged(newValue);\n    }\n    \n    function getValue() public view returns (uint256) {\n        return value;\n    }\n}","compilerVersion":"0.8.0","contractName":"SimpleStorage","optimizationUsed":true,"runs":200}'
ls
find mainnet-indexer -type f -name "*.ts" | grep -v "node_modules" | sort
ls
tar -czvf mainnetbackup9apr.tar.gz /root/mainnet-indexer
tar --exclude='/root/mainnet-indexer/node_modules' -czvf mainnetbackup9apr.tar.gz /root/mainnet-indexer
ls
cd mainnet-indexer && npm run build
cd "/root"
find mainnet-indexer -name "Dockerfile" -o -name "docker-compose.yml"
find mainnet-indexer/scripts -type f | grep -v "node_modules"
find mainnet-indexer/migrations -type f | sort
chmod +x mainnet-indexer/rebuild-and-test.sh
./mainnet-indexer/rebuild-and-test.sh
ls
tar -xzf /root/uniswap-v3-contracts-for-verification.tar.gz -C /root
ls -la /root
ls -la /root/archive-for-verification
chmod +x /root/run-verification.sh
/root/run-verification.sh
clear
ls
cd verify-contract
ls
cd ..
rm -rf verify-contract
rm -rf verify-uniswap-contracts.js
ls
rm -rf uniswap-imports
rm -rf archive-for-verification
rm -rf uniswap-v3-contracts-for-verification.tar.gz
rm -rf verify-uniswap-with-imports.js
rm -rf verify-uniswap-contracts.js
clear
ls
rm -rf modified-contracts
rm -rf run-verification.sh
rm -rf verification-fix-summary.md
rm -rf verification.log
rm -rf verification-guide-updated.md
ls
ls -la
mkdir -p uniswap-v3-contracts && tar -xzf uniswap-v3-contracts-for-verification.tar.gz -C uniswap-v3-contracts
find uniswap-v3-contracts -type f | sort
curl -s http://localhost:3000/health || echo "API server not running"
node verify-uniswap-factory.js
find /root/mainnet-indexer -type f -name "*.js" | grep -i verify
find /root/mainnet-indexer -maxdepth 2 -type f | grep -v "node_modules"
cat /root/mainnet-indexer/README-CONTRACT-VERIFICATION.md
cat /root/mainnet-indexer/test-contract-verification.js
ls -la /root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/
head -n 20 /root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/UniswapV3Factory.sol
find /root/mainnet-indexer/src -type f -name "*.ts" | grep -i verif
find /root/mainnet-indexer/src -type f -name "*.ts" | grep -i blockchain
find /root/mainnet-indexer/src/services/database -type f -name "*.ts" | grep -i contract
ls -la /root/uniswap-v3-contracts/v3-core/contracts/
find /root/uniswap-v3-contracts -type d | sort
ls -la /root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/
curl -s http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805 | jq
curl -s http://localhost:3000/blockchain/code/0x6f1aF63eb91723a883c632E38D34f2cB6090b805 | jq
curl -s http://localhost:3000/blockchain/code/0x6f1aF63eb91723a883c632E38D34f2cB6090b805
curl -s http://localhost:3000/api-docs
curl -s http://localhost:3000/
find /root/mainnet-indexer/src/services/api -type f -name "*.ts" | xargs ls -la
ps aux | grep node
cd /root/mainnet-indexer && npm start
cd "/root"
find /root/mainnet-indexer -name "*.env*" -o -name "config*.json"
docker ps
curl -s http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805
curl -s http://localhost:3000/blockchain/code/0x6f1aF63eb91723a883c632E38D34f2cB6090b805
grep -r "app.get('/blockchain" /root/mainnet-indexer/src/services/api/
grep -r "getCode" /root/mainnet-indexer/src/services/api/
grep -r "app.post('/contracts/verify" /root/mainnet-indexer/src/services/api/
node verify-uniswap-factory-improved.js
rm /root/verify-uniswap-factory-improved.js
curl -s http://localhost:3000/contracts/verify -X OPTIONS
grep -A 50 "verifyContract" /root/mainnet-indexer/src/services/api/contracts-verification.ts
ls -la /root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/IUniswapV3Factory.sol
node /root/verify-uniswap-factory-new.js
ls -la /root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/ 2>/dev/null || echo "Directory does not exist"
node /root/verify-uniswapv3-factory.js
node /root/verify-uniswapv3-factory.js
node /root/verify-uniswapv3-factory-simple.js
find /root -name "UniswapV3Factory.sol" -type f
node /root/verify-uniswapv3-factory-flattened.js
find /root -name "UniswapV3Factory.sol" -type f
ls
rm -rf uniswap-v3-contracts
rm -rf uniswap-v3-contracts-for-verification.tar.gz
clear
ls
tar -xvzf uniswap-v3-contracts-for-verification.tar.gz
clear
ls
cd archive-for-verification
ls
cd "/root"
ls -la /root/archive-for-verification
node /root/verify-uniswapv3-factory-fixed.js
find /root/mainnet-indexer -type f -name "*.js" | grep -i verify
find /root/mainnet-indexer -type f -name "*.js" | xargs grep -l "contract" | head -10
find /root/mainnet-indexer/src -type f | xargs grep -l "verify" | head -10
node /root/verify-uniswapv3-factory-proper.js
ls -la /root/archive-for-verification/manual-verification/UniswapV3Factory/
node /root/verify-uniswapv3-factory-manual.js
curl http://localhost:3000/health
curl http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805/verified
find /root/archive-for-verification -name "*.js" | grep -i verify
find /root -name "verify*.js" | head -10
node /root/verify-uniswapv3-factory-simple2.js
node /root/verify-uniswapv3-factory-json.js
rm /root/verify-*.js
ls -la /root/archive-for-verification
ls
rm -rf archive-for-verification
rm -rf uniswap-v3-contracts-for-verification.tar.gz
ls
clear
ls
mkdir -p /root/uniswap_extracted && tar -xzf /root/uniswap_contracts.tar.gz -C /root/uniswap_extracted
find /root/uniswap_extracted -type f -name "*.md" | sort
find /root/uniswap_extracted -type d | sort
find /root/uniswap_extracted -name "UniswapV3Factory.sol" -o -name "WSTO.sol" -o -name "SwapRouter.sol" -o -name "NFTDescriptor.sol" -o -name "NonfungibleTokenPositionDescriptor.sol" -o -name "NonfungiblePositionManager.sol"
find /root/uniswap_extracted -name "WSTO.sol" -o -name "WETH9.sol" -o -name "WETH.sol" -o -name "*ETH*.sol"
curl http://localhost:3000/health
find /root/uniswap_extracted -name "*.flat.sol" -o -name "*Flattened*.sol" -o -name "*flattened*.sol"
find /root/uniswap_extracted -type d -name "flattened"
find /root/uniswap_extracted -name "*verify*.js" -o -name "*verification*.js"
grep -n "import" /root/uniswap_extracted/uniswap_contracts/v3-core/UniswapV3Factory.sol
ls -la /root/uniswap_extracted/uniswap_contracts/v3-core/interfaces/IUniswapV3Factory.sol /root/uniswap_extracted/uniswap_contracts/v3-core/UniswapV3PoolDeployer.sol /root/uniswap_extracted/uniswap_contracts/v3-core/NoDelegateCall.sol /root/uniswap_extracted/uniswap_contracts/v3-core/UniswapV3Pool.sol
curl -X POST -H "Content-Type: application/json" -d '{
  "address": "0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0",
  "sourceCode": "// SPDX-License-Identifier: MIT\npragma solidity 0.7.6;\n\ncontract WETH9 {\n    string public name     = \"Wrapped STO\";\n    string public symbol   = \"WSTO\";\n    uint8  public decimals = 18;\n\n    event  Approval(address indexed src, address indexed guy, uint wad);\n    event  Transfer(address indexed src, address indexed dst, uint wad);\n    event  Deposit(address indexed dst, uint wad);\n    event  Withdrawal(address indexed src, uint wad);\n\n    mapping (address => uint)                       public  balanceOf;\n    mapping (address => mapping (address => uint))  public  allowance;\n\n    receive() external payable {\n        deposit();\n    }\n    function deposit() public payable {\n        balanceOf[msg.sender] += msg.value;\n        emit Deposit(msg.sender, msg.value);\n    }\n    function withdraw(uint wad) public {\n        require(balanceOf[msg.sender] >= wad);\n        balanceOf[msg.sender] -= wad;\n        msg.sender.transfer(wad);\n        emit Withdrawal(msg.sender, wad);\n    }\n\n    function totalSupply() public view returns (uint) {\n        return address(this).balance;\n    }\n\n    function approve(address guy, uint wad) public returns (bool) {\n        allowance[msg.sender][guy] = wad;\n        emit Approval(msg.sender, guy, wad);\n        return true;\n    }\n\n    function transfer(address dst, uint wad) public returns (bool) {\n        return transferFrom(msg.sender, dst, wad);\n    }\n\n    function transferFrom(address src, address dst, uint wad)\n        public\n        returns (bool)\n    {\n        require(balanceOf[src] >= wad);\n\n        if (src != msg.sender && allowance[src][msg.sender] != uint(-1)) {\n            require(allowance[src][msg.sender] >= wad);\n            allowance[src][msg.sender] -= wad;\n        }\n\n        balanceOf[src] -= wad;\n        balanceOf[dst] += wad;\n\n        emit Transfer(src, dst, wad);\n\n        return true;\n    }\n}",
  "compilerVersion": "0.7.6",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "",
  "contractName": "WETH9",
  "evmVersion": "istanbul"
}' http://localhost:3000/contracts/verify
curl -X POST -H "Content-Type: application/json" -d '{
  "address": "0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6",
  "sourceCode": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.7.0;\npragma abicoder v2;\n\nimport \"@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol\";\nimport \"@uniswap/v3-core/contracts/libraries/TickMath.sol\";\nimport \"@uniswap/v3-core/contracts/libraries/BitMath.sol\";\nimport \"@uniswap/v3-core/contracts/libraries/FullMath.sol\";\nimport \"@openzeppelin/contracts/utils/Strings.sol\";\nimport \"@openzeppelin/contracts/math/SafeMath.sol\";\nimport \"@openzeppelin/contracts/math/SignedSafeMath.sol\";\nimport \"base64-sol/base64.sol\";\nimport \"./HexStrings.sol\";\nimport \"./NFTSVG.sol\";\n\nlibrary NFTDescriptor {\n    using TickMath for int24;\n    using Strings for uint256;\n    using SafeMath for uint256;\n    using SafeMath for uint160;\n    using SafeMath for uint8;\n    using SignedSafeMath for int256;\n    using HexStrings for uint256;\n\n    uint256 constant sqrt10X128 = 1076067327063303206878105757264492625226;\n\n    struct ConstructTokenURIParams {\n        uint256 tokenId;\n        address quoteTokenAddress;\n        address baseTokenAddress;\n        string quoteTokenSymbol;\n        string baseTokenSymbol;\n        uint8 quoteTokenDecimals;\n        uint8 baseTokenDecimals;\n        bool flipRatio;\n        int24 tickLower;\n        int24 tickUpper;\n        int24 tickCurrent;\n        int24 tickSpacing;\n        uint24 fee;\n        address poolAddress;\n    }\n\n    function constructTokenURI(ConstructTokenURIParams memory params) public pure returns (string memory) {\n        string memory name = generateName(params, feeToPercentString(params.fee));\n        string memory descriptionPartOne =\n            generateDescriptionPartOne(\n                escapeQuotes(params.quoteTokenSymbol),\n                escapeQuotes(params.baseTokenSymbol),\n                addressToString(params.poolAddress)\n            );\n        string memory descriptionPartTwo =\n            generateDescriptionPartTwo(\n                params.tokenId.toString(),\n                escapeQuotes(params.baseTokenSymbol),\n                addressToString(params.quoteTokenAddress),\n                addressToString(params.baseTokenAddress),\n                feeToPercentString(params.fee)\n            );\n        string memory image = Base64.encode(bytes(generateSVGImage(params)));\n\n        return\n            string(\n                abi.encodePacked(\n                    \"data:application/json;base64,\",\n                    Base64.encode(\n                        bytes(\n                            abi.encodePacked(\n                                \"{\\\"name\\\":\\\"\",\n                                name,\n                                \"\\\", \\\"description\\\":\\\"\",\n                                descriptionPartOne,\n                                descriptionPartTwo,\n                                \"\\\", \\\"image\\\": \\\"\",\n                                \"data:image/svg+xml;base64,\",\n                                image,\n                                \"\\\"}\"\n                            )\n                        )\n                    )\n                )\n            );\n    }\n\n    function escapeQuotes(string memory symbol) internal pure returns (string memory) {\n        bytes memory symbolBytes = bytes(symbol);\n        uint8 quotesCount = 0;\n        for (uint8 i = 0; i < symbolBytes.length; i++) {\n            if (symbolBytes[i] == \"\\\"\") {\n                quotesCount++;\n            }\n        }\n        if (quotesCount > 0) {\n            bytes memory escapedBytes = new bytes(symbolBytes.length + (quotesCount));\n            uint256 index;\n            for (uint8 i = 0; i < symbolBytes.length; i++) {\n                if (symbolBytes[i] == \"\\\"\") {\n                    escapedBytes[index++] = \"\\\\\";\n                }\n                escapedBytes[index++] = symbolBytes[i];\n            }\n            return string(escapedBytes);\n        }\n        return symbol;\n    }\n\n    function generateDescriptionPartOne(\n        string memory quoteTokenSymbol,\n        string memory baseTokenSymbol,\n        string memory poolAddress\n    ) private pure returns (string memory) {\n        return\n            string(\n                abi.encodePacked(\n                    \"This NFT represents a liquidity position in a Uniswap V3 \",\n                    quoteTokenSymbol,\n                    \"-\",\n                    baseTokenSymbol,\n                    \" pool. \",\n                    \"The owner of this NFT can modify or redeem the position.\\\\n\",\n                    \"\\\\nPool Address: \",\n                    poolAddress,\n                    \"\\\\n\",\n                    quoteTokenSymbol\n                )\n            );\n    }\n\n    function generateDescriptionPartTwo(\n        string memory tokenId,\n        string memory baseTokenSymbol,\n        string memory quoteTokenAddress,\n        string memory baseTokenAddress,\n        string memory feeTier\n    ) private pure returns (string memory) {\n        return\n            string(\n                abi.encodePacked(\n                    \" Address: \",\n                    quoteTokenAddress,\n                    \"\\\\n\",\n                    baseTokenSymbol,\n                    \" Address: \",\n                    baseTokenAddress,\n                    \"\\\\nFee Tier: \",\n                    feeTier,\n                    \"\\\\nToken ID: \",\n                    tokenId,\n                    \"\\\\n\\\\n\",\n                    unicode\"⚠️ DISCLAIMER: Due diligence is imperative when assessing this NFT. Make sure token addresses match the expected tokens, as token symbols may be imitated.\"\n                )\n            );\n    }\n\n    function generateName(ConstructTokenURIParams memory params, string memory feeTier)\n        private\n        pure\n        returns (string memory)\n    {\n        return\n            string(\n                abi.encodePacked(\n                    \"Uniswap - \",\n                    feeTier,\n                    \" - \",\n                    escapeQuotes(params.quoteTokenSymbol),\n                    \"/\",\n                    escapeQuotes(params.baseTokenSymbol),\n                    \" - \",\n                    tickToDecimalString(\n                        !params.flipRatio ? params.tickLower : params.tickUpper,\n                        params.tickSpacing,\n                        params.baseTokenDecimals,\n                        params.quoteTokenDecimals,\n                        params.flipRatio\n                    ),\n                    \"<>\",\n                    tickToDecimalString(\n                        !params.flipRatio ? params.tickUpper : params.tickLower,\n                        params.tickSpacing,\n                        params.baseTokenDecimals,\n                        params.quoteTokenDecimals,\n                        params.flipRatio\n                    )\n                )\n            );\n    }\n\n    struct DecimalStringParams {\n        // significant figures of decimal\n        uint256 sigfigs;\n        // length of decimal string\n        uint8 bufferLength;\n        // ending index for significant figures (funtion works backwards when copying sigfigs)\n        uint8 sigfigIndex;\n        // index of decimal place (0 if no decimal)\n        uint8 decimalIndex;\n        // start index for trailing/leading 0\"s for very small/large numbers\n        uint8 zerosStartIndex;\n        // end index for trailing/leading 0\"s for very small/large numbers\n        uint8 zerosEndIndex;\n        // true if decimal number is less than one\n        bool isLessThanOne;\n        // true if string should include \"%\"\n        bool isPercent;\n    }\n\n    function generateDecimalString(DecimalStringParams memory params) private pure returns (string memory) {\n        bytes memory buffer = new bytes(params.bufferLength);\n        if (params.isPercent) {\n            buffer[buffer.length - 1] = \"%\";\n        }\n        if (params.isLessThanOne) {\n            buffer[0] = \"0\";\n            buffer[1] = \".\";\n        }\n\n        // add leading/trailing 0\"s\n        for (uint256 zerosCursor = params.zerosStartIndex; zerosCursor < params.zerosEndIndex.add(1); zerosCursor++) {\n            buffer[zerosCursor] = bytes1(uint8(48));\n        }\n        // add sigfigs\n        while (params.sigfigs > 0) {\n            if (params.decimalIndex > 0 && params.sigfigIndex == params.decimalIndex) {\n                buffer[params.sigfigIndex--] = \".\";\n            }\n            buffer[params.sigfigIndex--] = bytes1(uint8(uint256(48).add(params.sigfigs % 10)));\n            params.sigfigs /= 10;\n        }\n        return string(buffer);\n    }\n\n    function tickToDecimalString(\n        int24 tick,\n        int24 tickSpacing,\n        uint8 baseTokenDecimals,\n        uint8 quoteTokenDecimals,\n        bool flipRatio\n    ) internal pure returns (string memory) {\n        if (tick == (TickMath.MIN_TICK / tickSpacing) * tickSpacing) {\n            return !flipRatio ? \"MIN\" : \"MAX\";\n        } else if (tick == (TickMath.MAX_TICK / tickSpacing) * tickSpacing) {\n            return !flipRatio ? \"MAX\" : \"MIN\";\n        } else {\n            uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);\n            if (flipRatio) {\n                sqrtRatioX96 = uint160(uint256(1 << 192).div(sqrtRatioX96));\n            }\n            return fixedPointToDecimalString(sqrtRatioX96, baseTokenDecimals, quoteTokenDecimals);\n        }\n    }\n\n    function sigfigsRounded(uint256 value, uint8 digits) private pure returns (uint256, bool) {\n        bool extraDigit;\n        if (digits > 5) {\n            value = value.div((10**(digits - 5)));\n        }\n        bool roundUp = value % 10 > 4;\n        value = value.div(10);\n        if (roundUp) {\n            value = value + 1;\n        }\n        // 99999 -> 100000 gives an extra sigfig\n        if (value == 100000) {\n            value /= 10;\n            extraDigit = true;\n        }\n        return (value, extraDigit);\n    }\n\n    function adjustForDecimalPrecision(\n        uint160 sqrtRatioX96,\n        uint8 baseTokenDecimals,\n        uint8 quoteTokenDecimals\n    ) private pure returns (uint256 adjustedSqrtRatioX96) {\n        uint256 difference = abs(int256(baseTokenDecimals).sub(int256(quoteTokenDecimals)));\n        if (difference > 0 && difference <= 18) {\n            if (baseTokenDecimals > quoteTokenDecimals) {\n                adjustedSqrtRatioX96 = sqrtRatioX96.mul(10**(difference.div(2)));\n                if (difference % 2 == 1) {\n                    adjustedSqrtRatioX96 = FullMath.mulDiv(adjustedSqrtRatioX96, sqrt10X128, 1 << 128);\n                }\n            } else {\n                adjustedSqrtRatioX96 = sqrtRatioX96.div(10**(difference.div(2)));\n                if (difference % 2 == 1) {\n                    adjustedSqrtRatioX96 = FullMath.mulDiv(adjustedSqrtRatioX96, 1 << 128, sqrt10X128);\n                }\n            }\n        } else {\n            adjustedSqrtRatioX96 = uint256(sqrtRatioX96);\n        }\n    }\n\n    function abs(int256 x) private pure returns (uint256) {\n        return uint256(x >= 0 ? x : -x);\n    }\n\n    // @notice Returns string that includes first 5 significant figures of a decimal number\n    // @param sqrtRatioX96 a sqrt price\n    function fixedPointToDecimalString(\n        uint160 sqrtRatioX96,\n        uint8 baseTokenDecimals,\n        uint8 quoteTokenDecimals\n    ) internal pure returns (string memory) {\n        uint256 adjustedSqrtRatioX96 = adjustForDecimalPrecision(sqrtRatioX96, baseTokenDecimals, quoteTokenDecimals);\n        uint256 value = FullMath.mulDiv(adjustedSqrtRatioX96, adjustedSqrtRatioX96, 1 << 64);\n\n        bool priceBelow1 = adjustedSqrtRatioX96 < 2**96;\n        if (priceBelow1) {\n            // 10 ** 43 is precision needed to retreive 5 sigfigs of smallest possible price + 1 for rounding\n            value = FullMath.mulDiv(value, 10**44, 1 << 128);\n        } else {\n            // leave precision for 4 decimal places + 1 place for rounding\n            value = FullMath.mulDiv(value, 10**5, 1 << 128);\n        }\n\n        // get digit count\n        uint256 temp = value;\n        uint8 digits;\n        while (temp != 0) {\n            digits++;\n            temp /= 10;\n        }\n        // don\"t count extra digit kept for rounding\n        digits = digits - 1;\n\n        // address rounding\n        (uint256 sigfigs, bool extraDigit) = sigfigsRounded(value, digits);\n        if (extraDigit) {\n            digits++;\n        }\n\n        DecimalStringParams memory params;\n        if (priceBelow1) {\n            // 7 bytes ( \"0.\" and 5 sigfigs) + leading 0\"s bytes\n            params.bufferLength = uint8(uint8(7).add(uint8(43).sub(digits)));\n            params.zerosStartIndex = 2;\n            params.zerosEndIndex = uint8(uint256(43).sub(digits).add(1));\n            params.sigfigIndex = uint8(params.bufferLength.sub(1));\n        } else if (digits >= 9) {\n            // no decimal in price string\n            params.bufferLength = uint8(digits.sub(4));\n            params.zerosStartIndex = 5;\n            params.zerosEndIndex = uint8(params.bufferLength.sub(1));\n            params.sigfigIndex = 4;\n        } else {\n            // 5 sigfigs surround decimal\n            params.bufferLength = 6;\n            params.sigfigIndex = 5;\n            params.decimalIndex = uint8(digits.sub(5).add(1));\n        }\n        params.sigfigs = sigfigs;\n        params.isLessThanOne = priceBelow1;\n        params.isPercent = false;\n\n        return generateDecimalString(params);\n    }\n\n    // @notice Returns string as decimal percentage of fee amount.\n    // @param fee fee amount\n    function feeToPercentString(uint24 fee) internal pure returns (string memory) {\n        if (fee == 0) {\n            return \"0%\";\n        }\n        uint24 temp = fee;\n        uint256 digits;\n        uint8 numSigfigs;\n        while (temp != 0) {\n            if (numSigfigs > 0) {\n                // count all digits preceding least significant figure\n                numSigfigs++;\n            } else if (temp % 10 != 0) {\n                numSigfigs++;\n            }\n            digits++;\n            temp /= 10;\n        }\n\n        DecimalStringParams memory params;\n        uint256 nZeros;\n        if (digits >= 5) {\n            // if decimal > 1 (5th digit is the ones place)\n            uint256 decimalPlace = digits.sub(numSigfigs) >= 4 ? 0 : 1;\n            nZeros = digits.sub(5) < (numSigfigs.sub(1)) ? 0 : digits.sub(5).sub(numSigfigs.sub(1));\n            params.zerosStartIndex = numSigfigs;\n            params.zerosEndIndex = uint8(params.zerosStartIndex.add(nZeros).sub(1));\n            params.sigfigIndex = uint8(params.zerosStartIndex.sub(1).add(decimalPlace));\n            params.bufferLength = uint8(nZeros.add(numSigfigs.add(1)).add(decimalPlace));\n        } else {\n            // else if decimal < 1\n            nZeros = uint256(5).sub(digits);\n            params.zerosStartIndex = 2;\n            params.zerosEndIndex = uint8(nZeros.add(params.zerosStartIndex).sub(1));\n            params.bufferLength = uint8(nZeros.add(numSigfigs.add(2)));\n            params.sigfigIndex = uint8((params.bufferLength).sub(2));\n            params.isLessThanOne = true;\n        }\n        params.sigfigs = uint256(fee).div(10**(digits.sub(numSigfigs)));\n        params.isPercent = true;\n        params.decimalIndex = digits > 4 ? uint8(digits.sub(4)) : 0;\n\n        return generateDecimalString(params);\n    }\n\n    function addressToString(address addr) internal pure returns (string memory) {\n        return (uint256(addr)).toHexString(20);\n    }\n\n    function generateSVGImage(ConstructTokenURIParams memory params) internal pure returns (string memory svg) {\n        NFTSVG.SVGParams memory svgParams =\n            NFTSVG.SVGParams({\n                quoteToken: addressToString(params.quoteTokenAddress),\n                baseToken: addressToString(params.baseTokenAddress),\n                poolAddress: params.poolAddress,\n                quoteTokenSymbol: params.quoteTokenSymbol,\n                baseTokenSymbol: params.baseTokenSymbol,\n                feeTier: feeToPercentString(params.fee),\n                tickLower: params.tickLower,\n                tickUpper: params.tickUpper,\n                tickSpacing: params.tickSpacing,\n                overRange: overRange(params.tickLower, params.tickUpper, params.tickCurrent),\n                tokenId: params.tokenId,\n                color0: tokenToColorHex(uint256(params.quoteTokenAddress), 136),\n                color1: tokenToColorHex(uint256(params.baseTokenAddress), 136),\n                color2: tokenToColorHex(uint256(params.quoteTokenAddress), 0),\n                color3: tokenToColorHex(uint256(params.baseTokenAddress), 0),\n                x1: scale(getCircleCoord(uint256(params.quoteTokenAddress), 16, params.tokenId), 0, 255, 16, 274),\n                y1: scale(getCircleCoord(uint256(params.baseTokenAddress), 16, params.tokenId), 0, 255, 100, 484),\n                x2: scale(getCircleCoord(uint256(params.quoteTokenAddress), 32, params.tokenId), 0, 255, 16, 274),\n                y2: scale(getCircleCoord(uint256(params.baseTokenAddress), 32, params.tokenId), 0, 255, 100, 484),\n                x3: scale(getCircleCoord(uint256(params.quoteTokenAddress), 48, params.tokenId), 0, 255, 16, 274),\n                y3: scale(getCircleCoord(uint256(params.baseTokenAddress), 48, params.tokenId), 0, 255, 100, 484)\n            });\n\n        return NFTSVG.generateSVG(svgParams);\n    }\n\n    function overRange(\n        int24 tickLower,\n        int24 tickUpper,\n        int24 tickCurrent\n    ) private pure returns (int8) {\n        if (tickCurrent < tickLower) {\n            return -1;\n        } else if (tickCurrent > tickUpper) {\n            return 1;\n        } else {\n            return 0;\n        }\n    }\n\n    function scale(\n        uint256 n,\n        uint256 inMn,\n        uint256 inMx,\n        uint256 outMn,\n        uint256 outMx\n    ) private pure returns (string memory) {\n        return (n.sub(inMn).mul(outMx.sub(outMn)).div(inMx.sub(inMn)).add(outMn)).toString();\n    }\n\n    function tokenToColorHex(uint256 token, uint256 offset) internal pure returns (string memory str) {\n        return string((token >> offset).toHexStringNoPrefix(3));\n    }\n\n    function getCircleCoord(\n        uint256 tokenAddress,\n        uint256 offset,\n        uint256 tokenId\n    ) internal pure returns (uint256) {\n        return (sliceTokenHex(tokenAddress, offset) * tokenId) % 255;\n    }\n\n    function sliceTokenHex(uint256 token, uint256 offset) internal pure returns (uint256) {\n        return uint256(uint8(token >> offset));\n    }\n}",
  "compilerVersion": "0.7.6",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "",
  "contractName": "NFTDescriptor",
  "evmVersion": "istanbul"
}' http://localhost:3000/contracts/verify
mkdir -p /root/uniswap && cd /root/uniswap && git clone https://github.com/Uniswap/v3-core.git && git clone https://github.com/Uniswap/v3-periphery.git
cd "/root"
mkdir -p /root/verify-uniswap && cd /root/verify-uniswap && npm init -y
cd "/root"
cd /root/verify-uniswap && npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
cd "/root"
cd /root/verify-uniswap && npx hardhat
cd "/root"
solc --version
find /root/uniswap_extracted -name "*.flat.sol" -o -name "*Flattened*.sol" -o -name "*flattened*.sol"
find /root/uniswap -name "flattened" -type d
find /root/uniswap -name "*verify*.js" -o -name "*verification*.js"
find /root/uniswap -name "UniswapV3Factory*.sol"
ls -la /root/mainnet-indexer
curl http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805/verified
curl -X POST -H "Content-Type: application/json" -d '{
  "address": "0x6f1aF63eb91723a883c632E38D34f2cB6090b805",
  "sourceCode": "// SPDX-License-Identifier: BUSL-1.1\npragma solidity =0.7.6;\n\nimport \"./interfaces/IUniswapV3Factory.sol\";\n\nimport \"./UniswapV3PoolDeployer.sol\";\nimport \"./NoDelegateCall.sol\";\n\nimport \"./UniswapV3Pool.sol\";\n\n/// @title Canonical Uniswap V3 factory\n/// @notice Deploys Uniswap V3 pools and manages ownership and control over pool protocol fees\ncontract UniswapV3Factory is IUniswapV3Factory, UniswapV3PoolDeployer, NoDelegateCall {\n    /// @inheritdoc IUniswapV3Factory\n    address public override owner;\n\n    /// @inheritdoc IUniswapV3Factory\n    mapping(uint24 => int24) public override feeAmountTickSpacing;\n    /// @inheritdoc IUniswapV3Factory\n    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;\n\n    constructor() {\n        owner = msg.sender;\n        emit OwnerChanged(address(0), msg.sender);\n\n        feeAmountTickSpacing[500] = 10;\n        emit FeeAmountEnabled(500, 10);\n        feeAmountTickSpacing[3000] = 60;\n        emit FeeAmountEnabled(3000, 60);\n        feeAmountTickSpacing[10000] = 200;\n        emit FeeAmountEnabled(10000, 200);\n    }\n\n    /// @inheritdoc IUniswapV3Factory\n    function createPool(\n        address tokenA,\n        address tokenB,\n        uint24 fee\n    ) external override noDelegateCall returns (address pool) {\n        require(tokenA != tokenB);\n        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);\n        require(token0 != address(0));\n        int24 tickSpacing = feeAmountTickSpacing[fee];\n        require(tickSpacing != 0);\n        require(getPool[token0][token1][fee] == address(0));\n        pool = deploy(address(this), token0, token1, fee, tickSpacing);\n        getPool[token0][token1][fee] = pool;\n        // populate mapping in the reverse direction, deliberate choice to avoid the cost of comparing addresses\n        getPool[token1][token0][fee] = pool;\n        emit PoolCreated(token0, token1, fee, tickSpacing, pool);\n    }\n\n    /// @inheritdoc IUniswapV3Factory\n    function setOwner(address _owner) external override {\n        require(msg.sender == owner);\n        emit OwnerChanged(owner, _owner);\n        owner = _owner;\n    }\n\n    /// @inheritdoc IUniswapV3Factory\n    function enableFeeAmount(uint24 fee, int24 tickSpacing) public override {\n        require(msg.sender == owner);\n        require(fee < 1000000);\n        // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that\n        // TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick\n        // 16384 ticks represents a >5x price change with ticks of 1 bips\n        require(tickSpacing > 0 && tickSpacing < 16384);\n        require(feeAmountTickSpacing[fee] == 0);\n\n        feeAmountTickSpacing[fee] = tickSpacing;\n        emit FeeAmountEnabled(fee, tickSpacing);\n    }\n}",
  "compilerVersion": "0.7.6",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "",
  "contractName": "UniswapV3Factory",
  "evmVersion": "istanbul"
}' http://localhost:3000/contracts/verify
mkdir -p /root/verify-uniswap/contracts
curl -X POST -H "Content-Type: application/json" -d '{
  "address": "0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0",
  "sourceCode": "// SPDX-License-Identifier: MIT\npragma solidity 0.7.6;\n\ncontract WETH9 {\n    string public name     = \"Wrapped STO\";\n    string public symbol   = \"WSTO\";\n    uint8  public decimals = 18;\n\n    event  Approval(address indexed src, address indexed guy, uint wad);\n    event  Transfer(address indexed src, address indexed dst, uint wad);\n    event  Deposit(address indexed dst, uint wad);\n    event  Withdrawal(address indexed src, uint wad);\n\n    mapping (address => uint)                       public  balanceOf;\n    mapping (address => mapping (address => uint))  public  allowance;\n\n    receive() external payable {\n        deposit();\n    }\n    function deposit() public payable {\n        balanceOf[msg.sender] += msg.value;\n        emit Deposit(msg.sender, msg.value);\n    }\n    function withdraw(uint wad) public {\n        require(balanceOf[msg.sender] >= wad);\n        balanceOf[msg.sender] -= wad;\n        msg.sender.transfer(wad);\n        emit Withdrawal(msg.sender, wad);\n    }\n\n    function totalSupply() public view returns (uint) {\n        return address(this).balance;\n    }\n\n    function approve(address guy, uint wad) public returns (bool) {\n        allowance[msg.sender][guy] = wad;\n        emit Approval(msg.sender, guy, wad);\n        return true;\n    }\n\n    function transfer(address dst, uint wad) public returns (bool) {\n        return transferFrom(msg.sender, dst, wad);\n    }\n\n    function transferFrom(address src, address dst, uint wad)\n        public\n        returns (bool)\n    {\n        require(balanceOf[src] >= wad);\n\n        if (src != msg.sender && allowance[src][msg.sender] != uint(-1)) {\n            require(allowance[src][msg.sender] >= wad);\n            allowance[src][msg.sender] -= wad;\n        }\n\n        balanceOf[src] -= wad;\n        balanceOf[dst] += wad;\n\n        emit Transfer(src, dst, wad);\n\n        return true;\n    }\n}",
  "compilerVersion": "0.7.6",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "",
  "contractName": "WETH9",
  "evmVersion": "istanbul"
}' http://localhost:3000/contracts/verify
curl -X POST -H "Content-Type: application/json" -d '{
  "address": "0x6f1aF63eb91723a883c632E38D34f2cB6090b805",
  "sourceCode": "// SPDX-License-Identifier: BUSL-1.1\npragma solidity =0.7.6;\n\ninterface IUniswapV3Factory {\n    /// @notice Emitted when the owner of the factory is changed\n    /// @param oldOwner The owner before the owner was changed\n    /// @param newOwner The owner after the owner was changed\n    event OwnerChanged(address indexed oldOwner, address indexed newOwner);\n\n    /// @notice Emitted when a pool is created\n    /// @param token0 The first token of the pool by address sort order\n    /// @param token1 The second token of the pool by address sort order\n    /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip\n    /// @param tickSpacing The minimum number of ticks between initialized ticks\n    /// @param pool The address of the created pool\n    event PoolCreated(\n        address indexed token0,\n        address indexed token1,\n        uint24 indexed fee,\n        int24 tickSpacing,\n        address pool\n    );\n\n    /// @notice Emitted when a new fee amount is enabled for pool creation via the factory\n    /// @param fee The enabled fee, denominated in hundredths of a bip\n    /// @param tickSpacing The minimum number of ticks between initialized ticks for pools created with the given fee\n    event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing);\n\n    /// @notice Returns the current owner of the factory\n    /// @dev Can be changed by the current owner via setOwner\n    /// @return The address of the factory owner\n    function owner() external view returns (address);\n\n    /// @notice Returns the tick spacing for a given fee amount, if enabled, or 0 if not enabled\n    /// @dev A fee amount can never be removed, so this value should be hard coded or cached in the calling context\n    /// @param fee The enabled fee, denominated in hundredths of a bip. Returns 0 in case of unenabled fee\n    /// @return The tick spacing\n    function feeAmountTickSpacing(uint24 fee) external view returns (int24);\n\n    /// @notice Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist\n    /// @dev tokenA and tokenB may be passed in either token0/token1 or token1/token0 order\n    /// @param tokenA The contract address of either token0 or token1\n    /// @param tokenB The contract address of the other token\n    /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip\n    /// @return pool The pool address\n    function getPool(\n        address tokenA,\n        address tokenB,\n        uint24 fee\n    ) external view returns (address pool);\n\n    /// @notice Creates a pool for the given two tokens and fee\n    /// @param tokenA One of the two tokens in the desired pool\n    /// @param tokenB The other of the two tokens in the desired pool\n    /// @param fee The desired fee for the pool\n    /// @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved\n    /// from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments\n    /// are invalid.\n    /// @return pool The address of the newly created pool\n    function createPool(\n        address tokenA,\n        address tokenB,\n        uint24 fee\n    ) external returns (address pool);\n\n    /// @notice Updates the owner of the factory\n    /// @dev Must be called by the current owner\n    /// @param _owner The new owner of the factory\n    function setOwner(address _owner) external;\n\n    /// @notice Enables a fee amount with the given tickSpacing\n    /// @dev Fee amounts may never be removed once enabled\n    /// @param fee The fee amount to enable, denominated in hundredths of a bip (i.e. 1e-6)\n    /// @param tickSpacing The spacing between ticks to be enforced for all pools created with the given fee amount\n    function enableFeeAmount(uint24 fee, int24 tickSpacing) external;\n}\n\ninterface IUniswapV3PoolDeployer {\n    /// @notice Get the parameters to be used in constructing the pool, set transiently during pool creation.\n    /// @dev Called by the pool constructor to fetch the parameters of the pool\n    /// Returns factory The factory address\n    /// Returns token0 The first token of the pool by address sort order\n    /// Returns token1 The second token of the pool by address sort order\n    /// Returns fee The fee collected upon every swap in the pool, denominated in hundredths of a bip\n    /// Returns tickSpacing The minimum number of ticks between initialized ticks\n    function parameters()\n        external\n        view\n        returns (\n            address factory,\n            address token0,\n            address token1,\n            uint24 fee,\n            int24 tickSpacing\n        );\n}\n\n/// @title Prevents delegatecall to a contract\n/// @notice Base contract that provides a modifier for preventing delegatecall to methods in a child contract\nabstract contract NoDelegateCall {\n    /// @dev The original address of this contract\n    address private immutable original;\n\n    constructor() {\n        // Immutables are computed in the init code of the contract, and then inlined into the deployed bytecode.\n        // In other words, this variable won\'t change when it\'s checked at runtime.\n        original = address(this);\n    }\n\n    /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method,\n    ///     and the use of immutable means the address bytes are copied in every place the modifier is used.\n    function checkNotDelegateCall() private view {\n        require(address(this) == original);\n    }\n\n    /// @notice Prevents delegatecall into the modified method\n    modifier noDelegateCall() {\n        checkNotDelegateCall();\n        _;\n    }\n}\n\ninterface IUniswapV3Pool {\n    // Placeholder interface for UniswapV3Pool\n    // This is just a stub to make the code compile\n}\n\ncontract UniswapV3Pool {\n    // Placeholder contract for UniswapV3Pool\n    // This is just a stub to make the code compile\n}\n\ncontract UniswapV3PoolDeployer is IUniswapV3PoolDeployer {\n    struct Parameters {\n        address factory;\n        address token0;\n        address token1;\n        uint24 fee;\n        int24 tickSpacing;\n    }\n\n    /// @inheritdoc IUniswapV3PoolDeployer\n    Parameters public override parameters;\n\n    /// @dev Deploys a pool with the given parameters by transiently setting the parameters storage slot and then\n    /// clearing it after deploying the pool.\n    /// @param factory The contract address of the Uniswap V3 factory\n    /// @param token0 The first token of the pool by address sort order\n    /// @param token1 The second token of the pool by address sort order\n    /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip\n    /// @param tickSpacing The spacing between usable ticks\n    function deploy(\n        address factory,\n        address token0,\n        address token1,\n        uint24 fee,\n        int24 tickSpacing\n    ) internal returns (address pool) {\n        parameters = Parameters({factory: factory, token0: token0, token1: token1, fee: fee, tickSpacing: tickSpacing});\n        pool = address(new UniswapV3Pool{salt: keccak256(abi.encode(token0, token1, fee))}());\n        delete parameters;\n    }\n}\n\n/// @title Canonical Uniswap V3 factory\n/// @notice Deploys Uniswap V3 pools and manages ownership and control over pool protocol fees\ncontract UniswapV3Factory is IUniswapV3Factory, UniswapV3PoolDeployer, NoDelegateCall {\n    /// @inheritdoc IUniswapV3Factory\n    address public override owner;\n\n    /// @inheritdoc IUniswapV3Factory\n    mapping(uint24 => int24) public override feeAmountTickSpacing;\n    /// @inheritdoc IUniswapV3Factory\n    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;\n\n    constructor() {\n        owner = msg.sender;\n        emit OwnerChanged(address(0), msg.sender);\n\n        feeAmountTickSpacing[500] = 10;\n        emit FeeAmountEnabled(500, 10);\n        feeAmountTickSpacing[3000] = 60;\n        emit FeeAmountEnabled(3000, 60);\n        feeAmountTickSpacing[10000] = 200;\n        emit FeeAmountEnabled(10000, 200);\n    }\n\n    /// @inheritdoc IUniswapV3Factory\n    function createPool(\n        address tokenA,\n        address tokenB,\n        uint24 fee\n    ) external override noDelegateCall returns (address pool) {\n        require(tokenA != tokenB);\n        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);\n        require(token0 != address(0));\n        int24 tickSpacing = feeAmountTickSpacing[fee];\n        require(tickSpacing != 0);\n        require(getPool[token0][token1][fee] == address(0));\n        pool = deploy(address(this), token0, token1, fee, tickSpacing);\n        getPool[token0][token1][fee] = pool;\n        // populate mapping in the reverse direction, deliberate choice to avoid the cost of comparing addresses\n        getPool[token1][token0][fee] = pool;\n        emit PoolCreated(token0, token1, fee, tickSpacing, pool);\n    }\n\n    /// @inheritdoc IUniswapV3Factory\n    function setOwner(address _owner) external override {\n        require(msg.sender == owner);\n        emit OwnerChanged(owner, _owner);\n        owner = _owner;\n    }\n\n    /// @inheritdoc IUniswapV3Factory\n    function enableFeeAmount(uint24 fee, int24 tickSpacing) public override {\n        require(msg.sender == owner);\n        require(fee < 1000000);\n        // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that\n        // TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick\n        // 16384 ticks represents a >5x price change with ticks of 1 bips\n        require(tickSpacing > 0 && tickSpacing < 16384);\n        require(feeAmountTickSpacing[fee] == 0);\n\n        feeAmountTickSpacing[fee] = tickSpacing;\n        emit FeeAmountEnabled(fee, tickSpacing);\n    }\n}",
}' http://localhost:3000/contracts/verify
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose exec postgres psql -U new_user -d studio_indexer_new -c "SELECT * FROM contracts WHERE address = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805'"
cd "/root"
cd /root/mainnet-indexer && node -e "const { blockchain } = require('./dist/services/blockchain'); (async () => { const isContract = await blockchain.isContract('0x6f1aF63eb91723a883c632E38D34f2cB6090b805'); console.log('Is contract:', isContract); const code = await blockchain.getCode('0x6f1aF63eb91723a883c632E38D34f2cB6090b805'); console.log('Code length:', code.length); })()"
cd /root/mainnet-indexer && grep -r "Error verifying contract" logs/ --include="*.log" | tail -n 20
cd "/root"
mkdir -p /root/mainnet-indexer/logs
cd /root/mainnet-indexer && grep -r "handleError" src/ --include="*.ts" | head -n 10
cd "/root"
cd /root/mainnet-indexer && grep -A 20 "verifyContract" src/services/verification/index.ts
cd "/root"
cd /root/mainnet-indexer && grep -A 50 "verifyContract" src/services/verification/index.ts
cd "/root"
cd /root/mainnet-indexer && grep -A 20 "compileContract" src/services/verification/index.ts
cd "/root"
cd /root/mainnet-indexer && grep -A 50 "compileContract" src/services/verification/index.ts
cd "/root"
cd /root/mainnet-indexer && grep -A 30 "loadCompilerVersion" src/services/verification/index.ts
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose build indexer && docker-compose up -d indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose stop indexer && docker-compose rm -f indexer && docker-compose up -d indexer
ls
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=20 indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer
cd "/root"
cd /root/mainnet-indexer && curl -X POST -H "Content-Type: application/json" -d '{"address":"0x1234567890123456789012345678901234567890","sourceCode":"pragma solidity ^0.8.0;","compilerVersion":"0.8.0","contractName":"Test","optimizationUsed":false,"runs":200}' http://localhost:3000/contracts/verify
cd "/root"
cd /root/mainnet-indexer && docker stats --no-stream
cd "/root"
cd /root/mainnet-indexer && docker-compose stop indexer && docker-compose rm -f indexer && docker-compose up -d indexer
find /root/mainnet-indexer/src -name "*.ts" | grep -i "schema\|database\|table"
find /root/mainnet-indexer/migrations -name "*.sql" | head -n 3
find /root/mainnet-indexer/migrations -name "*.sql" | grep -i contract | head -n 1
find /root/mainnet-indexer/migrations -name "*.sql" | sort | head -n 1
find /root/mainnet-indexer/migrations -name "*.sql" | grep -i contract | sort
find /root/mainnet-indexer/migrations -name "*.sql" | grep -i evm
chmod +x /root/verify-uniswap/verify-with-original-source.js
cd /root/verify-uniswap && node verify-with-original-source.js
clear
ls
cd ..
ls
rm -rf uniswap_contracts.tar.gz
rm -rf uniswap
rm -rf uniswap_extracted
rm -rf verify-uniswap
clear
ls
rm -rf contract-data-fetching-guide.md
rm -rf contract-verification-persistence-guide.md
rm -rf contract-verification-process.md
rm -rf erc20-verification-example.js
rm -rf hardhat-contract-verification-guide.md
rm -rf uniswap-verification-recommendations.md
clear
ls
chmod +x /root/verify-uniswap/verify-direct.js
cd /root/verify-uniswap && node verify-direct.js
cd "/root"
chmod +x /root/analyze-indexer.js
node /root/analyze-indexer.js
chmod +x /root/analyze-database-schema.js
ls -la /root/mainnet-indexer/test-contract-verification*.js
chmod +x /root/verify-uniswap/verify-factory.js
cd /root/verify-uniswap && node verify-factory.js
cd "/root"
ls -la /root/mainnet-indexer/scripts
curl http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805/verified
find /root/uniswap -name "UniswapV3Factory.sol" | xargs ls -la
find /root/mainnet-indexer -name "*flatten*" -o -name "*solc*"
mkdir -p /root/verify-uniswap/flattened
find /root/uniswap -name "package.json" | xargs grep -l "flatten"
find /root/uniswap -name "hardhat.config.js" -o -name "truffle-config.js"
find /root/uniswap/v3-core -name "UniswapV3Factory.json"
cd /root/uniswap/v3-core && npx hardhat --version
cd "/root"
find /root/mainnet-indexer -name "*flatten*" -type f
curl http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805/abi
curl http://localhost:3000/contracts/0x6f1aF63eb91723a883c632E38D34f2cB6090b805
find /root/mainnet-indexer/src -name "*.ts" | xargs grep -l "bytecode"
find /root/mainnet-indexer/src/services/blockchain -name "*.ts" | xargs grep -l "getCode"
chmod +x /root/verify-uniswap/get-bytecode.js
cd /root/verify-uniswap && node get-bytecode.js
cd "/root"
chmod +x /root/verify-uniswap/get-bytecode-api.js
cd /root/verify-uniswap && node get-bytecode-api.js
cd /root/mainnet-indexer && curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x6f1aF63eb91723a883c632E38D34f2cB6090b805", "latest"],"id":1}' http://localhost:3000/proxy/rpc
cd "/root"
cd /root/mainnet-indexer && docker-compose stop indexer && docker-compose rm -f indexer && docker-compose up -d indexer
cd "/root"
cd /root/mainnet-indexer && grep -r "app.get('/stats" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "app.get('/transactions" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "count.*Transaction" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "countTransaction" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "getTokenTransfersCount" src/
cd "/root"
cd /root/mainnet-indexer && docker-compose stop indexer && docker-compose rm -f indexer && docker-compose up -d indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && grep -r "new StatsApiService" src/
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/api/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/contracts/count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/api/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && grep -r "app.use('/api'" src/
cd "/root"
cd /root/mainnet-indexer && find src -name "*.ts" -exec grep -l "app.listen" {} \;
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/tps
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer node -e "const express = require('express'); const app = express(); app._router && app._router.stack.forEach(r => { if (r.route && r.route.path) { console.log(r.route.path); } });"
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/contracts/count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "transactions/count"
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "getTotalTransactionsCount"
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "transactions/count"
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/test
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/api/stats/test
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer netstat -tulpn | grep 3000
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/contracts/count
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/tx-count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "tx-count"
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "Transaction count endpoint called"
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/tx-count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "Transaction count endpoint called"
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && docker-compose exec indexer netstat -tulpn | grep 3000
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer
cd "/root"
cd /root/mainnet-indexer && grep -r "new StatsApiService" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "app.use('/api'" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "app.use" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "createApiService" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "proxy" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "router" src/
cd "/root"
cd /root/mainnet-indexer && grep -r "gateway" src/
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/health
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/contracts/count
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "Transaction count endpoint called"
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/api/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/contracts/count
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/tx-count
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i error
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "transactions/count"
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=100 indexer | grep -i "getTotalTransactionsCount"
cd "/root"
cd /root/mainnet-indexer && docker-compose restart indexer
cd "/root"
cd /root/mainnet-indexer && curl -X GET http://localhost:3000/stats/transactions/count
cd "/root"
cd /root/mainnet-indexer && grep -r "app.use('/api'" src/
ls
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js SwapRouter
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-fixed.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
cd /root/uniswap/deployment && node scripts/verify-with-correct-paths.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-source-files.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-source-files-fixed.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-import-paths.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-modified-imports.js
cd "/root"
cd /root/uniswap/deployment && ls -la flattened/
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-flattened-fixed.js
cd "/root"
cd /root/uniswap/deployment && node scripts/fix-flattened-order.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-fixed-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-hardhat-flattened-fixed.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-original-sources.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-import-paths-fixed.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-manual-imports.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-imports.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-fixed.js
cd "/root"
find /root/uniswap/deployment/temp-exact-structure -type f | sort
cd /root/uniswap/deployment && node scripts/verify-with-exact-directory-structure-debug.js
ls -la /root/uniswap/deployment/contracts
ls -la /root/uniswap/deployment/node_modules/@uniswap
ls -la /root/uniswap/deployment/node_modules/@uniswap/v3-core/contracts/libraries
cd /root/uniswap/deployment && node scripts/verify-contracts.js SwapRouter
cd "/root"
cd /root/uniswap/deployment && node scripts/flatten-contract.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/fix-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/hardhat-flatten.js
cd "/root"
ls -la /root/uniswap/deployment/flattened/
cd /root/uniswap/deployment && node scripts/verify-hardhat-flattened.js
cd "/root"
cd /root/uniswap/deployment && npm install glob
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-multipart.js
cd "/root"
ls -la /root/uniswap/deployment/contracts/
ls -la /root/uniswap/deployment/contracts/interfaces/
ls -la /root/uniswap/deployment/contracts/libraries/
ls -la /root/uniswap/deployment/contracts/base/
ls -la /root/uniswap/deployment/contracts/interfaces/callback/
ls -la /root/uniswap/deployment/contracts/interfaces/external/
ls -la /root/uniswap/deployment/contracts/interfaces/pool/
cd /root/uniswap/deployment && node scripts/verify-multipart-recursive.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-multipart-fixed.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-import-mappings.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-with-exact-paths.js
cd "/root"
ls -la /root/uniswap/deployment/flattened/
cd /root/uniswap/deployment && node scripts/verify-flattened-contract.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-hardhat-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/fix-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-flattened-contract.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-flattened.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js SwapRouter
find /root -name "UniswapV3Factory.sol" -type f
find /root/uniswap/deployment/contracts -type f | grep -v "node_modules" | sort
mkdir -p /root/uniswap/deployment/verification-payloads
cd /root/uniswap/deployment && node scripts/verify-contracts.js UniswapV3Factory
cd "/root"
docker ps
ls -la /root/uniswap/deployment/contracts
ls -la /root/uniswap/deployment/contracts/interfaces
ls -la /root/uniswap/deployment/contracts/interfaces/pool
ls -la /root/uniswap/deployment/contracts/interfaces/callback
ls -la /root/uniswap/deployment/contracts/libraries
ls -la /root/uniswap/deployment/contracts/base
docker logs mainnet-indexer_indexer_1 | grep -i error | tail -n 50
docker logs mainnet-indexer_indexer_1 | grep -i verification | tail -n 50
grep -r "limit" --include="*.ts" --include="*.js" /root/mainnet-indexer/src
grep -r "bodyParser" --include="*.ts" --include="*.js" /root/mainnet-indexer/src
grep -r "express" --include="*.ts" --include="*.js" /root/mainnet-indexer/src | head -n 20
cd /root/mainnet-indexer && docker-compose build indexer && docker-compose up -d indexer
cd "/root"
cd /root/mainnet-indexer && docker-compose down && docker-compose up -d
cd "/root"
docker logs mainnet-indexer_indexer_1 | tail -n 20
docker logs mainnet-indexer_indexer_1 | grep -i "json" | head -n 20
docker logs mainnet-indexer_indexer_1 | head -n 50
cd /root/uniswap/deployment && node scripts/verify-contracts.js SwapRouter
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js SwapRouter
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js SwapRouter
cat /root/mainnet-indexer/error.log | grep -i "verification" | tail -n 20
cat /root/mainnet-indexer/combined.log | grep -i "error" | grep -i "verif" | tail -n 20
cat /root/mainnet-indexer/error.log | tail -n 50
cat /root/mainnet-indexer/combined.log | tail -n 50
cd /root/mainnet-indexer && docker-compose build indexer && docker-compose up -d
cd "/root"
cd /root/mainnet-indexer && docker-compose down && docker-compose build indexer && docker-compose up -d
cd "/root"
mkdir -p /root/uniswap && cd /root/uniswap && git clone https://github.com/Uniswap/v3-core.git && git clone https://github.com/Uniswap/v3-periphery.git
cd "/root"
cd /root/uniswap/v3-core && ls -la
cd "/root"
cd /root/uniswap/v3-periphery && ls -la
cd "/root"
cd /root/uniswap/v3-core && ls -la contracts/
cd "/root"
cd /root/uniswap/v3-periphery && ls -la contracts/
cd "/root"
find /root/uniswap -name "WETH*.sol"
grep -r "WETH" /root/uniswap/v3-periphery/contracts/
cat /root/uniswap/v3-periphery/contracts/interfaces/external/IWETH9.sol
mkdir -p /root/uniswap/deployment/contracts
mkdir -p /root/uniswap/deployment/scripts /root/uniswap/deployment/contracts/interfaces /root/uniswap/deployment/contracts/libraries
cp -r /root/uniswap/v3-core/contracts/* /root/uniswap/deployment/contracts/
mkdir -p /root/uniswap/deployment/contracts/base /root/uniswap/deployment/contracts/lens
cp /root/uniswap/v3-periphery/contracts/SwapRouter.sol /root/uniswap/deployment/contracts/
cp /root/uniswap/v3-periphery/contracts/NonfungiblePositionManager.sol /root/uniswap/deployment/contracts/
cp /root/uniswap/v3-periphery/contracts/NonfungibleTokenPositionDescriptor.sol /root/uniswap/deployment/contracts/
cp -r /root/uniswap/v3-periphery/contracts/base/* /root/uniswap/deployment/contracts/base/
cp -r /root/uniswap/v3-periphery/contracts/libraries/* /root/uniswap/deployment/contracts/libraries/
cp -r /root/uniswap/v3-periphery/contracts/interfaces/* /root/uniswap/deployment/contracts/interfaces/
cd /root/uniswap/deployment && npm install
cd "/root"
cd /root/uniswap/deployment && npm install axios
cd "/root"
cd /root/uniswap/v3-core && npm install
cd "/root"
cd /root/uniswap/v3-periphery && npm install
cd "/root"
cd /root/uniswap/deployment && npx hardhat run scripts/deploy.js --network studio
cd "/root"
node --version
which nvm || echo "nvm not found"
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo apt-get remove -y libnode-dev && sudo apt-get install -y nodejs
sudo apt-get remove -y libnode72 && sudo apt-get install -y nodejs
sudo dpkg -i --force-overwrite /var/cache/apt/archives/nodejs_16.20.2-1nodesource1_amd64.deb && sudo apt-get -f install
node --version && npm --version
cd /root/uniswap/deployment && npx hardhat run scripts/deploy.js --network studio
cd "/root"
cd /root/uniswap/deployment && npm install @uniswap/v3-core @uniswap/v3-periphery
cd "/root"
cd /root/uniswap/deployment && npx hardhat run scripts/deploy.js --network studio
cd "/root"
cd /root/uniswap/deployment && node scripts/generate-verification-payloads.js
cd "/root"
cd /root/uniswap/deployment && npm install axios
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js UniswapV3Factory
cd "/root"
cd /root/uniswap/deployment && node scripts/verify-contracts.js UniswapV3Factory
ls
cd uniswap
ls
cd deployment
ls
cd scripts
l
ls
cd ..
clear
ls
rm -rf uniswap
cd mainnet-indexer
ls
rm -rf README-LARGE-CONTRACT-VERIFICATION.md
rm -rf README-CONTRACT-VERIFICATION.md
rm -rf README-EVM-VERSION-SUPPORT.md
rm -rf README-VERIFICATION-IMPROVEMENTS.m
rm -rf test-contract-verification-details.js
rm -rf  test-contract-verification.js
clear
ls
cd scripts
l
scd ..
cd ..
ls
chmod +x /root/mainnet-indexer/apply-multi-file-migration.sh
./apply-multi-file-migration.sh
cd mainnet-indexer
./apply-multi-file-migration.sh
cd "/root"
chmod +x /root/mainnet-indexer/rebuild-and-restart-with-enhanced-verification.sh
cd /root/mainnet-indexer && ./rebuild-and-restart-with-enhanced-verification.sh
cd "/root"
cd /root/mainnet-indexer && ./rebuild-and-restart-with-enhanced-verification.sh
cd "/root"
cd /root/mainnet-indexer && docker-compose logs -f indexer
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
cd /root/mainnet-indexer && curl -s http://localhost:3000/health | jq
cd "/root"
chmod +x /root/mainnet-indexer/rebuild-with-new-verification.sh
rm /root/mainnet-indexer/src/services/verification/enhanced-verification-v2.ts
cd /root/mainnet-indexer && ./rebuild-and-restart-with-enhanced-verification.sh
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
sleep 10 && cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=20 indexer
cd "/root"
cd /root/mainnet-indexer && cat Dockerfile
cd "/root"
cd /root/mainnet-indexer && ./rebuild-and-restart-with-enhanced-verification.sh
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
curl -s http://localhost:3000/health | jq
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
chmod +x /root/mainnet-indexer/scripts/enhanced-monitor-fixed.sh
cd /root/mainnet-indexer && chmod +x rebuild-and-restart-with-enhanced-verification.sh && ./rebuild-and-restart-with-enhanced-verification.sh
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
curl -s http://localhost:3000/health || echo "API not accessible"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
curl -s -I http://localhost:3000/contracts/verify || echo "Endpoint not available"
docker-compose logs indexer | tail -n 50
cd /root/mainnet-indexer && docker-compose logs indexer | tail -n 50
cd "/root"
cd /root/mainnet-indexer && docker-compose ps
cd "/root"
cd /root/mainnet-indexer && docker-compose logs --tail=50 indexer
cd "/root"
curl -s http://localhost:3000/contracts/verify-multi | jq
curl -s http://localhost:3000/health | jq
curl -s -X OPTIONS http://localhost:3000/ | grep -i verify
curl -s -X GET http://localhost:3000/contracts/verify
curl -s -X POST http://localhost:3000/contracts/verify -d '{}' -H "Content-Type: application/json"
curl -s -X POST http://localhost:3000/contracts/verify-multi -d '{}' -H "Content-Type: application/json"
ckear
clear
ls
cd mainnet-indexer
ls
cd scripts
ls
cd ..
clear
ls
cd Downloads
ls
cd ..
cd 3dc
ls
cd ..
rm -rf 3dc
clear
ls
ls -la /root/mainnet-indexer/src/services/
ls -la /root/mainnet-indexer/src/services/verification/
ls -la /root/mainnet-indexer/src/services/blockchain/
ls -la /root/mainnet-indexer/src/services/api/
find /root/mainnet-indexer -type f -name "*.ts" -o -name "*.js" | xargs grep -l "uniswap" | head -5
find /root/mainnet-indexer -type f -name "*.ts" -o -name "*.js" | xargs grep -l "uniswap" | grep -v "node_modules"
find /root/mainnet-indexer/src/services/verification -type f -name "*.ts" | sort
grep -r "special handling" --include="*.ts" /root/mainnet-indexer/src/
grep -r "contract.*type" --include="*.ts" /root/mainnet-indexer/src/
grep -r "0x6f1aF63eb91723a883c632E38D34f2cB6090b805" --include="*.ts" /root/mainnet-indexer/src/
grep -r "if.*uniswap" --include="*.ts" /root/mainnet-indexer/src/
grep -r "if.*contractName.includes" --include="*.ts" /root/mainnet-indexer/src/
ls
