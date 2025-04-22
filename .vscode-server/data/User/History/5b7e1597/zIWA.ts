import express from 'express';
import { ApiService } from './core';
import { BlockchainApiService } from './blockchain';
import { TokensApiService } from './tokens';
import { NFTsApiService } from './nfts';
import { IDatabase } from '../database/types';

/**
 * Create an API service instance
 * @param database The database instance
 * @param indexer The indexer instance
 * @param port The port to listen on
 * @returns The API service instance
 */
export function createApiService(database: IDatabase, indexer: any, port: number): ApiService {
    // Create a new Express application
    const app = express();
    
    // Create the API services
    const apiService = new ApiService(database, indexer, port);
    const blockchainApi = new BlockchainApiService(database, indexer, port);
    const tokensApi = new TokensApiService(database, indexer, port);
    const nftsApi = new NFTsApiService(database, indexer, port);
    
    // Start all the services
    apiService.start();
    blockchainApi.start();
    tokensApi.start();
    nftsApi.start();
    
    // Return the main API service
    return apiService;
}

// Re-export all API service classes
export { ApiService } from './core';
export { BlockchainApiService } from './blockchain';
export { TokensApiService } from './tokens';
export { NFTsApiService } from './nfts';

// Re-export utility functions
export * from './utils';
