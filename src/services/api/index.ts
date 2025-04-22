import express from 'express';
import { ApiService } from './core';
import { BlockchainApiService } from './blockchain';
import { TokensApiService } from './tokens';
import { NFTsApiService } from './nfts';
import { ContractsApiService } from './contracts';
import { ContractsVerificationApiService } from './contracts-verification';
import { EnhancedContractsVerificationApiService } from './enhanced-contracts-verification';
import { VerificationApiService } from './verification-api';
import { TransactionsApiService } from './transactions';
import { StatsApiService } from './stats';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('api:index');

/**
 * Create an API service instance
 * @param database The database instance
 * @param indexer The indexer instance
 * @param port The port to listen on
 * @returns The API service instance
 */
export function createApiService(database: IDatabase, indexer: any, port: number): ApiService {
    logger.info(`Creating combined API service on port ${port}`);
    
    // Create the main API service
    const apiService = new ApiService(database, indexer, port);
    
    // Create the specialized API services and pass the Express app from the main service
    logger.info('Registering blockchain routes');
    new BlockchainApiService(database, indexer, port, apiService['app']);
    
    logger.info('Registering token routes');
    new TokensApiService(database, indexer, port, apiService['app']);
    
    logger.info('Registering NFT routes');
    new NFTsApiService(database, indexer, port, apiService['app']);
    
    logger.info('Registering contract routes');
    new ContractsApiService(database, indexer, port, apiService['app']);
    
    logger.info('Registering enhanced contract verification routes');
    new EnhancedContractsVerificationApiService(database, apiService['app']);
    
    logger.info('Registering new verification API routes');
    new VerificationApiService(database, apiService['app']);
    
    // Note: We're using the enhanced verification service instead of the original one
    // If you want to keep both, uncomment the line below
    // logger.info('Registering contract verification routes');
    // new ContractsVerificationApiService(database, apiService['app']);
    
    logger.info('Registering transaction routes');
    new TransactionsApiService(database, apiService['app']);
    
    logger.info('Registering stats routes');
    new StatsApiService(database, indexer, port, apiService['app']);
    
    // Log that all routes have been registered
    logger.info('All API routes registered successfully');
    
    return apiService;
}

// Re-export all API service classes
export { ApiService } from './core';
export { BlockchainApiService } from './blockchain';
export { TokensApiService } from './tokens';
export { NFTsApiService } from './nfts';
export { ContractsApiService } from './contracts';
export { ContractsVerificationApiService } from './contracts-verification';
export { EnhancedContractsVerificationApiService } from './enhanced-contracts-verification';
export { VerificationApiService } from './verification-api';
export { TransactionsApiService } from './transactions';
export { StatsApiService } from './stats';

// Re-export utility functions
export * from './utils';
