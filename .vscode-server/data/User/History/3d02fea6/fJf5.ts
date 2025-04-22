import { PoolClient } from 'pg';
import { createLogger } from '../../utils/logger';
import { Database } from './core';
import { 
    TokenTransfer, 
    TokenTransferOptions, 
    TokenBalance, 
    TokenBalanceOptions,
    AddressTokenTransferOptions
} from './types';

const logger = createLogger('database:tokens');

/**
 * TokensDatabase class that extends the Database class
 * This class handles operations related to tokens
 */
export class TokensDatabase extends Database {
    /**
     * Insert a token transfer into the database
     */
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

    /**
     * Helper method to update NFT ownership
     */
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

    /**
     * Get token transfers based on options
     */
    async getTokenTransfers(options: TokenTransferOptions): Promise<TokenTransfer[]> {
        try {
            const conditions = [];
            const params = [];
            let paramIndex = 1;

            if (options.tokenAddress) {
                conditions.push(`token_address = $${paramIndex++}`);
                params.push(options.tokenAddress.toLowerCase());
            }

            // Handle fromAddress and toAddress with OR condition if both are provided
            if (options.fromAddress && options.toAddress) {
                // If the same address is provided for both, we want transfers where the address is either the sender OR receiver
                if (options.fromAddress.toLowerCase() === options.toAddress.toLowerCase()) {
                    conditions.push(`(from_address = $${paramIndex} OR to_address = $${paramIndex})`);
                    params.push(options.fromAddress.toLowerCase());
                    paramIndex++;
                } else {
                    // If different addresses are provided, we want transfers from the fromAddress to the toAddress
                    conditions.push(`(from_address = $${paramIndex} AND to_address = $${paramIndex + 1})`);
                    params.push(options.fromAddress.toLowerCase());
                    params.push(options.toAddress.toLowerCase());
                    paramIndex += 2;
                }
            } else if (options.fromAddress) {
                conditions.push(`from_address = $${paramIndex++}`);
                params.push(options.fromAddress.toLowerCase());
            } else if (options.toAddress) {
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

    /**
     * Get token transfers for an address
     */
    async getAddressTokenTransfers(
        address: string,
        options: AddressTokenTransferOptions = {}
    ): Promise<TokenTransfer[]> {
        try {
            const conditions = [`(from_address = $1 OR to_address = $1)`];
            const params = [address.toLowerCase()];
            let paramIndex = 2;

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
            logger.error('Error getting token transfers for address:', error);
            throw error;
        }
    }

    /**
     * Get token balances for an address
     */
    async getAddressTokenBalances(
        address: string,
        options: TokenBalanceOptions = {}
    ): Promise<TokenBalance[]> {
        try {
            const conditions = [];
            const params = [address.toLowerCase()];
            let paramIndex = 2;

            if (options.tokenAddress) {
                conditions.push(`token_address = $${paramIndex++}`);
                params.push(options.tokenAddress.toLowerCase());
            }

            if (options.tokenType) {
                conditions.push(`token_type = $${paramIndex++}`);
                params.push(options.tokenType);
            }

            const whereClause = conditions.length > 0 
                ? `AND ${conditions.join(' AND ')}` 
                : '';

            // Calculate token balances by summing up transfers
            const query = `
                SELECT 
                    token_address,
                    token_type,
                    SUM(CASE 
                        WHEN to_address = $1 THEN value::numeric 
                        ELSE 0 
                    END) - 
                    SUM(CASE 
                        WHEN from_address = $1 THEN value::numeric 
                        ELSE 0 
                    END) as balance
                FROM 
                    token_transfers
                WHERE 
                    (from_address = $1 OR to_address = $1)
                    ${whereClause}
                GROUP BY 
                    token_address, token_type
                HAVING 
                    SUM(CASE 
                        WHEN to_address = $1 THEN value::numeric 
                        ELSE 0 
                    END) - 
                    SUM(CASE 
                        WHEN from_address = $1 THEN value::numeric 
                        ELSE 0 
                    END) > 0
            `;

            const result = await this.pool.query(query, params);

            return result.rows.map(row => ({
                tokenAddress: row.token_address,
                balance: row.balance,
                tokenType: row.token_type
            }));
        } catch (error) {
            logger.error('Error getting token balances for address:', error);
            throw error;
        }
    }
}
