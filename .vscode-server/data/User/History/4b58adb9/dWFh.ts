import { Pool, PoolClient } from 'pg';
import { createLogger } from '../../utils/logger';
import { Database } from './core';
import { ContractData } from '../blockchain/types';

const logger = createLogger('database:contracts');

export class ContractsDatabase extends Database {
  /**
   * Store a contract in the database
   * @param contract The contract data to store
   * @returns The contract address
   */
  async storeContract(contract: ContractData): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert the contract
      await client.query(
        `INSERT INTO contracts (
          address, 
          creator_address, 
          creation_tx_hash, 
          block_number, 
          timestamp, 
          bytecode,
          is_token,
          token_type,
          verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (address) DO UPDATE SET
          creator_address = $2,
          creation_tx_hash = $3,
          block_number = $4,
          timestamp = $5,
          bytecode = $6,
          is_token = COALESCE($7, contracts.is_token),
          token_type = COALESCE($8, contracts.token_type),
          verified = COALESCE($9, contracts.verified)`,
        [
          contract.address.toLowerCase(),
          contract.creatorAddress.toLowerCase(),
          contract.transactionHash,
          contract.blockNumber,
          new Date(contract.timestamp * 1000),
          contract.bytecode || '',
          contract.contractType ? true : null,
          contract.contractType !== 'UNKNOWN' ? contract.contractType : null,
          false
        ]
      );

      // If it's a token, update the token metadata
      if (contract.contractType && contract.contractType !== 'UNKNOWN') {
        await this.updateTokenMetadata(
          client,
          contract.address,
          contract.name || '',
          contract.symbol || '',
          contract.decimals || 0,
          contract.totalSupply || '0'
        );
      }

