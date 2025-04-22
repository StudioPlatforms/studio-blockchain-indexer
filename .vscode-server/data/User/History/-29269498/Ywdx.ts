import { ethers } from 'ethers';
import { Database } from './core';
import { BlockchainDatabase } from './blockchain';
import { TokensDatabase } from './tokens';
import { NFTsDatabase } from './nfts';
import { LogsDatabase } from './logs';
import { ContractsDatabase } from './contracts';
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
    private logsDb: LogsDatabase;
    private contractsDb: ContractsDatabase;

    constructor() {
        super();
        this.tokensDb = new TokensDatabase();
        this.nftsDb = new NFTsDatabase();
        this.logsDb = new LogsDatabase();
        this.contractsDb = new ContractsDatabase();
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

    async getTokenHolders(tokenAddress: string, limit?: number, offset?: number): Promise<{ address: string, balance: string, percentage?: number }[]> {
        return this.tokensDb.getTokenHolders(tokenAddress, limit, offset);
    }

    async getTokenHoldersCount(tokenAddress: string): Promise<number> {
        return this.tokensDb.getTokenHoldersCount(tokenAddress);
    }

    async getTokenTransfersCount(tokenAddress: string): Promise<number> {
        return this.tokensDb.getTokenTransfersCount(tokenAddress);
    }
    
    async getAllAddressesWithTokenBalances(): Promise<string[]> {
        return this.tokensDb.getAllAddressesWithTokenBalances();
    }
    
    async updateTokenBalance(
        address: string,
        tokenAddress: string,
        balance: string,
        tokenType: string,
        tokenId?: string
    ): Promise<void> {
        return this.tokensDb.updateTokenBalance(address, tokenAddress, balance, tokenType, tokenId);
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

    // Event logs methods
    async storeEventLog(log: import('../blockchain/types').EventLog): Promise<number> {
        return this.logsDb.storeEventLog(log);
    }

    async storeEventLogs(logs: import('../blockchain/types').EventLog[]): Promise<number> {
        return this.logsDb.storeEventLogs(logs);
    }

    async getEventLogsByTransaction(transactionHash: string): Promise<any[]> {
        return this.logsDb.getEventLogsByTransaction(transactionHash);
    }

    async getEventLogsByContract(address: string, limit?: number, offset?: number): Promise<any[]> {
        return this.logsDb.getEventLogsByContract(address, limit, offset);
    }

    async getEventLogsByTopic(topic: string, limit?: number, offset?: number): Promise<any[]> {
        return this.logsDb.getEventLogsByTopic(topic, limit, offset);
    }

    async getEventLogs(params: {
        address?: string;
        topic0?: string;
        fromBlock?: number;
        toBlock?: number;
        limit?: number;
        offset?: number;
    }): Promise<any[]> {
        return this.logsDb.getEventLogs(params);
    }

    async countEventLogsByContract(address: string): Promise<number> {
        return this.logsDb.countEventLogsByContract(address);
    }

    // Contracts methods
    async storeContract(contract: import('../blockchain/types').ContractData): Promise<string> {
        return this.contractsDb.storeContract(contract);
    }

    async getContract(address: string): Promise<import('../blockchain/types').ContractData | null> {
        return this.contractsDb.getContract(address);
    }

    async getContractsByCreator(creatorAddress: string, limit?: number, offset?: number): Promise<import('../blockchain/types').ContractData[]> {
        return this.contractsDb.getContractsByCreator(creatorAddress, limit, offset);
    }

    async getTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155', limit?: number, offset?: number): Promise<import('../blockchain/types').ContractData[]> {
        return this.contractsDb.getTokenContracts(tokenType, limit, offset);
    }

    async updateContractVerification(
        address: string,
        verified: boolean,
        sourceCode?: string,
        abi?: any,
        compilerVersion?: string,
        optimizationUsed?: boolean,
        runs?: number,
        constructorArguments?: string,
        libraries?: any,
        evmVersion?: string
    ): Promise<boolean> {
        return this.contractsDb.updateContractVerification(
            address,
            verified,
            sourceCode,
            abi,
            compilerVersion,
            optimizationUsed,
            runs,
            constructorArguments,
            libraries,
            evmVersion
        );
    }

    async updateContractTokenStatus(address: string, isToken: boolean, tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<boolean> {
        return this.contractsDb.updateContractTokenStatus(address, isToken, tokenType);
    }

    async countContracts(): Promise<number> {
        return this.contractsDb.countContracts();
    }

    async countTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<number> {
        return this.contractsDb.countTokenContracts(tokenType);
    }
    
    async getContractVerification(address: string): Promise<{
        verified: boolean;
        sourceCode?: string;
        abi?: any;
        compilerVersion?: string;
        optimizationUsed?: boolean;
        runs?: number;
        constructorArguments?: string;
        libraries?: any;
        evmVersion?: string;
        verifiedAt?: Date;
    } | null> {
        return this.contractsDb.getContractVerification(address);
    }

    // Override close method to close all database connections
    async close(): Promise<void> {
        await super.close();
        await this.tokensDb.close();
        await this.nftsDb.close();
        await this.logsDb.close();
        await this.contractsDb.close();
    }
}

// Export the combined database instance
export const db = new CombinedDatabase();

// Export the database classes for testing and extension
export { Database, BlockchainDatabase, TokensDatabase, NFTsDatabase, LogsDatabase, ContractsDatabase };
