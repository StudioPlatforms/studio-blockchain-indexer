import { Pool } from 'pg';
import { createLogger } from '../../utils/logger';
import { EventLog } from '../blockchain/types';
import { Database } from './core';

const logger = createLogger('database:logs');

/**
 * Database service for event logs
 */
export class LogsDatabase extends Database {
    /**
     * Store an event log in the database
     * @param log The event log to store
     * @returns The ID of the stored log
     */
    async storeEventLog(log: EventLog): Promise<number> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Extract topics
            const topic0 = log.topics.length > 0 ? log.topics[0] : null;
            const topic1 = log.topics.length > 1 ? log.topics[1] : null;
            const topic2 = log.topics.length > 2 ? log.topics[2] : null;
            const topic3 = log.topics.length > 3 ? log.topics[3] : null;

            // Insert the log
            const result = await client.query(
                `INSERT INTO event_logs (
                    transaction_hash, block_number, log_index, address,
                    topic0, topic1, topic2, topic3, data, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (transaction_hash, log_index) DO UPDATE SET
                    block_number = EXCLUDED.block_number,
                    address = EXCLUDED.address,
                    topic0 = EXCLUDED.topic0,
                    topic1 = EXCLUDED.topic1,
                    topic2 = EXCLUDED.topic2,
                    topic3 = EXCLUDED.topic3,
                    data = EXCLUDED.data,
                    timestamp = EXCLUDED.timestamp
                RETURNING id`,
                [
                    log.transactionHash,
                    log.blockNumber,
                    log.logIndex,
                    log.address.toLowerCase(),
                    topic0,
                    topic1,
                    topic2,
                    topic3,
                    log.data,
                    new Date(log.timestamp * 1000)
                ]
            );

