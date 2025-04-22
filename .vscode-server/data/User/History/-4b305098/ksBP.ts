import { ethers } from 'ethers';

export interface BlockData {
    number: number;
    hash: string;
    parentHash: string;
    timestamp: number;
    nonce: string;
    difficulty: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    gasUsed: ethers.BigNumber;
    miner: string;
    extraData: string;
    transactions: string[];
}

export interface TransactionData {
    hash: string;
    blockNumber: number;
    from: string;
    to: string | null;
    value: ethers.BigNumber;
    gasPrice: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    data: string;
    nonce: number;
    transactionIndex: number;
    status?: boolean;
    timestamp: number;
}

export interface ContractData {
    address: string;
    creatorAddress: string;
    ownerAddress?: string;
    blockNumber: number;
    timestamp: number;
    transactionHash: string;
    contractType?: 'ERC20' | 'ERC721' | 'ERC1155' | 'UNKNOWN';
    name?: string;
    symbol?: string;
    decimals?: number;
    totalSupply?: string;
    balance?: string;
    tokenBalances?: TokenBalance[];
}

export interface TokenBalance {
    tokenAddress: string;
    tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
    name?: string;
    symbol?: string;
    balance: string;
    decimals?: number;
    tokenId?: string;
}

export interface LogFilterOptions {
    fromBlock?: number | string;
    toBlock?: number | string;
    address?: string | string[];
    topics?: (string | string[] | null)[];
}

export interface TokenTransferData {
    tokenAddress: string;
    from: string;
    to: string;
    value: string;
    tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
    tokenId?: string;
}
