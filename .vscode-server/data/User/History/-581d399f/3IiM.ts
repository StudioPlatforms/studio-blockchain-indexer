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
    
    // NFT operations
    updateNFTMetadata(tokenAddress: string, tokenId: string, metadata: any): Promise<void>;
    updateNFTCollection(tokenAddress: string, name: string, symbol: string, totalSupply?: number): Promise<void>;
    getNFTsByOwner(ownerAddress: string, options?: NFTsByOwnerOptions): Promise<NFTToken[]>;
    getNFTMetadata(tokenAddress: string, tokenId: string): Promise<any | null>;
    getNFTTransfersByAddress(address: string, options?: NFTTransfersByAddressOptions): Promise<TokenTransfer[]>;
    getNFTCollection(tokenAddress: string): Promise<NFTCollection | null>;
    getNFTCollections(options?: PaginationOptions): Promise<NFTCollection[]>;
    
    // Utility
    close(): Promise<void>;
}
