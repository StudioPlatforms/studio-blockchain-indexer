import { indexer } from './services/indexer';
import { createApiService } from './services/api';
import { blockchain } from './services/blockchain';
import { db } from './services/database/index';
import { createLogger } from './utils/logger';
import { config } from './config';

const logger = createLogger('main');

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

async function main() {
    try {
        logger.info('Starting Studio Blockchain Indexer...');
        logger.info(`RPC URLs: ${config.rpc.urls.join(', ')}`);
        logger.info(`Chain ID: ${config.rpc.chainId}`);
        logger.info(`Starting from block: ${config.indexer.startBlock}`);

        // Create and start the API server
        const api = createApiService(db, indexer, config.server.port);
        api.start();
        logger.info(`API server started on port ${config.server.port}`);

        // Start the indexer
        await indexer.start();
        logger.info('Indexer started successfully');

        // Handle shutdown gracefully
        const shutdown = async () => {
            logger.info('Shutting down...');
            
            // Stop the indexer
            indexer.stop();
            
            // Shutdown blockchain service (stop health check interval)
            if (typeof blockchain.shutdown === 'function') {
                blockchain.shutdown();
            }
            
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    logger.error('Startup error:', error);
    process.exit(1);
});
