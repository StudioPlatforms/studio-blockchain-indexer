import { Pool } from 'pg';
import { createLogger } from '../../utils/logger';
import { ContractData } from '../blockchain/types';
import { Database } from './core';

const logger = createLogger('database:contracts');

/**
 * Database service for contracts
 */
export class ContractsDatabase extends Database {
    /**
     * Store a contract in the database
     * @param contract The contract data to store
     * @returns The address of the stored contract
     */
    async storeContract(contract: ContractData): Promise<string> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Insert the contract
            await client.query(
                `INSERT INTO contracts (
                    address, creator_address, owner_address, block_number, timestamp,
                    transaction_hash, contract_type, name, symbol, decimals,
                    total_supply, balance, bytecode, holder_count, transfer_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (address) DO UPDATE SET
                    creator_address = EXCLUDED.creator_address,
                    owner_address = EXCLUDED.owner_address,
                    block_number = EXCLUDED.block_number,
                    timestamp = EXCLUDED.timestamp,
                    transaction_hash = EXCLUDED.transaction_hash,
                    contract_type = EXCLUDED.contract_type,
                    name = EXCLUDED.name,
                    symbol = EXCLUDED.symbol,
                    decimals = EXCLUDED.decimals,
                    total_supply = EXCLUDED.total_supply,
                    balance = EXCLUDED.balance,
                    bytecode = EXCLUDED.bytecode,
                    holder_count = EXCLUDED.holder_count,
                    transfer_count = EXCLUDED.transfer_count`,
                [
                    contract.address.toLowerCase(),
                    contract.creatorAddress.toLowerCase(),
                    contract.ownerAddress?.toLowerCase(),
                    contract.blockNumber,
                    new Date(contract.timestamp * 1000),
                    contract.transactionHash,
                    contract.contractType,
                    contract.name,
                    contract.symbol,
                    contract.decimals,
                    contract.totalSupply,
                    contract.balance,
                    contract.bytecode,
                    contract.holderCount,
                    contract.transferCount
                ]
            );

