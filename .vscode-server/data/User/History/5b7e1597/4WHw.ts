import { ApiService } from './core';
import { BlockchainApiService } from './blockchain';
import { TokensApiService } from './tokens';
import { NFTsApiService } from './nfts';
import { IDatabase } from '../database/types';

/**
 * Combined API service class that extends all the API service classes
 * This class combines all the functionality from the different API service classes
 */
class CombinedApiService extends ApiService {
    private blockchainApi: BlockchainApiService;
    private tokensApi: TokensApiService;
    private nftsApi: NFTsApiService;

    constructor(database: IDatabase, indexer: any, port: number) {
        super(database, indexer, port);
        this.blockchainApi = new BlockchainApiService(database, indexer, port);
        this.tokensApi = new TokensApiService(database, indexer, port);
        this.nftsApi = new NFTsApiService(database, indexer, port);
    }

    /**
     * Set up routes for the Express application
     * This method combines all the routes from the different API service classes
     */
    protected setupRoutes(): void {
        // Call the parent setupRoutes method to set up the base routes
        super.setupRoutes();

        // Set up blockchain routes
        this.blockchainApi.setupRoutes();

        // Set up token routes
        this.tokensApi.setupRoutes();

        // Set up NFT routes
        this.nftsApi.setupRoutes();
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
    return new CombinedApiService(database, indexer, port);
}

// Re-export all API service classes
export { ApiService } from './core';
export { BlockchainApiService } from './blockchain';
export { TokensApiService } from './tokens';
export { NFTsApiService } from './nfts';

// Re-export utility functions
export * from './utils';
