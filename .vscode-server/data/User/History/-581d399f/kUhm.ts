import { ethers } from 'ethers';

// Re-export blockchain types
export { BlockData, TransactionData } from '../blockchain';

export interface TokenTransfer {
    id?: number;
    transactionHash: string;
    blockNumber: number;
    tokenAddress: string;
    fromAddress: string;
    toAddress: string;
    value: string;
    tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
    tokenId?: string;
    timestamp: number;
}

export interface TokenBalance {
    tokenAddress: string;
    balance: string;
    tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
    isCreator?: boolean;
    hasActivity?: boolean;
    name?: string;
    symbol?: string;
    decimals?: number;
}

export interface NFTToken {
    id?: number;
    tokenAddress: string;
    tokenId: string;
    ownerAddress: string;
    metadataUri?: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    metadata?: any;
    lastUpdated: number;
}

export interface NFTCollection {
    id?: number;
    tokenAddress: string;
    name?: string;
    symbol?: string;
    totalSupply?: number;
    ownerCount?: number;
    floorPrice?: string;
    volumeTraded?: string;
    lastUpdated: number;
}

export interface TokenTransferOptions {
    tokenAddress?: string;
    fromAddress?: string;
    toAddress?: string;
    tokenId?: string;
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155';
    limit?: number;
    offset?: number;
}

export interface AddressTokenTransferOptions {
    tokenAddress?: string;
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155';
    limit?: number;
    offset?: number;
}

export interface TokenBalanceOptions {
    tokenAddress?: string;
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155';
}

export interface NFTsByOwnerOptions {
    tokenAddress?: string;
    limit?: number;
    offset?: number;
}

export interface NFTTransfersByAddressOptions {
    tokenAddress?: string;
    tokenType?: 'ERC721' | 'ERC1155';
    limit?: number;
    offset?: number;
}

export interface PaginationOptions {
    limit?: number;
    offset?: number;
}

// Database interface for dependency injection
export interface IDatabase {
    // Block operations
    getLatestBlock(): Promise<number>;
    getBlock(blockId: string | number): Promise<import('../blockchain').BlockData | null>;
    insertBlock(block: import('../blockchain').BlockData): Promise<void>;
    
    // Transaction operations
    insertTransaction(tx: import('../blockchain').TransactionData): Promise<void>;
    getTransaction(hash: string): Promise<import('../blockchain').TransactionData | null>;
    getTransactionsByAddress(address: string, limit?: number, offset?: number): Promise<import('../blockchain').TransactionData[]>;
    getLatestTransactions(limit?: number, offset?: number): Promise<import('../blockchain').TransactionData[]>;
    getTransactionsByBlock(blockNumber: number, limit?: number, offset?: number): Promise<import('../blockchain').TransactionData[]>;
    
    // Token operations
    insertTokenTransfer(transfer: TokenTransfer): Promise<void>;
    getTokenTransfers(options: TokenTransferOptions): Promise<TokenTransfer[]>;
    getAddressTokenTransfers(address: string, options?: AddressTokenTransferOptions): Promise<TokenTransfer[]>;
    getAddressTokenBalances(address: string, options?: TokenBalanceOptions): Promise<TokenBalance[]>;
    getTokenHolders(tokenAddress: string, limit?: number, offset?: number): Promise<{ address: string, balance: string, percentage?: number }[]>;
    getTokenHoldersCount(tokenAddress: string): Promise<number>;
    getTokenTransfersCount(tokenAddress: string): Promise<number>;
    getAllAddressesWithTokenBalances(): Promise<string[]>;
    updateTokenBalance(
        address: string,
        tokenAddress: string,
        balance: string,
        tokenType: string,
        tokenId?: string
    ): Promise<void>;
    
    // NFT operations
    updateNFTMetadata(tokenAddress: string, tokenId: string, metadata: any): Promise<void>;
    updateNFTCollection(tokenAddress: string, name: string, symbol: string, totalSupply?: number): Promise<void>;
    getNFTsByOwner(ownerAddress: string, options?: NFTsByOwnerOptions): Promise<NFTToken[]>;
    getNFTMetadata(tokenAddress: string, tokenId: string): Promise<any | null>;
    getNFTTransfersByAddress(address: string, options?: NFTTransfersByAddressOptions): Promise<TokenTransfer[]>;
    getNFTCollection(tokenAddress: string): Promise<NFTCollection | null>;
    getNFTCollections(options?: PaginationOptions): Promise<NFTCollection[]>;
    
    // Event logs operations
    storeEventLog(log: import('../blockchain/types').EventLog): Promise<number>;
    storeEventLogs(logs: import('../blockchain/types').EventLog[]): Promise<number>;
    getEventLogsByTransaction(transactionHash: string): Promise<any[]>;
    getEventLogsByContract(address: string, limit?: number, offset?: number): Promise<any[]>;
    getEventLogsByTopic(topic: string, limit?: number, offset?: number): Promise<any[]>;
    getEventLogs(params: {
        address?: string;
        topic0?: string;
        fromBlock?: number;
        toBlock?: number;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    countEventLogsByContract(address: string): Promise<number>;
    
    // Contracts operations
    storeContract(contract: import('../blockchain/types').ContractData): Promise<string>;
    getContract(address: string): Promise<import('../blockchain/types').ContractData | null>;
    getContractsByCreator(creatorAddress: string, limit?: number, offset?: number): Promise<import('../blockchain/types').ContractData[]>;
    getTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155', limit?: number, offset?: number): Promise<import('../blockchain/types').ContractData[]>;
    updateContractVerification(
        address: string,
        verified: boolean,
        sourceCode?: string,
        abi?: any,
        compilerVersion?: string,
        optimizationUsed?: boolean,
        runs?: number,
        constructorArguments?: string,
        libraries?: any
    ): Promise<boolean>;
    getContractVerification(address: string): Promise<{
        verified: boolean;
        sourceCode?: string;
        abi?: any;
        compilerVersion?: string;
        optimizationUsed?: boolean;
        runs?: number;
        constructorArguments?: string;
        libraries?: any;
        verifiedAt?: Date;
    } | null>;
    updateContractTokenStatus(address: string, isToken: boolean, tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<boolean>;
    countContracts(): Promise<number>;
    countTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<number>;
    
    // Utility
    close(): Promise<void>;
}
