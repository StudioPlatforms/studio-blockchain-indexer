import { createLogger } from '../../utils/logger';
import { Database } from './core';
import { 
    TokenTransfer, 
    NFTToken, 
    NFTCollection, 
    NFTsByOwnerOptions, 
    NFTTransfersByAddressOptions,
    PaginationOptions
} from './types';

const logger = createLogger('database:nfts');

/**
 * NFTsDatabase class that extends the Database class
 * This class handles operations related to NFTs
 */
export class NFTsDatabase extends Database {
    /**
     * Update NFT metadata
     */
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

    /**
     * Update NFT collection
     */
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

    /**
     * Get NFTs owned by an address
     */
    async getNFTsByOwner(
        ownerAddress: string,
        options: NFTsByOwnerOptions = {}
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

    /**
     * Get NFT metadata
     */
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

    /**
     * Get NFT transfers by address
     */
    async getNFTTransfersByAddress(
        address: string,
        options: NFTTransfersByAddressOptions = {}
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

    /**
     * Get NFT collection
     */
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

    /**
     * Get NFT collections
     */
    async getNFTCollections(
        options: PaginationOptions = {}
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
}
