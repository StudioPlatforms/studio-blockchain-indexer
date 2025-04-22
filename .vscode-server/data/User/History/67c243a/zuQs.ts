import express from 'express';
import cors from 'cors';
import https from 'https';
import axios from 'axios';
import { ethers } from 'ethers';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import { blockchain } from './blockchain';
import { db, TokenTransfer, NFTToken, NFTCollection } from './database';

const logger = createLogger('api');

export class ApiService {
    private app: express.Application;
    private database: any;
    private indexer: any;
    private port: number;
    private currentRpcIndex: number = 0;

    constructor(database: any, indexer: any, port: number) {
        this.database = database;
        this.indexer = indexer;
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Logging middleware
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, { timestamp: new Date().toISOString() });
            next();
        });

        // Error handling middleware
        this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            logger.error('API Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        // Add v1 prefix support
        this.app.use((req, res, next) => {
            if (req.path.startsWith('/v1/')) {
                req.url = req.url.replace('/v1', '');
            }
            next();
        });
    }

    // Helper method to make HTTP requests with the built-in https module
    private makeHttpRequest(url: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        resolve(parsedData);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            // Set a timeout
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            // Write data to request body
            req.write(JSON.stringify(data));
            req.end();
        });
    }

    // Helper method to fetch NFT metadata from URI
    private async fetchNFTMetadata(uri: string): Promise<any> {
        try {
            // Handle IPFS URIs
            if (uri.startsWith('ipfs://')) {
                uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }

            // Fetch metadata
            const response = await axios.get(uri, { timeout: 5000 });
            return response.data;
        } catch (error) {
            logger.error('Error fetching NFT metadata:', error);
            throw error;
        }
    }

    private setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                lastBlock: this.indexer.latestProcessedBlock,
                isIndexing: this.indexer.isRunning
            });
        });

        // Get account balances - Updated to match the required format
        this.app.get('/account/:address/balances', async (req, res) => {
            try {
                const address = req.params.address;
                
                // Get native STO balance
                const nativeBalance = await blockchain.getBalance(address);
                
                // Get token balances
                const tokens = await this.getAddressTokens(address);
                
                res.json({
                    native: parseFloat(ethers.utils.formatEther(nativeBalance)),
                    tokens: tokens
                });
            } catch (error: any) {
                logger.error('Error getting account balances:', error);
                res.status(500).json({ error: 'Failed to get account balances' });
            }
        });

        // Get address tokens - Updated to match the required format
        this.app.get('/address/:address/tokens', async (req, res) => {
            try {
                const address = req.params.address;
                const tokens = await this.getAddressTokens(address);
                res.json(tokens);
            } catch (error: any) {
                logger.error('Error getting address tokens:', error);
                res.status(500).json({ error: 'Failed to get address tokens' });
            }
        });

        // Get token transfers for an address - New endpoint
        this.app.get('/address/:address/token-transfers', async (req, res) => {
            try {
                const address = req.params.address;
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                
                // Get token transfers where the address is either the sender or receiver
                const transfers = await this.database.getTokenTransfers({
                    fromAddress: address,
                    toAddress: address,
                    limit,
                    offset
                });
                
                // Format the transfers to match the required format
                const formattedTransfers = await Promise.all(transfers.map(async (transfer: TokenTransfer) => {
                    // Get token information
                    let tokenSymbol = '';
                    let tokenName = '';
                    let decimals = 18;
                    
                    try {
                        if (transfer.tokenType === 'ERC20') {
                            tokenSymbol = await blockchain.getTokenSymbol(transfer.tokenAddress) || '';
                            tokenName = await blockchain.getTokenName(transfer.tokenAddress) || '';
                            const tokenDecimals = await blockchain.getTokenDecimals(transfer.tokenAddress);
                            if (tokenDecimals !== null) {
                                decimals = tokenDecimals;
                            }
                        } else if (transfer.tokenType === 'ERC721' || transfer.tokenType === 'ERC1155') {
                            tokenSymbol = await blockchain.getTokenSymbol(transfer.tokenAddress) || '';
                            tokenName = await blockchain.getTokenName(transfer.tokenAddress) || '';
                        }
                    } catch (error) {
                        logger.error(`Error getting token info for ${transfer.tokenAddress}:`, error);
                    }
                    
                    return {
                        hash: transfer.transactionHash,
                        blockNumber: transfer.blockNumber,
                        timestamp: transfer.timestamp,
                        from: transfer.fromAddress,
                        to: transfer.toAddress,
                        tokenAddress: transfer.tokenAddress,
                        tokenSymbol,
                        tokenName,
                        value: transfer.value,
                        decimals
                    };
                }));
                
                res.json(formattedTransfers);
            } catch (error: any) {
                logger.error('Error getting token transfers:', error);
                res.status(500).json({ error: 'Failed to get token transfers' });
            }
        });

        // Get token information - New endpoint
        this.app.get('/tokens/:tokenAddress', async (req, res) => {
            try {
                const tokenAddress = req.params.tokenAddress;
                
                // Get token type
                const tokenType = await blockchain.getTokenType(tokenAddress);
                if (!tokenType) {
                    res.status(404).json({ error: 'Token not found' });
                    return;
                }
                
                // Get token information
                const name = await blockchain.getTokenName(tokenAddress) || '';
                const symbol = await blockchain.getTokenSymbol(tokenAddress) || '';
                let decimals = 18;
                let totalSupply = '0';
                
                if (tokenType === 'ERC20') {
                    const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                    if (tokenDecimals !== null) {
                        decimals = tokenDecimals;
                    }
                    
                    const supply = await blockchain.getTokenTotalSupply(tokenAddress);
                    if (supply) {
                        totalSupply = supply.toString();
                    }
                }
                
                // Get token holders and transfers count (optional)
                // This would typically require indexing all token transfers
                // For now, we'll return placeholder values
                const holders = 0;
                const transfers = 0;
                
                res.json({
                    address: tokenAddress,
                    symbol,
                    name,
                    decimals,
                    totalSupply,
                    type: tokenType,
                    holders,
                    transfers
                });
            } catch (error: any) {
                logger.error('Error getting token information:', error);
                res.status(500).json({ error: 'Failed to get token information' });
            }
        });

        // Get token holders - New endpoint
        this.app.get('/tokens/:tokenAddress/holders', async (req, res) => {
            try {
                const tokenAddress = req.params.tokenAddress;
                
                // Get token holders
                // This would typically require indexing all token transfers
                // For now, we'll return an empty array
                const holders = await blockchain.getTokenHolders(tokenAddress) || [];
                
                res.json(holders);
            } catch (error: any) {
                logger.error('Error getting token holders:', error);
                res.status(500).json({ error: 'Failed to get token holders' });
            }
        });

        // RPC proxy endpoint with failover support
        this.app.post('/proxy/rpc', async (req, res) => {
            const startIndex = this.currentRpcIndex;
            let lastError: Error = new Error('Unknown error');

            // Try each RPC URL in sequence
            for (let attempt = 0; attempt < config.rpc.urls.length; attempt++) {
                const rpcIndex = (startIndex + attempt) % config.rpc.urls.length;
                const rpcUrl = config.rpc.urls[rpcIndex];

                try {
                    const data = await this.makeHttpRequest(rpcUrl, req.body);

                    // Update current RPC index if we switched
                    if (rpcIndex !== this.currentRpcIndex) {
                        logger.info(`Switched RPC proxy to ${rpcUrl}`);
                        this.currentRpcIndex = rpcIndex;
                    }

                    return res.json(data);
                } catch (error: any) {
                    lastError = error instanceof Error ? error : new Error(error?.message || 'Unknown error');
                    logger.warn(`RPC proxy error with ${rpcUrl}: ${lastError.message}`);
                    continue;
                }
            }

            // If we get here, all RPC URLs failed
            logger.error('All RPC URLs failed for proxy request');
            res.status(500).json({ error: 'RPC request failed', details: lastError.message });
        });

        // Get block by number
        this.app.get('/blocks/:number', async (req, res) => {
            try {
                const blockNumber = parseInt(req.params.number);
                const block = await this.database.getBlock(blockNumber);
                if (!block) {
                    res.status(404).json({ error: 'Block not found' });
                    return;
                }
                
                const transactions = await this.database.getTransactionsByBlock(block.number);
                res.json({
                    ...block,
                    transactions
                });
            } catch (error: any) {
                logger.error('Error getting block:', error);
                res.status(500).json({ error: 'Failed to get block' });
            }
        });

        // Get block by hash
        this.app.get('/blocks/hash/:hash', async (req, res) => {
            try {
                const block = await this.database.getBlock(req.params.hash);
                if (!block) {
                    res.status(404).json({ error: 'Block not found' });
                    return;
                }
                
                const transactions = await this.database.getTransactionsByBlock(block.number);
                res.json({
                    ...block,
                    transactions
                });
            } catch (error: any) {
                logger.error('Error getting block by hash:', error);
                res.status(500).json({ error: 'Failed to get block' });
            }
        });

        // Get transaction receipt
        this.app.get('/transactions/:hash/receipt', async (req, res) => {
            try {
                const receipt = await blockchain.getTransactionReceipt(req.params.hash);
                if (!receipt) {
                    res.status(404).json({ error: 'Transaction receipt not found' });
                    return;
                }
                res.json(receipt);
            } catch (error: any) {
                logger.error('Error getting transaction receipt:', error);
                res.status(500).json({ error: 'Failed to get transaction receipt' });
            }
        });

        // Get pending transactions
        this.app.get('/transactions/pending', async (req, res) => {
            try {
                const pendingTxs = await blockchain.getPendingTransactions();
                res.json(pendingTxs);
            } catch (error: any) {
                logger.error('Error getting pending transactions:', error);
                res.status(500).json({ error: 'Failed to get pending transactions' });
            }
        });

        // Get latest transactions
        this.app.get('/transactions', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                
                const transactions = await this.database.getLatestTransactions(limit, offset);
                res.json(transactions);
            } catch (error: any) {
                logger.error('Error getting latest transactions:', error);
                res.status(500).json({ error: 'Failed to get latest transactions' });
            }
        });

        // Filter logs
        this.app.post('/logs/filter', async (req, res) => {
            try {
                const filter = req.body;
                
                // Validate filter
                if (!filter || (!filter.address && !filter.topics)) {
                    res.status(400).json({ error: 'Invalid filter. Must provide address and/or topics.' });
                    return;
                }
                
                const logs = await blockchain.getLogs(filter);
                res.json(logs);
            } catch (error: any) {
                logger.error('Error filtering logs:', error);
                res.status(500).json({ error: 'Failed to filter logs' });
            }
        });

        // Get token transfers
        this.app.get('/tokens/:address/transfers', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                
                const transfers = await this.database.getTokenTransfers({
                    tokenAddress: req.params.address,
                    limit,
                    offset
                });
                
                res.json(transfers);
            } catch (error: any) {
                logger.error('Error getting token transfers:', error);
                res.status(500).json({ error: 'Failed to get token transfers' });
            }
        });

        // Get latest blocks
        this.app.get('/blocks', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                
                const latestBlock = await this.database.getLatestBlock();
                if (!latestBlock) {
                    res.json([]);
                    return;
                }

                const blocks = [];
                for (let i = 0; i < limit && (latestBlock.number - i - offset) >= 0; i++) {
                    const blockNumber = latestBlock.number - i - offset;
                    const block = await this.database.getBlock(blockNumber);
                    if (block) {
                        blocks.push(block);
                    }
                }
                
                res.json(blocks);
            } catch (error: any) {
                logger.error('Error getting blocks:', error);
                res.status(500).json({ error: 'Failed to get blocks' });
            }
        });

        // Get transaction by hash
        this.app.get('/transactions/:hash', async (req, res) => {
            try {
                const transaction = await this.database.getTransaction(req.params.hash);
                if (!transaction) {
                    res.status(404).json({ error: 'Transaction not found' });
                    return;
                }
                res.json(transaction);
            } catch (error: any) {
                logger.error('Error getting transaction:', error);
                res.status(500).json({ error: 'Failed to get transaction' });
            }
        });

        // Get transactions by address
        this.app.get('/address/:address/transactions', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                
                const transactions = await this.database.getTransactionsByAddress(
                    req.params.address,
                    limit,
                    offset
                );
                
                res.json(transactions);
            } catch (error: any) {
                logger.error('Error getting address transactions:', error);
                res.status(500).json({ error: 'Failed to get transactions' });
            }
        });

        // Get address type
        this.app.get('/address/:address/type', async (req, res) => {
            try {
                const address = req.params.address;
                
                // Check if it's a contract
                const isContract = await blockchain.isContract(address);
                
                if (isContract) {
                    // Determine token type
                    const tokenType = await blockchain.getTokenType(address);
                    
                    if (tokenType) {
                        return res.json({ 
                            address, 
                            type: 'contract', 
                            contractType: tokenType 
                        });
                    } else {
                        return res.json({ 
                            address, 
                            type: 'contract', 
                            contractType: 'unknown' 
                        });
                    }
                } else {
                    // It's a regular wallet address
                    return res.json({ 
                        address, 
                        type: 'wallet' 
                    });
                }
            } catch (error: any) {
                logger.error('Error getting address type:', error);
                res.status(500).json({ error: 'Failed to get address type' });
            }
        });

        // Search endpoint
        this.app.get('/search', async (req, res) => {
            try {
                const query = req.query.q as string;
                if (!query) {
                    res.status(400).json({ error: 'Query parameter is required' });
                    return;
                }
                
                // Check if it's a block number (all digits)
                if (/^\d+$/.test(query)) {
                    const block = await this.database.getBlock(parseInt(query));
                    if (block) {
                        return res.json({ type: 'block', data: block });
                    }
                }
                
                // Check if it's a block hash or transaction hash (0x followed by 64 hex chars)
                if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
                    // Try as transaction hash first
                    const tx = await this.database.getTransaction(query);
                    if (tx) {
                        return res.json({ type: 'transaction', data: tx });
                    }
                    
                    // Try as block hash
                    const block = await this.database.getBlock(query);
                    if (block) {
                        return res.json({ type: 'block', data: block });
                    }
                }
                
                // Check if it's an address (0x followed by 40 hex chars)
                if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
                    // Check if it's a contract
                    const isContract = await blockchain.isContract(query);
                    
                    // Get transactions for this address
                    const transactions = await this.database.getTransactionsByAddress(query, 10, 0);
                    
                    if (isContract) {
                        // Determine token type
                        const tokenType = await blockchain.getTokenType(query);
                        
                        if (tokenType) {
                            return res.json({ 
                                type: 'address', 
                                addressType: 'contract',
                                contractType: tokenType,
                                data: { 
                                    address: query, 
                                    transactions 
                                } 
                            });
                        } else {
                            return res.json({ 
                                type: 'address', 
                                addressType: 'contract',
                                contractType: 'unknown',
                                data: { 
                                    address: query, 
                                    transactions 
                                } 
                            });
                        }
                    } else {
                        // It's a regular wallet address
                        return res.json({ 
                            type: 'address', 
                            addressType: 'wallet',
                            data: { 
                                address: query, 
                                transactions 
                            } 
                        });
                    }
                }
                
                res.status(404).json({ error: 'No results found' });
            } catch (error: any) {
                logger.error('Error searching:', error);
                res.status(500).json({ error: 'Search failed' });
            }
        });

        // NFT Endpoints

        // Get NFTs owned by an address
        this.app.get('/address/:address/nfts', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                const tokenAddress = req.query.tokenAddress as string;
                
                const nfts = await this.database.getNFTsByOwner(
                    req.params.address,
                    {
                        tokenAddress,
                        limit,
                        offset
                    }
                );
                
                res.json(nfts);
            } catch (error: any) {
                logger.error('Error getting NFTs by owner:', error);
                res.status(500).json({ error: 'Failed to get NFTs' });
            }
        });

        // Get NFT metadata
        this.app.get('/nfts/:tokenAddress/:tokenId', async (req, res) => {
            try {
                const { tokenAddress, tokenId } = req.params;
                
                // Try to get the NFT token from the database
                const nftToken = await this.database.getNFTToken(tokenAddress, tokenId);
                if (!nftToken) {
                    res.status(404).json({ error: 'NFT not found' });
                    return;
                }
                
                // If we have metadata, return it
                if (nftToken.metadata) {
                    return res.json(nftToken);
                }
                
                // If we have a metadata URI but no metadata, try to fetch it
                if (nftToken.metadataUri) {
                    try {
                        const metadata = await this.fetchNFTMetadata(nftToken.metadataUri);
                        
                        // Update the metadata in the database
                        await this.database.updateNFTMetadata(tokenAddress, tokenId, metadata);
                        
                        // Get the updated NFT token
                        const updatedNftToken = await this.database.getNFTToken(tokenAddress, tokenId);
                        return res.json(updatedNftToken);
                    } catch (error) {
                        logger.error('Error fetching NFT metadata:', error);
                        // Return what we have even if we couldn't fetch the metadata
                        return res.json(nftToken);
                    }
                }
                
                // Return what we have
                res.json(nftToken);
            } catch (error: any) {
                logger.error('Error getting NFT metadata:', error);
                res.status(500).json({ error: 'Failed to get NFT metadata' });
            }
        });

        // Get NFT transfers by address
        this.app.get('/address/:address/nft-transfers', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                const tokenAddress = req.query.tokenAddress as string;
                const tokenType = req.query.tokenType as 'ERC721' | 'ERC1155' | undefined;
                
                const transfers = await this.database.getNFTTransfersByAddress(
                    req.params.address,
                    {
                        tokenAddress,
                        tokenType,
                        limit,
                        offset
                    }
                );
                
                res.json(transfers);
            } catch (error: any) {
                logger.error('Error getting NFT transfers by address:', error);
                res.status(500).json({ error: 'Failed to get NFT transfers' });
            }
        });

        // Get NFT collection
        this.app.get('/nfts/:tokenAddress', async (req, res) => {
            try {
                const { tokenAddress } = req.params;
                
                // Try to get the NFT collection from the database
                const nftCollection = await this.database.getNFTCollection(tokenAddress);
                if (!nftCollection) {
                    res.status(404).json({ error: 'NFT collection not found' });
                    return;
                }
                
                res.json(nftCollection);
            } catch (error: any) {
                logger.error('Error getting NFT collection:', error);
                res.status(500).json({ error: 'Failed to get NFT collection' });
            }
        });

        // Get NFT collections
        this.app.get('/nfts', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string) || 10;
                const offset = parseInt(req.query.offset as string) || 0;
                
                const collections = await this.database.getNFTCollections({
                    limit,
                    offset
                });
                
                res.json(collections);
            } catch (error: any) {
                logger.error('Error getting NFT collections:', error);
                res.status(500).json({ error: 'Failed to get NFT collections' });
            }
        });

        // Detect new contracts - New endpoint
        this.app.get('/contracts/detect', async (req, res) => {
            try {
                const fromBlock = parseInt(req.query.fromBlock as string) || 0;
                const toBlock = parseInt(req.query.toBlock as string) || await blockchain.getLatestBlockNumber();
                
                const contracts = await blockchain.detectNewContracts(fromBlock, toBlock);
                res.json(contracts);
            } catch (error: any) {
                logger.error('Error detecting new contracts:', error);
                res.status(500).json({ error: 'Failed to detect new contracts' });
            }
        });
    }

    // Helper method to get token balances for an address
    private async getAddressTokens(address: string): Promise<any[]> {
        try {
            // Get token transfers for this address
            const transfers = await this.database.getTokenTransfers({
                fromAddress: address,
                toAddress: address,
                limit: 1000,
                offset: 0
            });
            
            // Extract unique token addresses
            const tokenAddresses = new Set<string>();
            transfers.forEach((transfer: TokenTransfer) => {
                tokenAddresses.add(transfer.tokenAddress);
            });
            
            // Get token balances for each token
            const tokens = await Promise.all(Array.from(tokenAddresses).map(async (tokenAddress) => {
                try {
                    // Get token type
                    const tokenType = await blockchain.getTokenType(tokenAddress);
                    if (!tokenType) return null;
                    
                    // Get token information
                    const name = await blockchain.getTokenName(tokenAddress) || '';
                    const symbol = await blockchain.getTokenSymbol(tokenAddress) || '';
                    let decimals = 18;
                    let balance = '0';
                    
                    if (tokenType === 'ERC20') {
                        const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                        if (tokenDecimals !== null) {
                            decimals = tokenDecimals;
                        }
                        
                        const tokenBalance = await blockchain.getTokenBalance(tokenAddress, address);
                        if (tokenBalance) {
                            balance = tokenBalance.toString();
                        }
                    } else if (tokenType === 'ERC721') {
                        const tokenBalance = await blockchain.getTokenBalance(tokenAddress, address);
                        if (tokenBalance) {
                            balance = tokenBalance.toString();
                        }
                    }
                    
                    // Convert balance from wei to token units
                    const balanceInTokenUnits = parseFloat(ethers.utils.formatUnits(balance, decimals));
                    
                    return {
                        contractAddress: tokenAddress,
                        symbol,
                        name,
                        balance: balanceInTokenUnits,
                        decimals,
                        type: tokenType
                    };
                } catch (error) {
                    logger.error(`Error getting token balance for ${tokenAddress}:`, error);
                    return null;
                }
            }));
            
            // Filter out null values and return
            return tokens.filter(token => token !== null);
        } catch (error) {
            logger.error(`Error getting token balances for ${address}:`, error);
            return [];
        }
    }

    start(): void {
        this.app.listen(this.port, () => {
            logger.info(`API server listening on port ${this.port}`);
        });
    }
}
