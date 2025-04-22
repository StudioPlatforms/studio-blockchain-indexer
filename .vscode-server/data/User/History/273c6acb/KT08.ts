import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { BlockData, TransactionData } from './blockchain';
import { ethers } from 'ethers';

const logger = createLogger('database');

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

class Database {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            host: config.db.host,
            port: config.db.port,
            database: config.db.database,
            user: config.db.user,
            password: config.db.password,
        });
    }

    async getLatestBlock(): Promise<number> {
        try {
            const result = await this.pool.query(
                'SELECT number FROM blocks ORDER BY number DESC LIMIT 1'
            );
            return result.rows[0]?.number || 0;
        } catch (error) {
            logger.error('Error getting latest block:', error);
            throw error;
        }
    }

    async getBlock(blockId: string | number): Promise<BlockData | null> {
        try {
            const query = typeof blockId === 'string'
                ? 'SELECT * FROM blocks WHERE hash = $1'
                : 'SELECT * FROM blocks WHERE number = $1';

            const result = await this.pool.query(query, [blockId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const block = result.rows[0];
            return {
                number: block.number,
                hash: block.hash,
                parentHash: block.parent_hash,
                timestamp: Math.floor(new Date(block.timestamp).getTime() / 1000),
                nonce: block.nonce,
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: ethers.BigNumber.from(block.gas_limit),
                gasUsed: ethers.BigNumber.from(block.gas_used),
                miner: block.miner,
                extraData: block.extra_data,
                transactions: []  // We'll need to fetch transactions separately if needed
            };
        } catch (error) {
            logger.error('Error getting block:', error);
            throw error;
        }
    }

    async insertBlock(block: BlockData): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO blocks (
                    number, hash, parent_hash, timestamp, nonce,
                    difficulty, gas_limit, gas_used, miner, extra_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (number) DO UPDATE SET
                    hash = EXCLUDED.hash,
                    parent_hash = EXCLUDED.parent_hash,
                    timestamp = EXCLUDED.timestamp,
                    nonce = EXCLUDED.nonce,
                    difficulty = EXCLUDED.difficulty,
                    gas_limit = EXCLUDED.gas_limit,
                    gas_used = EXCLUDED.gas_used,
                    miner = EXCLUDED.miner,
                    extra_data = EXCLUDED.extra_data`,
                [
                    block.number,
                    block.hash,
                    block.parentHash,
                    new Date(block.timestamp * 1000),
                    block.nonce,
                    block.difficulty.toString(),
                    block.gasLimit.toString(),
                    block.gasUsed.toString(),
                    block.miner.toLowerCase(),
                    block.extraData,
                ]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error inserting block:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async insertTransaction(tx: TransactionData): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Insert transaction
            await client.query(
                `INSERT INTO transactions (
                    hash, block_number, from_address, to_address,
                    value, gas_price, gas_limit, gas_used, input_data,
                    nonce, transaction_index, status, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (hash) DO UPDATE SET
                    block_number = EXCLUDED.block_number,
                    from_address = EXCLUDED.from_address,
                    to_address = EXCLUDED.to_address,
                    value = EXCLUDED.value,
                    gas_price = EXCLUDED.gas_price,
                    gas_limit = EXCLUDED.gas_limit,
                    gas_used = EXCLUDED.gas_used,
                    input_data = EXCLUDED.input_data,
                    nonce = EXCLUDED.nonce,
                    transaction_index = EXCLUDED.transaction_index,
                    status = EXCLUDED.status,
                    timestamp = EXCLUDED.timestamp`,
                [
                    tx.hash,
                    tx.blockNumber,
                    tx.from.toLowerCase(),
                    tx.to?.toLowerCase(),
                    tx.value.toString(),
                    tx.gasPrice.toString(),
                    tx.gasLimit.toString(),
                    tx.gasLimit.toString(), // Using gasLimit as gasUsed since we don't have gasUsed in the TransactionData
                    tx.data,
                    tx.nonce,
                    tx.transactionIndex,
                    tx.status,
                    new Date(tx.timestamp * 1000),
                ]
            );

            // Update account balances
            await this.updateAccountBalance(client, tx.from);
            if (tx.to) {
                await this.updateAccountBalance(client, tx.to);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error inserting transaction:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async insertTokenTransfer(transfer: TokenTransfer): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO token_transfers (
                    transaction_hash, block_number, token_address, from_address, to_address,
                    value, token_type, token_id, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (transaction_hash, token_address, from_address, to_address, token_id) 
                DO UPDATE SET
                    value = EXCLUDED.value,
                    token_type = EXCLUDED.token_type,
                    timestamp = EXCLUDED.timestamp`,
                [
                    transfer.transactionHash,
                    transfer.blockNumber,
                    transfer.tokenAddress.toLowerCase(),
                    transfer.fromAddress.toLowerCase(),
                    transfer.toAddress.toLowerCase(),
                    transfer.value,
                    transfer.tokenType,
                    transfer.tokenId || null,
                    new Date(transfer.timestamp * 1000),
                ]
            );

            // If this is an NFT transfer, update the NFT token record
            if ((transfer.tokenType === 'ERC721' || transfer.tokenType === 'ERC1155') && transfer.tokenId) {
                await this.updateNFTOwnership(
                    client,
                    transfer.tokenAddress,
                    transfer.tokenId,
                    transfer.toAddress,
                    transfer.timestamp
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error inserting token transfer:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private async updateAccountBalance(
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

    private async updateNFTOwnership(
        client: PoolClient,
        tokenAddress: string,
        tokenId: string,
        ownerAddress: string,
        timestamp: number
    ): Promise<void> {
        try {
            await client.query(
                `INSERT INTO nft_tokens (token_address, token_id, owner_address, last_updated)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (token_address, token_id) DO UPDATE SET
                    owner_address = $3,
                    last_updated = $4`,
                [
                    tokenAddress.toLowerCase(),
                    tokenId,
                    ownerAddress.toLowerCase(),
                    new Date(timestamp * 1000)
                ]
            );
        } catch (error) {
            logger.error('Error updating NFT ownership:', error);
            throw error;
        }
    }

    async updateNFTMetadata(
        tokenAddress: string,
        tokenId: string,
        metadata: any
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Extract common metadata fields
            const name = metadata.name || '';
            const description = metadata.description || '';
            const imageUrl = metadata.image || metadata.image_url || '';

            // Update the NFT token record with metadata
            await client.query(
                `UPDATE nft_tokens 
                SET 
                    name = $3,
                    description = $4,
                    image_url = $5,
                    last_updated = NOW()
                WHERE token_address = $1 AND token_id = $2`,
                [
                    tokenAddress.toLowerCase(),
                    tokenId,
                    name,
                    description,
                    imageUrl
                ]
            );

            // Store the full metadata in the nft_metadata table
            await client.query(
                `INSERT INTO nft_metadata (token_address, token_id, metadata, last_updated)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (token_address, token_id) DO UPDATE SET
                    metadata = $3,
                    last_updated = NOW()`,
                [
                    tokenAddress.toLowerCase(),
                    tokenId,
                    metadata
                ]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error updating NFT metadata:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateNFTCollection(
        tokenAddress: string,
        name: string,
        symbol: string,
        totalSupply?: number
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Update the NFT collection record
            await client.query(
                `INSERT INTO nft_collections (token_address, name, symbol, total_supply, last_updated)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (token_address) DO UPDATE SET
                    name = $2,
                    symbol = $3,
                    total_supply = $4,
                    last_updated = NOW()`,
                [
                    tokenAddress.toLowerCase(),
                    name,
                    symbol,
                    totalSupply
                ]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error updating NFT collection:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getTransaction(hash: string): Promise<TransactionData | null> {
        try {
            const result = await this.pool.query(
                'SELECT * FROM transactions WHERE hash = $1',
                [hash]
            );
            
            if (result.rows.length === 0) {
                return null;
            }

            const tx = result.rows[0];
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
        } catch (error) {
            logger.error('Error getting transaction:', error);
            throw error;
        }
    }

    async getTransactionsByAddress(
        address: string,
        limit: number = 10,
        offset: number = 0
    ): Promise<TransactionData[]> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM transactions 
                WHERE from_address = $1 OR to_address = $1
                ORDER BY block_number DESC, transaction_index DESC
                LIMIT $2 OFFSET $3`,
                [address.toLowerCase(), limit.toString(), offset.toString()]
            );

            return result.rows.map(tx => ({
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
            }));
        } catch (error) {
            logger.error('Error getting transactions by address:', error);
            throw error;
        }
    }

    async getTransactionsByBlock(
        blockNumber: number,
        limit: number = 100,
        offset: number = 0
    ): Promise<TransactionData[]> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM transactions 
                WHERE block_number = $1
                ORDER BY transaction_index ASC
                LIMIT $2 OFFSET $3`,
                [blockNumber, limit.toString(), offset.toString()]
            );

            return result.rows.map(tx => ({
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
            }));
        } catch (error) {
            logger.error('Error getting transactions by block:', error);
            throw error;
        }
    }

    async getTokenTransfers(
        options: {
            tokenAddress?: string;
            fromAddress?: string;
            toAddress?: string;
            tokenId?: string;
            tokenType?: 'ERC20' | 'ERC721' | 'ERC1155';
            limit?: number;
            offset?: number;
        }
    ): Promise<TokenTransfer[]> {
        try {
            const conditions = [];
            const params = [];
            let paramIndex = 1;

            if (options.tokenAddress) {
                conditions.push(`token_address = $${paramIndex++}`);
                params.push(options.tokenAddress.toLowerCase());
            }

            if (options.fromAddress) {
                conditions.push(`from_address = $${paramIndex++}`);
                params.push(options.fromAddress.toLowerCase());
            }

            if (options.toAddress) {
                conditions.push(`to_address = $${paramIndex++}`);
                params.push(options.toAddress.toLowerCase());
            }

            if (options.tokenId) {
                conditions.push(`token_id = $${paramIndex++}`);
                params.push(options.tokenId);
            }

            if (options.tokenType) {
                conditions.push(`token_type = $${paramIndex++}`);
                params.push(options.tokenType);
            }

            const whereClause = conditions.length > 0 
                ? `WHERE ${conditions.join(' AND ')}` 
                : '';

            const limit = options.limit || 10;
            const offset = options.offset || 0;

            params.push(limit.toString());
            params.push(offset.toString());

            const result = await this.pool.query(
                `SELECT * FROM token_transfers 
                ${whereClause}
                ORDER BY block_number DESC, id DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
                params
            );

            return result.rows.map(row => ({
                id: row.id,
                transactionHash: row.transaction_hash,
                blockNumber: row.block_number,
                tokenAddress: row.token_address,
                fromAddress: row.from_address,
                toAddress: row.to_address,
                value: row.value,
                tokenType: row.token_type,
                tokenId: row.token_id,
                timestamp: Math.floor(new Date(row.timestamp).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting token transfers:', error);
            throw error;
        }
    }

    async getNFTsByOwner(
        ownerAddress: string,
        options: {
            tokenAddress?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<NFTToken[]> {
        try {
            const conditions = [`owner_address = $1`];
            const params = [ownerAddress.toLowerCase()];
            let paramIndex = 2;

            if (options.tokenAddress) {
                conditions.push(`token_address = $${paramIndex++}`);
                params.push(options.tokenAddress.toLowerCase());
            }

            const whereClause = conditions.length > 0 
                ? `WHERE ${conditions.join(' AND ')}` 
                : '';

            const limit = options.limit || 10;
            const offset = options.offset || 0;

            params.push(limit.toString());
            params.push(offset.toString());

            const result = await this.pool.query(
                `SELECT n.*, m.metadata 
                FROM nft_tokens n
                LEFT JOIN nft_metadata m ON n.token_address = m.token_address AND n.token_id = m.token_id
                ${whereClause}
                ORDER BY n.last_updated DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
                params
            );

            return result.rows.map(row => ({
                id: row.id,
                tokenAddress: row.token_address,
                tokenId: row.token_id,
                ownerAddress: row.owner_address,
                metadataUri: row.metadata_uri,
                name: row.name,
                description: row.description,
                imageUrl: row.image_url,
                metadata: row.metadata,
                lastUpdated: Math.floor(new Date(row.last_updated).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting NFTs by owner:', error);
            throw error;
        }
    }

    async getNFTMetadata(
        tokenAddress: string,
        tokenId: string
    ): Promise<any | null> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM nft_metadata 
                WHERE token_address = $1 AND token_id = $2`,
                [tokenAddress.toLowerCase(), tokenId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].metadata;
        } catch (error) {
            logger.error('Error getting NFT metadata:', error);
            throw error;
        }
    }

    async getNFTTransfersByAddress(
        address: string,
        options: {
            tokenAddress?: string;
            tokenType?: 'ERC721' | 'ERC1155';
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<TokenTransfer[]> {
        try {
            const conditions = [`(from_address = $1 OR to_address = $1)`];
            const params = [address.toLowerCase()];
            let paramIndex = 2;

            // Only include NFT transfers
            conditions.push(`token_type IN ('ERC721', 'ERC1155')`);

            if (options.tokenAddress) {
                conditions.push(`token_address = $${paramIndex++}`);
                params.push(options.tokenAddress.toLowerCase());
            }

            if (options.tokenType) {
                conditions.push(`token_type = $${paramIndex++}`);
                params.push(options.tokenType);
            }

            const whereClause = conditions.length > 0 
                ? `WHERE ${conditions.join(' AND ')}` 
                : '';

            const limit = options.limit || 10;
            const offset = options.offset || 0;

            params.push(limit.toString());
            params.push(offset.toString());

            const result = await this.pool.query(
                `SELECT * FROM token_transfers 
                ${whereClause}
                ORDER BY block_number DESC, id DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
                params
            );

            return result.rows.map(row => ({
                id: row.id,
                transactionHash: row.transaction_hash,
                blockNumber: row.block_number,
                tokenAddress: row.token_address,
                fromAddress: row.from_address,
                toAddress: row.to_address,
                value: row.value,
                tokenType: row.token_type,
                tokenId: row.token_id,
                timestamp: Math.floor(new Date(row.timestamp).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting NFT transfers by address:', error);
            throw error;
        }
    }

    async getNFTCollection(
        tokenAddress: string
    ): Promise<NFTCollection | null> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM nft_collections 
                WHERE token_address = $1`,
                [tokenAddress.toLowerCase()]
            );
            
            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                tokenAddress: row.token_address,
                name: row.name,
                symbol: row.symbol,
                totalSupply: row.total_supply,
                ownerCount: row.owner_count,
                floorPrice: row.floor_price?.toString(),
                volumeTraded: row.volume_traded?.toString(),
                lastUpdated: Math.floor(new Date(row.last_updated).getTime() / 1000)
            };
        } catch (error) {
            logger.error('Error getting NFT collection:', error);
            throw error;
        }
    }

    async getNFTCollections(
        options: {
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<NFTCollection[]> {
        try {
            const limit = options.limit || 10;
            const offset = options.offset || 0;

            const result = await this.pool.query(
                `SELECT * FROM nft_collections 
                ORDER BY last_updated DESC
                LIMIT $1 OFFSET $2`,
                [limit.toString(), offset.toString()]
            );

            return result.rows.map(row => ({
                id: row.id,
                tokenAddress: row.token_address,
                name: row.name,
                symbol: row.symbol,
                totalSupply: row.total_supply,
                ownerCount: row.owner_count,
                floorPrice: row.floor_price?.toString(),
                volumeTraded: row.volume_traded?.toString(),
                lastUpdated: Math.floor(new Date(row.last_updated).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting NFT collections:', error);
            throw error;
        }
    }

    async getNFTToken(
        tokenAddress: string,
        tokenId: string
    ): Promise<NFTToken | null> {
        try {
            const result = await this.pool.query(
                `SELECT n.*, m.metadata 
                FROM nft_tokens n
                LEFT JOIN nft_metadata m ON n.token_address = m.token_address AND n.token_id = m.token_id
                WHERE n.token_address = $1 AND n.token_id = $2`,
                [tokenAddress.toLowerCase(), tokenId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                tokenAddress: row.token_address,
                tokenId: row.token_id,
                ownerAddress: row.owner_address,
                metadataUri: row.metadata_uri,
                name: row.name,
                description: row.description,
                imageUrl: row.image_url,
                metadata: row.metadata,
                lastUpdated: Math.floor(new Date(row.last_updated).getTime() / 1000)
            };
        } catch (error) {
            logger.error('Error getting NFT token:', error);
            throw error;
        }
    }

    async getTotalTransactions(): Promise<number> {
        try {
            const result = await this.pool.query('SELECT COUNT(*) FROM transactions');
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error getting total transactions:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

export const db = new Database();
