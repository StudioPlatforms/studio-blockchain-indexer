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
                ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))
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

            // Update ERC20 balances for from and to addresses
            if (transfer.tokenType === 'ERC20') {
                // Only deduct balance from sender if it's not the zero address (minting)
                if (transfer.fromAddress !== '0x0000000000000000000000000000000000000000') {
                    await client.query(
                        `INSERT INTO token_balances (address, token_address, token_type, balance, updated_at)
                        VALUES ($1, $2, $3, '0', NOW())
                        ON CONFLICT (address, token_address, COALESCE(token_id, '')) 
                        DO UPDATE SET
                            balance = (
                                CASE
                                    WHEN token_balances.balance::numeric - $4::numeric < 0 THEN '0'
                                    ELSE (token_balances.balance::numeric - $4::numeric)::text
                                END
                            ),
                            updated_at = NOW()`,
                        [
                            transfer.fromAddress.toLowerCase(),
                            transfer.tokenAddress.toLowerCase(),
                            transfer.tokenType,
                            transfer.value
                        ]
                    );
                }

                // Only add balance to receiver if it's not the zero address (burning)
                if (transfer.toAddress !== '0x0000000000000000000000000000000000000000') {
                    await client.query(
                        `INSERT INTO token_balances (address, token_address, token_type, balance, updated_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (address, token_address, COALESCE(token_id, '')) 
                        DO UPDATE SET
                            balance = (token_balances.balance::numeric + $4::numeric)::text,
                            updated_at = NOW()`,
                        [
                            transfer.toAddress.toLowerCase(),
                            transfer.tokenAddress.toLowerCase(),
                            transfer.tokenType,
                            transfer.value
                        ]
                    );
                }
                
                // Update is_creator flag for minting events
                if (transfer.fromAddress === '0x0000000000000000000000000000000000000000' && 
                    transfer.toAddress !== '0x0000000000000000000000000000000000000000') {
                    await client.query(
                        `UPDATE token_balances
                        SET is_creator = TRUE, updated_at = NOW()
                        WHERE address = $1 AND token_address = $2`,
                        [
                            transfer.toAddress.toLowerCase(),
                            transfer.tokenAddress.toLowerCase()
                        ]
                    );
                    
                    // Try to update the contract record with the creator address
                    await client.query(
                        `UPDATE contracts 
                        SET creator_address = $1, updated_at = NOW()
                        WHERE address = $2 AND creator_address = '0x0000000000000000000000000000000000000000'`,
                        [
                            transfer.toAddress.toLowerCase(),
                            transfer.tokenAddress.toLowerCase()
                        ]
                    );
                }
            }

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
            const conditions = [`address = $1`];
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

            // Get token balances from the token_balances table
            // Include tokens with zero balances if the address has historical activity
            const query = `
                SELECT 
                    tb.token_address,
                    tb.token_type,
                    tb.balance,
                    tb.is_creator,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM token_transfers tt 
                            WHERE (tt.from_address = $1 OR tt.to_address = $1) 
                            AND tt.token_address = tb.token_address
                        ) THEN TRUE 
                        ELSE FALSE 
                    END as has_activity
                FROM 
                    token_balances tb
                ${whereClause}
                ORDER BY 
                    tb.balance::numeric DESC,
                    tb.is_creator DESC,
                    has_activity DESC
            `;

            const result = await this.pool.query(query, params);

            return result.rows.map(row => ({
                tokenAddress: row.token_address,
                balance: row.balance,
                tokenType: row.token_type,
                isCreator: row.is_creator,
                hasActivity: row.has_activity
            }));
        } catch (error) {
            logger.error('Error getting token balances for address:', error);
            throw error;
        }
    }

    /**
     * Get token holders
     */
    async getTokenHolders(
        tokenAddress: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<{ address: string, balance: string, percentage?: number }[]> {
        try {
            // Get token holders from the token_balances table
            const query = `
                SELECT 
                    address,
                    balance,
                    balance::numeric / (
                        SELECT SUM(balance::numeric) FROM token_balances 
                        WHERE token_address = $1 AND balance::numeric > 0
                    ) * 100 as percentage
                FROM 
                    token_balances
                WHERE 
                    token_address = $1
                    AND balance::numeric > 0
                ORDER BY 
                    balance DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await this.pool.query(query, [
                tokenAddress.toLowerCase(),
                limit,
                offset
            ]);

            return result.rows.map(row => ({
                address: row.address,
                balance: row.balance,
                percentage: parseFloat(row.percentage) || 0
            }));
        } catch (error) {
            logger.error(`Error getting token holders for ${tokenAddress}:`, error);
            return [];
        }
    }

    /**
     * Get token holders count
     */
    async getTokenHoldersCount(tokenAddress: string): Promise<number> {
        try {
            const query = `
                SELECT 
                    COUNT(*) as count
                FROM 
                    token_balances
                WHERE 
                    token_address = $1
                    AND balance::numeric > 0
            `;

            const result = await this.pool.query(query, [tokenAddress.toLowerCase()]);
            return parseInt(result.rows[0].count) || 0;
        } catch (error) {
            logger.error(`Error getting token holders count for ${tokenAddress}:`, error);
            return 0;
        }
    }

    /**
     * Get token transfers count
     */
    async getTokenTransfersCount(tokenAddress: string): Promise<number> {
        try {
            const query = `
                SELECT 
                    COUNT(*) as count
                FROM 
                    token_transfers
                WHERE 
                    token_address = $1
            `;

            const result = await this.pool.query(query, [tokenAddress.toLowerCase()]);
            return parseInt(result.rows[0].count) || 0;
        } catch (error) {
            logger.error(`Error getting token transfers count for ${tokenAddress}:`, error);
            return 0;
        }
    }
    
    /**
     * Get all addresses with token balances
     * This is used for the full token balance update
     */
    async getAllAddressesWithTokenBalances(): Promise<string[]> {
        try {
            const query = `
                SELECT DISTINCT address
                FROM token_balances
                WHERE balance::numeric > 0
                ORDER BY address
            `;

            const result = await this.pool.query(query);
            return result.rows.map(row => row.address);
        } catch (error) {
            logger.error('Error getting all addresses with token balances:', error);
            return [];
        }
    }
    
    /**
     * Directly update a token balance in the database
     * This is used when we want to set a specific balance value from the blockchain
     */
    async updateTokenBalance(
        address: string,
        tokenAddress: string,
        balance: string,
        tokenType: string,
        tokenId?: string
    ): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO token_balances (address, token_address, token_type, balance, token_id, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (address, token_address, COALESCE(token_id, '')) 
                DO UPDATE SET
                    balance = EXCLUDED.balance,
                    token_type = EXCLUDED.token_type,
                    updated_at = NOW()`,
                [
                    address.toLowerCase(),
                    tokenAddress.toLowerCase(),
                    tokenType,
                    balance,
                    tokenId || null
                ]
            );
            
            logger.info(`Directly updated token balance for ${address} and token ${tokenAddress} to ${balance}`);
        } catch (error) {
            logger.error(`Error updating token balance for ${address} and token ${tokenAddress}:`, error);
            throw error;
        }
    }
}
