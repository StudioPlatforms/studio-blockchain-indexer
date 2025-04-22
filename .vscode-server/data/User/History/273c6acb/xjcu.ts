import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { BlockData, TransactionData } from './blockchain';
import { ethers } from 'ethers';

const logger = createLogger('database');

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
                [address.toLowerCase(), limit, offset]
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
                [blockNumber, limit, offset]
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
