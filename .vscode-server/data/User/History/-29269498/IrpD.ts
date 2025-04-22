import { ethers } from 'ethers';
import { Database } from './core';
import { BlockchainDatabase } from './blockchain';
import { TokensDatabase } from './tokens';
import { NFTsDatabase } from './nfts';
import { IDatabase } from './types';

// Re-export all types
export * from './types';

/**
 * Combined database class that extends all the database classes
 * This class combines all the functionality from the different database classes
 */
class CombinedDatabase extends BlockchainDatabase implements IDatabase {
    private tokensDb: TokensDatabase;
    private nftsDb: NFTsDatabase;

    constructor() {
        super();
        this.tokensDb = new TokensDatabase();
        this.nftsDb = new NFTsDatabase();
    }

    // Override token methods to use the TokensDatabase
    async insertTokenTransfer(transfer: import('./types').TokenTransfer): Promise<void> {
        return this.tokensDb.insertTokenTransfer(transfer);
    }

    async getTokenTransfers(options: import('./types').TokenTransferOptions): Promise<import('./types').TokenTransfer[]> {
        return this.tokensDb.getTokenTransfers(options);
    }

    async getAddressTokenTransfers(address: string, options?: import('./types').AddressTokenTransferOptions): Promise<import('./types').TokenTransfer[]> {
        return this.tokensDb.getAddressTokenTransfers(address, options);
    }

    async getAddressTokenBalances(address: string, options?: import('./types').TokenBalanceOptions): Promise<import('./types').TokenBalance[]> {
        return this.tokensDb.getAddressTokenBalances(address, options);
    }

    // Override NFT methods to use the NFTsDatabase
    async updateNFTMetadata(tokenAddress: string, tokenId: string, metadata: any): Promise<void> {
        return this.nftsDb.updateNFTMetadata(tokenAddress, tokenId, metadata);
    }

    async updateNFTCollection(tokenAddress: string, name: string, symbol: string, totalSupply?: number): Promise<void> {
        return this.nftsDb.updateNFTCollection(tokenAddress, name, symbol, totalSupply);
    }

    async getNFTsByOwner(ownerAddress: string, options?: import('./types').NFTsByOwnerOptions): Promise<import('./types').NFTToken[]> {
        return this.nftsDb.getNFTsByOwner(ownerAddress, options);
    }

    async getNFTMetadata(tokenAddress: string, tokenId: string): Promise<any | null> {
        return this.nftsDb.getNFTMetadata(tokenAddress, tokenId);
    }

    async getNFTTransfersByAddress(address: string, options?: import('./types').NFTTransfersByAddressOptions): Promise<import('./types').TokenTransfer[]> {
        return this.nftsDb.getNFTTransfersByAddress(address, options);
    }

    async getNFTCollection(tokenAddress: string): Promise<import('./types').NFTCollection | null> {
        return this.nftsDb.getNFTCollection(tokenAddress);
    }

    async getNFTCollections(options?: import('./types').PaginationOptions): Promise<import('./types').NFTCollection[]> {
        return this.nftsDb.getNFTCollections(options);
    }

    // Override close method to close all database connections
    async close(): Promise<void> {
        await super.close();
        await this.tokensDb.close();
        await this.nftsDb.close();
    }
}

// Export the combined database instance
export const db = new CombinedDatabase();

// Export the database classes for testing and extension
export { Database, BlockchainDatabase, TokensDatabase, NFTsDatabase };