      await client.query('COMMIT');
      return contract.address;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error storing contract: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update token metadata
   * @param client The database client
   * @param tokenAddress The token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param totalSupply The token total supply
   */
  private async updateTokenMetadata(
    client: PoolClient,
    tokenAddress: string,
    name: string,
    symbol: string,
    decimals: number,
    totalSupply: string
  ): Promise<void> {
    try {
      // Get the token type from the contracts table
      const tokenTypeResult = await client.query(
        'SELECT token_type FROM contracts WHERE address = $1',
        [tokenAddress.toLowerCase()]
      );

      if (tokenTypeResult.rows.length === 0 || !tokenTypeResult.rows[0].token_type) {
        logger.warn(`Token type not found for ${tokenAddress}`);
        return;
      }

      const tokenType = tokenTypeResult.rows[0].token_type;

      await client.query(
        `INSERT INTO token_metadata (
          token_address,
          name,
          symbol,
          decimals,
          total_supply,
          token_type,
          last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (token_address) DO UPDATE SET
          name = COALESCE($2, token_metadata.name),
          symbol = COALESCE($3, token_metadata.symbol),
          decimals = COALESCE($4, token_metadata.decimals),
          total_supply = COALESCE($5, token_metadata.total_supply),
          token_type = COALESCE($6, token_metadata.token_type),
          last_updated = NOW()`,
        [
          tokenAddress.toLowerCase(),
          name || null,
          symbol || null,
          decimals || null,
          totalSupply || null,
          tokenType
        ]
      );
    } catch (error) {
      logger.error(`Error updating token metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Get a contract by address
   * @param address The contract address
   * @returns The contract data
   */
  async getContract(address: string): Promise<ContractData | null> {
    try {
      const result = await this.pool.query(
        `SELECT 
          c.*,
          tm.name,
          tm.symbol,
          tm.decimals,
          tm.total_supply
        FROM 
          contracts c
        LEFT JOIN 
          token_metadata tm ON c.address = tm.token_address
        WHERE 
          c.address = $1`,
        [address.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        address: row.address,
        creatorAddress: row.creator_address,
        transactionHash: row.creation_tx_hash,
        blockNumber: row.block_number,
        timestamp: Math.floor(new Date(row.timestamp).getTime() / 1000),
        contractType: row.is_token ? (row.token_type || 'UNKNOWN') : 'UNKNOWN',
        name: row.name,
        symbol: row.symbol,
        decimals: row.decimals,
        totalSupply: row.total_supply,
        bytecode: row.bytecode
      };
    } catch (error) {
      logger.error(`Error getting contract: ${error}`);
      throw error;
    }
  }

  /**
   * Get contracts by creator address
   * @param creatorAddress The creator address
   * @param limit The maximum number of contracts to return
   * @param offset The offset for pagination
   * @returns The contracts created by the address
   */
  async getContractsByCreator(
    creatorAddress: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ContractData[]> {
    try {
      const result = await this.pool.query(
        `SELECT 
          c.*,
          tm.name,
          tm.symbol,
          tm.decimals,
          tm.total_supply
        FROM 
          contracts c
        LEFT JOIN 
          token_metadata tm ON c.address = tm.token_address
        WHERE 
          c.creator_address = $1
        ORDER BY 
          c.block_number DESC
        LIMIT $2 OFFSET $3`,
        [creatorAddress.toLowerCase(), limit, offset]
      );

      return result.rows.map(row => ({
        address: row.address,
        creatorAddress: row.creator_address,
        transactionHash: row.creation_tx_hash,
        blockNumber: row.block_number,
        timestamp: Math.floor(new Date(row.timestamp).getTime() / 1000),
        contractType: row.is_token ? (row.token_type || 'UNKNOWN') : 'UNKNOWN',
        name: row.name,
        symbol: row.symbol,
        decimals: row.decimals,
        totalSupply: row.total_supply,
        bytecode: row.bytecode
      }));
    } catch (error) {
      logger.error(`Error getting contracts by creator: ${error}`);
      throw error;
    }
  }

  /**
   * Get token contracts
   * @param tokenType The token type to filter by
   * @param limit The maximum number of contracts to return
   * @param offset The offset for pagination
   * @returns The token contracts
   */
  async getTokenContracts(
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155',
    limit: number = 100,
    offset: number = 0
  ): Promise<ContractData[]> {
    try {
      let query = `
        SELECT 
          c.*,
          tm.name,
          tm.symbol,
          tm.decimals,
          tm.total_supply,
          tm.holder_count,
          tm.transfer_count
        FROM 
          contracts c
        JOIN 
          token_metadata tm ON c.address = tm.token_address
        WHERE 
          c.is_token = true
      `;
      const queryParams: any[] = [];

      if (tokenType) {
        query += ` AND c.token_type = $1`;
        queryParams.push(tokenType);
      }

      query += `
        ORDER BY 
          tm.holder_count DESC NULLS LAST,
          c.block_number DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      queryParams.push(limit, offset);

      const result = await this.pool.query(query, queryParams);

      return result.rows.map(row => ({
        address: row.address,
        creatorAddress: row.creator_address,
        transactionHash: row.creation_tx_hash,
        blockNumber: row.block_number,
        timestamp: Math.floor(new Date(row.timestamp).getTime() / 1000),
        contractType: row.token_type || 'UNKNOWN',
        name: row.name,
        symbol: row.symbol,
        decimals: row.decimals,
        totalSupply: row.total_supply,
        bytecode: row.bytecode,
        holderCount: row.holder_count,
        transferCount: row.transfer_count
      }));
    } catch (error) {
      logger.error(`Error getting token contracts: ${error}`);
      throw error;
    }
  }

  /**
   * Update contract verification status
   * @param address The contract address
   * @param verified Whether the contract is verified
   * @returns Whether the update was successful
   */
  async updateContractVerification(
    address: string,
    verified: boolean
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE contracts
        SET verified = $2
        WHERE address = $1`,
        [address.toLowerCase(), verified]
      );

      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      logger.error(`Error updating contract verification: ${error}`);
      throw error;
    }
  }

  /**
   * Update contract token status
   * @param address The contract address
   * @param isToken Whether the contract is a token
   * @param tokenType The token type
   * @returns Whether the update was successful
   */
  async updateContractTokenStatus(
    address: string,
    isToken: boolean,
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE contracts
        SET 
          is_token = $2,
          token_type = $3
        WHERE address = $1`,
        [address.toLowerCase(), isToken, tokenType || null]
      );

      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      logger.error(`Error updating contract token status: ${error}`);
      throw error;
    }
  }

  /**
   * Count contracts
   * @returns The number of contracts
   */
  async countContracts(): Promise<number> {
    try {
      const result = await this.pool.query(
        'SELECT COUNT(*) as count FROM contracts'
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error counting contracts: ${error}`);
      throw error;
    }
  }

  /**
   * Count token contracts
   * @param tokenType The token type to filter by
   * @returns The number of token contracts
   */
  async countTokenContracts(
    tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'
  ): Promise<number> {
    try {
      let query = `
        SELECT COUNT(*) as count
        FROM contracts
        WHERE is_token = true
      `;
      const queryParams: any[] = [];

      if (tokenType) {
        query += ` AND token_type = $1`;
        queryParams.push(tokenType);
      }

      const result = await this.pool.query(query, queryParams);

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error counting token contracts: ${error}`);
      throw error;
    }
  }
}
