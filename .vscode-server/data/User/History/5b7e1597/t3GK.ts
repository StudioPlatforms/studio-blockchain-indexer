import express from 'express';
import { ApiService } from './core';
import { BlockchainApiService } from './blockchain';
import { TokensApiService } from './tokens';
import { NFTsApiService } from './nfts';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('api:index');

/**
 * Combined API service class that extends the ApiService class
 * This class combines all the functionality from the different API service classes
 */
export class CombinedApiService extends ApiService {
    constructor(database: IDatabase, indexer: any, port: number) {
        super(database, indexer, port);
        
        // Register routes from other API services
        logger.info('Registering blockchain routes');
        new BlockchainApiService(database, indexer, port, this.app);
        
        logger.info('Registering token routes');
        new TokensApiService(database, indexer, port, this.app);
        
        logger.info('Registering NFT routes');
        new NFTsApiService(database, indexer, port, this.app);
    }
}

/**
 * Create an API service instance
 * @param database The database instance
 * @param indexer The indexer instance
 * @param port The port to listen on
 * @returns The API service instance
 */
export function createApiService(database: IDatabase, indexer: any, port: number): ApiService {
    logger.info(`Creating combined API service on port ${port}`);
    const apiService = new CombinedApiService(database, indexer, port);
    return apiService;
}

// Re-export all API service classes
export { ApiService } from './core';
export { BlockchainApiService } from './blockchain';
export { TokensApiService } from './tokens';
export { NFTsApiService } from './nfts';

// Re-export utility functions
export * from './utils';