            await client.query('COMMIT');
            return contract.address;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error storing contract:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get a contract from the database
     * @param address The address of the contract
     * @returns The contract data
     */
    async getContract(address: string): Promise<ContractData | null> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM contracts WHERE address = $1`,
                [address.toLowerCase()]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const contract = result.rows[0];
            return {
                address: contract.address,
                creatorAddress: contract.creator_address,
                ownerAddress: contract.owner_address,
                blockNumber: contract.block_number,
                timestamp: Math.floor(new Date(contract.timestamp).getTime() / 1000),
                transactionHash: contract.transaction_hash,
                contractType: contract.contract_type,
                name: contract.name,
                symbol: contract.symbol,
                decimals: contract.decimals,
                totalSupply: contract.total_supply,
                balance: contract.balance,
                bytecode: contract.bytecode,
                holderCount: contract.holder_count,
                transferCount: contract.transfer_count
            };
        } catch (error) {
            logger.error('Error getting contract:', error);
            throw error;
        }
    }

    /**
     * Get contracts created by an address
     * @param creatorAddress The address of the creator
     * @param limit The maximum number of contracts to return
     * @param offset The offset to start from
     * @returns The contracts created by the address
     */
    async getContractsByCreator(
        creatorAddress: string,
        limit: number = 10,
        offset: number = 0
    ): Promise<ContractData[]> {
        try {
            const result = await this.pool.query(
                `SELECT * FROM contracts 
                WHERE creator_address = $1
                ORDER BY block_number DESC
                LIMIT $2 OFFSET $3`,
                [creatorAddress.toLowerCase(), limit, offset]
            );

            return result.rows.map(contract => ({
                address: contract.address,
                creatorAddress: contract.creator_address,
                ownerAddress: contract.owner_address,
                blockNumber: contract.block_number,
                timestamp: Math.floor(new Date(contract.timestamp).getTime() / 1000),
                transactionHash: contract.transaction_hash,
                contractType: contract.contract_type,
                name: contract.name,
                symbol: contract.symbol,
                decimals: contract.decimals,
                totalSupply: contract.total_supply,
                balance: contract.balance,
                bytecode: contract.bytecode,
                holderCount: contract.holder_count,
                transferCount: contract.transfer_count
            }));
        } catch (error) {
            logger.error('Error getting contracts by creator:', error);
            throw error;
        }
    }

    /**
     * Get token contracts
     * @param tokenType The type of token contracts to get
     * @param limit The maximum number of contracts to return
     * @param offset The offset to start from
     * @returns The token contracts
     */
    async getTokenContracts(
        tokenType?: 'ERC20' | 'ERC721' | 'ERC1155',
        limit: number = 10,
        offset: number = 0
    ): Promise<ContractData[]> {
        try {
            let query = `SELECT * FROM contracts WHERE contract_type IS NOT NULL`;
            const params: any[] = [];

            if (tokenType) {
                query += ` AND contract_type = $1`;
                params.push(tokenType);
            } else {
                query += ` AND contract_type IN ('ERC20', 'ERC721', 'ERC1155')`;
            }

            query += ` ORDER BY block_number DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);

            const result = await this.pool.query(query, params);

            return result.rows.map(contract => ({
                address: contract.address,
                creatorAddress: contract.creator_address,
                ownerAddress: contract.owner_address,
                blockNumber: contract.block_number,
                timestamp: Math.floor(new Date(contract.timestamp).getTime() / 1000),
                transactionHash: contract.transaction_hash,
                contractType: contract.contract_type,
                name: contract.name,
                symbol: contract.symbol,
                decimals: contract.decimals,
                totalSupply: contract.total_supply,
                balance: contract.balance,
                bytecode: contract.bytecode,
                holderCount: contract.holder_count,
                transferCount: contract.transfer_count
            }));
        } catch (error) {
            logger.error('Error getting token contracts:', error);
            throw error;
        }
    }

    /**
     * Update contract verification status
     * @param address The address of the contract
     * @param verified Whether the contract is verified
     * @returns Whether the update was successful
     */
    async updateContractVerification(
        address: string,
        verified: boolean
    ): Promise<boolean> {
        try {
            const result = await this.pool.query(
                `UPDATE contracts SET verified = $1 WHERE address = $2`,
                [verified, address.toLowerCase()]
            );

            return result.rowCount !== null && result.rowCount > 0;
        } catch (error) {
            logger.error('Error updating contract verification:', error);
            throw error;
        }
    }

    /**
     * Update contract token status
     * @param address The address of the contract
     * @param isToken Whether the contract is a token
     * @param tokenType The type of token
     * @returns Whether the update was successful
     */
    async updateContractTokenStatus(
        address: string,
        isToken: boolean,
        tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'
    ): Promise<boolean> {
        try {
            const result = await this.pool.query(
                `UPDATE contracts SET contract_type = $1 WHERE address = $2`,
                [isToken ? tokenType : null, address.toLowerCase()]
            );

            return result.rowCount > 0;
        } catch (error) {
            logger.error('Error updating contract token status:', error);
            throw error;
        }
    }

    /**
     * Count the number of contracts
     * @returns The number of contracts
     */
    async countContracts(): Promise<number> {
        try {
            const result = await this.pool.query(`SELECT COUNT(*) FROM contracts`);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting contracts:', error);
            throw error;
        }
    }

    /**
     * Count the number of token contracts
     * @param tokenType The type of token contracts to count
     * @returns The number of token contracts
     */
    async countTokenContracts(tokenType?: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<number> {
        try {
            let query = `SELECT COUNT(*) FROM contracts WHERE contract_type IS NOT NULL`;
            const params: any[] = [];

            if (tokenType) {
                query += ` AND contract_type = $1`;
                params.push(tokenType);
            } else {
                query += ` AND contract_type IN ('ERC20', 'ERC721', 'ERC1155')`;
            }

            const result = await this.pool.query(query, params);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting token contracts:', error);
            throw error;
        }
    }
}
