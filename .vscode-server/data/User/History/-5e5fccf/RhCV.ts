import { Pool } from 'pg';
import { EventLog } from '../blockchain/types';
import { createLogger } from '../../utils/logger';
import { Database } from './core';

const logger = createLogger('database:logs');

export class LogsDatabase extends Database {

  /**
   * Store an event log in the database
   * @param log The event log to store
   * @returns The ID of the stored log
   */
  async storeEventLog(log: EventLog): Promise<number> {
    try {
      const result = await this.pool.query(
        `INSERT INTO event_logs (
          transaction_hash, 
          block_number, 
          log_index, 
          address, 
          topic0, 
          topic1, 
          topic2, 
          topic3, 
          data, 
          timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        ON CONFLICT (transaction_hash, log_index) DO UPDATE SET
          address = $4,
          topic0 = $5,
          topic1 = $6,
          topic2 = $7,
          topic3 = $8,
          data = $9,
          timestamp = $10
        RETURNING id`,
        [
          log.transactionHash,
          log.blockNumber,
          log.logIndex,
          log.address,
          log.topics[0] || null,
          log.topics[1] || null,
          log.topics[2] || null,
          log.topics[3] || null,
          log.data,
          new Date(log.timestamp * 1000)
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      logger.error(`Error storing event log: ${error}`);
      throw error;
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

      for (const log of logs) {
        await client.query(
          `INSERT INTO event_logs (
            transaction_hash, 
            block_number, 
            log_index, 
            address, 
            topic0, 
            topic1, 
            topic2, 
            topic3, 
            data, 
            timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          ON CONFLICT (transaction_hash, log_index) DO UPDATE SET
            address = $4,
            topic0 = $5,
            topic1 = $6,
            topic2 = $7,
            topic3 = $8,
            data = $9,
            timestamp = $10`,
          [
            log.transactionHash,
            log.blockNumber,
            log.logIndex,
            log.address,
            log.topics[0] || null,
            log.topics[1] || null,
            log.topics[2] || null,
            log.topics[3] || null,
            log.data,
            new Date(log.timestamp * 1000)
          ]
        );
      }

      await client.query('COMMIT');
      return logs.length;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error storing event logs: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get event logs for a transaction
   * @param transactionHash The transaction hash
   * @returns The event logs for the transaction
   */
  async getEventLogsByTransaction(transactionHash: string): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM event_logs 
        WHERE transaction_hash = $1 
        ORDER BY log_index ASC`,
        [transactionHash]
      );

      return result.rows.map(this.mapEventLogRow);
    } catch (error) {
      logger.error(`Error getting event logs by transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Get event logs for a contract
   * @param address The contract address
   * @param limit The maximum number of logs to return
   * @param offset The offset for pagination
   * @returns The event logs for the contract
   */
  async getEventLogsByContract(address: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM event_logs 
        WHERE address = $1 
        ORDER BY block_number DESC, log_index ASC 
        LIMIT $2 OFFSET $3`,
        [address, limit, offset]
      );

      return result.rows.map(this.mapEventLogRow);
    } catch (error) {
      logger.error(`Error getting event logs by contract: ${error}`);
      throw error;
    }
  }

  /**
   * Get event logs by topic
   * @param topic The topic to search for
   * @param limit The maximum number of logs to return
   * @param offset The offset for pagination
   * @returns The event logs with the specified topic
   */
  async getEventLogsByTopic(topic: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM event_logs 
        WHERE topic0 = $1 OR topic1 = $1 OR topic2 = $1 OR topic3 = $1 
        ORDER BY block_number DESC, log_index ASC 
        LIMIT $2 OFFSET $3`,
        [topic, limit, offset]
      );

      return result.rows.map(this.mapEventLogRow);
    } catch (error) {
      logger.error(`Error getting event logs by topic: ${error}`);
      throw error;
    }
  }

  /**
   * Get event logs with advanced filtering
   * @param params The filter parameters
   * @returns The filtered event logs
   */
  async getEventLogs(params: {
    address?: string;
    topic0?: string;
    fromBlock?: number;
    toBlock?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { address, topic0, fromBlock, toBlock, limit = 100, offset = 0 } = params;
    
    try {
      let query = 'SELECT * FROM event_logs WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (address) {
        query += ` AND address = $${paramIndex}`;
        queryParams.push(address);
        paramIndex++;
      }

      if (topic0) {
        query += ` AND topic0 = $${paramIndex}`;
        queryParams.push(topic0);
        paramIndex++;
      }

      if (fromBlock !== undefined) {
        query += ` AND block_number >= $${paramIndex}`;
        queryParams.push(fromBlock);
        paramIndex++;
      }

      if (toBlock !== undefined) {
        query += ` AND block_number <= $${paramIndex}`;
        queryParams.push(toBlock);
        paramIndex++;
      }

      query += ` ORDER BY block_number DESC, log_index ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      const result = await this.pool.query(query, queryParams);
      return result.rows.map(this.mapEventLogRow);
    } catch (error) {
      logger.error(`Error getting event logs with filters: ${error}`);
      throw error;
    }
  }

  /**
   * Count event logs for a contract
   * @param address The contract address
   * @returns The number of event logs for the contract
   */
  async countEventLogsByContract(address: string): Promise<number> {
    try {
      const result = await this.pool.query(
        'SELECT COUNT(*) as count FROM event_logs WHERE address = $1',
        [address]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error counting event logs by contract: ${error}`);
      throw error;
    }
  }

  /**
   * Map a database row to an event log object
   * @param row The database row
   * @returns The event log object
   */
  private mapEventLogRow(row: any): any {
    const topics = [row.topic0, row.topic1, row.topic2, row.topic3].filter(Boolean);
    
    return {
      id: row.id,
      transactionHash: row.transaction_hash,
      blockNumber: row.block_number,
      logIndex: row.log_index,
      address: row.address,
      topics,
      data: row.data,
      timestamp: row.timestamp,
      createdAt: row.created_at
    };
  }
}
