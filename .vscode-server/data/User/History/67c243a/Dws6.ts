import express from 'express';
import cors from 'cors';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const logger = createLogger('api');

// Use node-fetch instead of axios since it's likely already a dependency
import fetch from 'node-fetch';

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
                    const response = await fetch(rpcUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(req.body),
                        // No direct timeout option in node-fetch, would need AbortController
                    });

                    // Update current RPC index if we switched
                    if (rpcIndex !== this.currentRpcIndex) {
                        logger.info(`Switched RPC proxy to ${rpcUrl}`);
                        this.currentRpcIndex = rpcIndex;
                    }

                    const data = await response.json();
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
                
                const transactions = await this.database.getTransactionsByBlock(blockNumber);
                res.json({
                    ...block,
                    transactions
                });
            } catch (error: any) {
                logger.error('Error getting block:', error);
                res.status(500).json({ error: 'Failed to get block' });
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
    }

    start(): void {
        this.app.listen(this.port, () => {
            logger.info(`API server listening on port ${this.port}`);
        });
    }
}
