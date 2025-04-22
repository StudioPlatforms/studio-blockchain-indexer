import { Pool, PoolClient } from 'pg';
import { ethers } from 'ethers';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { IDatabase } from './types';
import { BlockData, TransactionData } from '../blockchain';
import { 
    TokenTransfer, 
    TokenTransferOptions, 
    TokenBalance, 
    TokenBalanceOptions,
    NFTToken,
    NFTCollection,
    NFTsByOwnerOptions,
    NFTTransfersByAddressOptions,
    AddressTokenTransferOptions,
    PaginationOptions
} from './types';

const logger = createLogger('database:core');

/**
 * Core Database class that implements the IDatabase interface
 * This class handles the connection to the PostgreSQL database
 * and provides methods for interacting with the database
 */
export class Database implements IDatabase {
    protected pool: Pool;

    constructor() {
        this.pool = new Pool({
            host: config.db.host,
            port: config.db.port,
            database: config.db.database,
            user: config.db.user,
            password: config.db.password,
        });
        
        logger.info(`Connected to database ${config.db.database} at ${config.db.host}:${config.db.port}`);
    }

    /**
     * Helper method to update an account's balance
     */
    protected async updateAccountBalance(
        client: PoolClient,
        address: string
    ): Promise<void> {
        try {
            await client.query(
                `INSERT INTO accounts (address, first_seen, last_seen)
                VALUES ($1, NOW(), NOW())
                ON CONFLICT (address) DO UPDATE SET
                    last_seen = NOW()`,
                [address.toLowerCase()]
            );
        } catch (error) {
            logger.error('Error updating account:', error);
            throw error;
        }
    }

