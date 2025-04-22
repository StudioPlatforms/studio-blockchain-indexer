import express from 'express';
import cors from 'cors';
import { createLogger } from '../../utils/logger';
import { config } from '../../config';
import { makeHttpRequest } from './utils';
import { IDatabase } from '../database/types';

const logger = createLogger('api:core');

/**
 * Core API service class
 * This class handles the setup of the Express application and provides
 * the base functionality for the API service
 */
export class ApiService {
    protected app: express.Application;
    protected database: IDatabase;
    protected indexer: any;
    protected port: number;
    protected currentRpcIndex: number = 0;

    constructor(database: IDatabase, indexer: any, port: number) {
        this.database = database;
        this.indexer = indexer;
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Set up middleware for the Express application
     */
    protected setupMiddleware(): void {
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

    /**
     * Set up routes for the Express application
     * This method is overridden by subclasses to add specific routes
     */
    protected setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                lastBlock: this.indexer.latestProcessedBlock,
                isIndexing: this.indexer.isRunning
            });
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
                    const data = await makeHttpRequest(rpcUrl, req.body);

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
    }

    /**
     * Start the API server
     */
    start(): void {
        this.app.listen(this.port, () => {
            logger.info(`API server listening on port ${this.port}`);
        });
    }
}