            await client.query('COMMIT');
            return result.rows[0].id;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error storing event log:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Store multiple event logs in the database
     * @param logs The event logs to store
     * @returns The number of logs stored
     */
    async storeEventLogs(logs: EventLog[]): Promise<number> {
        if (logs.length === 0) {
            return 0;
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            let count = 0;
            for (const log of logs) {
                // Extract topics
                const topic0 = log.topics.length > 0 ? log.topics[0] : null;
                const topic1 = log.topics.length > 1 ? log.topics[1] : null;
                const topic2 = log.topics.length > 2 ? log.topics[2] : null;
                const topic3 = log.topics.length > 3 ? log.topics[3] : null;

                // Insert the log
                await client.query(
                    `INSERT INTO event_logs (
                        transaction_hash, block_number, log_index, address,
                        topic0, topic1, topic2, topic3, data, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (transaction_hash, log_index) DO UPDATE SET
                        block_number = EXCLUDED.block_number,
                        address = EXCLUDED.address,
                        topic0 = EXCLUDED.topic0,
                        topic1 = EXCLUDED.topic1,
                        topic2 = EXCLUDED.topic2,
                        topic3 = EXCLUDED.topic3,
                        data = EXCLUDED.data,
                        timestamp = EXCLUDED.timestamp`,
                    [
                        log.transactionHash,
                        log.blockNumber,
                        log.logIndex,
                        log.address.toLowerCase(),
                        topic0,
                        topic1,
                        topic2,
                        topic3,
                        log.data,
                        new Date(log.timestamp * 1000)
                    ]
                );

                count++;
            }

            await client.query('COMMIT');
            return count;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error storing event logs:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get event logs by transaction hash
     * @param transactionHash The transaction hash
     * @returns The event logs
     */
    async getEventLogsByTransaction(transactionHash: string): Promise<any[]> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM event_logs WHERE transaction_hash = $1 ORDER BY log_index ASC`,
                [transactionHash]
            );

            return result.rows.map(log => ({
                id: log.id,
                transactionHash: log.transaction_hash,
                blockNumber: log.block_number,
                logIndex: log.log_index,
                address: log.address,
                topics: [log.topic0, log.topic1, log.topic2, log.topic3].filter(Boolean),
                data: log.data,
                timestamp: Math.floor(new Date(log.timestamp).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting event logs by transaction:', error);
            throw error;
        }
    }

    /**
     * Get event logs by contract address
     * @param address The contract address
     * @param limit The maximum number of logs to return
     * @param offset The offset to start from
     * @returns The event logs
     */
    async getEventLogsByContract(
        address: string,
        limit: number = 10,
        offset: number = 0
    ): Promise<any[]> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM event_logs 
                WHERE address = $1 
                ORDER BY block_number DESC, log_index ASC
                LIMIT $2 OFFSET $3`,
                [address.toLowerCase(), limit, offset]
            );

            return result.rows.map(log => ({
                id: log.id,
                transactionHash: log.transaction_hash,
                blockNumber: log.block_number,
                logIndex: log.log_index,
                address: log.address,
                topics: [log.topic0, log.topic1, log.topic2, log.topic3].filter(Boolean),
                data: log.data,
                timestamp: Math.floor(new Date(log.timestamp).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting event logs by contract:', error);
            throw error;
        }
    }

    /**
     * Get event logs by topic
     * @param topic The topic
     * @param limit The maximum number of logs to return
     * @param offset The offset to start from
     * @returns The event logs
     */
    async getEventLogsByTopic(
        topic: string,
        limit: number = 10,
        offset: number = 0
    ): Promise<any[]> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM event_logs 
                WHERE topic0 = $1 OR topic1 = $1 OR topic2 = $1 OR topic3 = $1
                ORDER BY block_number DESC, log_index ASC
                LIMIT $2 OFFSET $3`,
                [topic, limit, offset]
            );

            return result.rows.map(log => ({
                id: log.id,
                transactionHash: log.transaction_hash,
                blockNumber: log.block_number,
                logIndex: log.log_index,
                address: log.address,
                topics: [log.topic0, log.topic1, log.topic2, log.topic3].filter(Boolean),
                data: log.data,
                timestamp: Math.floor(new Date(log.timestamp).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting event logs by topic:', error);
            throw error;
        }
    }

    /**
     * Get event logs by various parameters
     * @param params The parameters to filter by
     * @returns The event logs
     */
    async getEventLogs(params: {
        address?: string;
        topic0?: string;
        fromBlock?: number;
        toBlock?: number;
        limit?: number;
        offset?: number;
    }): Promise<any[]> {
        try {
            const conditions = [];
            const queryParams = [];
            let paramIndex = 1;

            if (params.address) {
                conditions.push(`address = $${paramIndex++}`);
                queryParams.push(params.address.toLowerCase());
            }

            if (params.topic0) {
                conditions.push(`topic0 = $${paramIndex++}`);
                queryParams.push(params.topic0);
            }

            if (params.fromBlock) {
                conditions.push(`block_number >= $${paramIndex++}`);
                queryParams.push(params.fromBlock);
            }

            if (params.toBlock) {
                conditions.push(`block_number <= $${paramIndex++}`);
                queryParams.push(params.toBlock);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const limit = params.limit || 10;
            const offset = params.offset || 0;

            queryParams.push(limit);
            queryParams.push(offset);

            const result = await this.pool.query(
                `SELECT * FROM event_logs 
                ${whereClause} 
                ORDER BY block_number DESC, log_index ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
                queryParams
            );

            return result.rows.map(log => ({
                id: log.id,
                transactionHash: log.transaction_hash,
                blockNumber: log.block_number,
                logIndex: log.log_index,
                address: log.address,
                topics: [log.topic0, log.topic1, log.topic2, log.topic3].filter(Boolean),
                data: log.data,
                timestamp: Math.floor(new Date(log.timestamp).getTime() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting event logs:', error);
            throw error;
        }
    }

    /**
     * Count event logs by contract address
     * @param address The contract address
     * @returns The number of event logs
     */
    async countEventLogsByContract(address: string): Promise<number> {
        try {
            const result = await this.pool.query(
                `SELECT COUNT(*) FROM event_logs WHERE address = $1`,
                [address.toLowerCase()]
            );
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting event logs by contract:', error);
            throw error;
        }
    }
}