    /**
     * Helper method to map a transaction row to a TransactionData object
     */
    protected mapTransactionRow(tx: any): TransactionData {
        return {
            hash: tx.hash,
            blockNumber: tx.block_number,
            from: tx.from_address,
            to: tx.to_address,
            value: ethers.BigNumber.from(tx.value),
            gasLimit: ethers.BigNumber.from(tx.gas_limit),
            gasPrice: ethers.BigNumber.from(tx.gas_price),
            data: tx.input_data,
            nonce: tx.nonce,
            transactionIndex: tx.transaction_index,
            status: tx.status,
            timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000)
        };
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        await this.pool.end();
        logger.info('Database connection closed');
    }

    // The following methods are implemented in the subclasses
    
    // Block operations
    async getLatestBlock(): Promise<number> {
        throw new Error('Method not implemented in core class');
    }

    async getBlock(blockId: string | number): Promise<BlockData | null> {
        throw new Error('Method not implemented in core class');
    }

    async insertBlock(block: BlockData): Promise<void> {
        throw new Error('Method not implemented in core class');
    }

    // Transaction operations
    async insertTransaction(tx: TransactionData): Promise<void> {
        throw new Error('Method not implemented in core class');
    }

    async getTransaction(hash: string): Promise<TransactionData | null> {
        throw new Error('Method not implemented in core class');
    }

    async getTransactionsByAddress(address: string, limit?: number, offset?: number): Promise<TransactionData[]> {
        throw new Error('Method not implemented in core class');
    }

    async getLatestTransactions(limit?: number, offset?: number): Promise<TransactionData[]> {
        throw new Error('Method not implemented in core class');
    }

    async getTransactionsByBlock(blockNumber: number, limit?: number, offset?: number): Promise<TransactionData[]> {
        throw new Error('Method not implemented in core class');
    }

    // Token operations
    async insertTokenTransfer(transfer: TokenTransfer): Promise<void> {
        throw new Error('Method not implemented in core class');
    }

    async getTokenTransfers(options: TokenTransferOptions): Promise<TokenTransfer[]> {
        throw new Error('Method not implemented in core class');
    }

    async getAddressTokenTransfers(address: string, options?: AddressTokenTransferOptions): Promise<TokenTransfer[]> {
        throw new Error('Method not implemented in core class');
    }

    async getAddressTokenBalances(address: string, options?: TokenBalanceOptions): Promise<TokenBalance[]> {
        throw new Error('Method not implemented in core class');
    }

    async getTokenHolders(tokenAddress: string, limit?: number, offset?: number): Promise<{ address: string, balance: string, percentage?: number }[]> {
        throw new Error('Method not implemented in core class');
    }

    async getTokenHoldersCount(tokenAddress: string): Promise<number> {
        throw new Error('Method not implemented in core class');
    }

    async getTokenTransfersCount(tokenAddress: string): Promise<number> {
        throw new Error('Method not implemented in core class');
    }

    async getAllAddressesWithTokenBalances(): Promise<string[]> {
        throw new Error('Method not implemented in core class');
    }

    async updateTokenBalance(
        address: string,
        tokenAddress: string,
        balance: string,
        tokenType: string,
        tokenId?: string
    ): Promise<void> {
        throw new Error('Method not implemented in core class');
    }

    // NFT operations
    async updateNFTMetadata(tokenAddress: string, tokenId: string, metadata: any): Promise<void> {
        throw new Error('Method not implemented in core class');
    }

    async updateNFTCollection(tokenAddress: string, name: string, symbol: string, totalSupply?: number): Promise<void> {
        throw new Error('Method not implemented in core class');
    }

    async getNFTsByOwner(ownerAddress: string, options?: NFTsByOwnerOptions): Promise<NFTToken[]> {
        throw new Error('Method not implemented in core class');
    }

    async getNFTMetadata(tokenAddress: string, tokenId: string): Promise<any | null> {
        throw new Error('Method not implemented in core class');
    }

    async getNFTTransfersByAddress(address: string, options?: NFTTransfersByAddressOptions): Promise<TokenTransfer[]> {
        throw new Error('Method not implemented in core class');
    }

    async getNFTCollection(tokenAddress: string): Promise<NFTCollection | null> {
        throw new Error('Method not implemented in core class');
    }

    async getNFTCollections(options?: PaginationOptions): Promise<NFTCollection[]> {
        throw new Error('Method not implemented in core class');
    }

    // Event logs operations
    async storeEventLog(log: import('../blockchain/types').EventLog): Promise<number> {
        throw new Error('Method not implemented in core class');
    }

    async storeEventLogs(logs: import('../blockchain/types').EventLog[]): Promise<number> {
        throw new Error('Method not implemented in core class');
    }

    async getEventLogsByTransaction(transactionHash: string): Promise<any[]> {
        throw new Error('Method not implemented in core class');
    }

    async getEventLogsByContract(address: string, limit?: number, offset?: number): Promise<any[]> {
        throw new Error('Method not implemented in core class');
    }

    async getEventLogsByTopic(topic: string, limit?: number, offset?: number): Promise<any[]> {
        throw new Error('Method not implemented in core class');
    }

    async getEventLogs(params: {
        address?: string;
        topic0?: string;
        fromBlock?: number;
        toBlock?: number;
        limit?: number;
        offset?: number;
    }): Promise<any[]> {
        throw new Error('Method not implemented in core class');
    }

    async countEventLogsByContract(address: string): Promise<number> {
        throw new Error('Method not implemented in core class');
    }
    
    // Contracts operations
    async storeContract(contract: import('../blockchain/types').ContractData): Promise<string> {
        throw new Error('Method not implemented in core class');
    }

    async getContract(address: string): Promise<import('../blockchain/types').ContractData | null> {
        throw new Error('Method not implemented in core class');
    }

    async getContractsByCreator(creatorAddress: string, limit?: number, offset?: number): Promise<import('../blockchain/types').ContractData[]> {
        throw new Error('Method not implemented in core class');
    }

    async getTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155', limit?: number, offset?: number): Promise<import('../blockchain/types').ContractData[]> {
        throw new Error('Method not implemented in core class');
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
        libraries?: any
    ): Promise<boolean> {
        throw new Error('Method not implemented.');
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
        verifiedAt?: Date;
    } | null> {
        throw new Error('Method not implemented.');
    }

    async updateContractTokenStatus(address: string, isToken: boolean, tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<boolean> {
        throw new Error('Method not implemented in core class');
    }

    async countContracts(): Promise<number> {
        throw new Error('Method not implemented in core class');
    }

    async countTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<number> {
        throw new Error('Method not implemented in core class');
    }
}
