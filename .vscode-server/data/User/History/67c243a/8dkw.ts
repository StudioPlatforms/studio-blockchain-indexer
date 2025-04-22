import express from 'express';
import cors from 'cors';
import https from 'https';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import { blockchain, LogFilter } from './blockchain';

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

    private setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                lastBlock: this.indexer.latestProcessedBlock,
                isIndexing: this.indexer.isRunning
            });
        });

        // Get account balances
        this.app.get('/account/:address/balances', async (req, res) => {
            try {
                const address = req.params.address;
                const transactions = await this.database.getTransactionsByAddress(address, 1000, 0);
                const balances = new Map<string, string>();
                
                // Calculate balances from transactions
                transactions.forEach((tx: any) => {
                    if (tx.to_address === address && tx.from_address) {
                        const currentBalance = balances.get(tx.from_address) || '0';
                        balances.set(tx.from_address, (BigInt(currentBalance) + BigInt(tx.value)).toString());
                    }
                    if (tx.from_address === address && tx.to_address) {
                        const currentBalance = balances.get(tx.to_address) || '0';
                        balances.set(tx.to_address, (BigInt(currentBalance) - BigInt(tx.value)).toString());
                    }
                });

                res.json({
                    results: Array.from(balances.entries()).map(([contract, balance]) => ({
                        contract,
                        balance
                    })),
                    contracts: {}
                });
            } catch (error: any) {
                logger.error('Error getting account balances:', error);
                res.status(500).json({ error: 'Failed to get account balances' });
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

        // Filter logs
        this.app.post('/logs/filter', async (req, res) => {
            try {
                const filter = req.body as LogFilter;
                
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
                    const transactions = await this.database.getTransactionsByAddress(query, 10, 0);
                    return res.json({ type: 'address', data: { address: query, transactions } });
                }
                
                res.status(404).json({ error: 'No results found' });
            } catch (error: any) {
                logger.error('Error searching:', error);
                res.status(500).json({ error: 'Search failed' });
            }
        });
    }

    start(): void {
        this.app.listen(this.port, () => {
            logger.info(`API server listening on port ${this.port}`);
        });
    }
}
