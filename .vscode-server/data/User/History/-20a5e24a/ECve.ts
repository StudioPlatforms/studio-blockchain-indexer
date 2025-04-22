import { Pool } from 'pg';
import { createLogger } from '../../utils/logger';
import { ContractData } from '../blockchain/types';
import { Database } from './core';

const logger = createLogger('database:enhanced-contracts');

/**
 * Enhanced database service for contracts
 * Adds support for multi-file contracts
 */
export class EnhancedContractsDatabase extends Database {
    /**
     * Update contract verification status and data with support for multi-file contracts
     * @param address The address of the contract
     * @param verified Whether the contract is verified
     * @param sourceCode The source code of the contract
     * @param abi The ABI of the contract
     * @param compilerVersion The compiler version used to compile the contract
     * @param optimizationUsed Whether optimization was used when compiling the contract
     * @param runs The number of optimization runs
     * @param constructorArguments The constructor arguments used to deploy the contract
     * @param libraries The libraries used by the contract
     * @param evmVersion The EVM version used for compilation
     * @param isMultiFile Whether this is a multi-file contract
     * @param mainFile The main file of the multi-file contract
     * @param sourceFiles The source files of the multi-file contract
     * @param verificationMetadata Additional verification metadata
     * @returns Whether the update was successful
     */
    async updateContractVerification(
        address: string,
        verified: boolean,
        sourceCode?: string,
        abi?: any,
        compilerVersion?: string,
        optimizationUsed?: boolean,
        runs?: number,
        constructorArguments?: string,
        libraries?: any,
        evmVersion?: string,
        isMultiFile?: boolean,
        mainFile?: string,
        sourceFiles?: Record<string, string>,
        verificationMetadata?: Record<string, any>
    ): Promise<boolean> {
        try {
            // Determine if this is a multi-file contract based on the source code or isMultiFile flag
            const isMultiFileContract = isMultiFile || 
                (sourceCode && sourceCode.startsWith('{') && sourceCode.endsWith('}'));
            
            // If this is a multi-file contract, parse the source code as JSON if it's not already an object
            let parsedSourceFiles = sourceFiles;
            if (isMultiFileContract && sourceCode && !parsedSourceFiles) {
                try {
                    parsedSourceFiles = JSON.parse(sourceCode);
                } catch (error) {
                    logger.error(`Error parsing source files for contract ${address}:`, error);
                }
            }
            
            const result = await this.pool.query(
                `UPDATE contracts SET 
                    verified = $1, 
                    source_code = $2, 
                    abi = $3, 
                    compiler_version = $4, 
                    optimization_used = $5, 
                    runs = $6, 
                    constructor_arguments = $7, 
                    libraries = $8,
                    verified_at = $9,
                    evm_version = $10,
                    is_multi_file = $11,
                    main_file = $12,
                    source_files = $13,
                    verification_metadata = $14
                WHERE address = $15`,
                [
                    verified, 
                    sourceCode, 
                    abi ? JSON.stringify(abi) : null, 
                    compilerVersion, 
                    optimizationUsed, 
                    runs, 
                    constructorArguments, 
                    libraries ? JSON.stringify(libraries) : null,
                    verified ? new Date() : null,
                    evmVersion || 'cancun', // Default to 'cancun' if not provided
                    isMultiFileContract,
                    mainFile,
                    parsedSourceFiles ? JSON.stringify(parsedSourceFiles) : null,
                    verificationMetadata ? JSON.stringify(verificationMetadata) : null,
                    address.toLowerCase()
                ]
            );

            return result.rowCount !== null && result.rowCount > 0;
        } catch (error) {
            logger.error('Error updating contract verification:', error);
            throw error;
        }
    }
    
    /**
     * Get contract verification data with support for multi-file contracts
     * @param address The address of the contract
     * @returns The contract verification data
     */
    async getContractVerification(address: string): Promise<{
        verified: boolean;
        sourceCode?: string;
        abi?: any;
        compilerVersion?: string;
        optimizationUsed?: boolean;
        runs?: number;
        constructorArguments?: string;
        libraries?: any;
        evmVersion?: string;
        verifiedAt?: Date;
        isMultiFile?: boolean;
        mainFile?: string;
        sourceFiles?: Record<string, string>;
        verificationMetadata?: Record<string, any>;
    } | null> {
        try {
            const result = await this.pool.query(
                `SELECT 
                    verified, 
                    source_code, 
                    abi, 
                    compiler_version, 
                    optimization_used, 
                    runs, 
                    constructor_arguments, 
                    libraries,
                    evm_version,
                    verified_at,
                    is_multi_file,
                    main_file,
                    source_files,
                    verification_metadata
                FROM contracts 
                WHERE address = $1`,
                [address.toLowerCase()]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const contract = result.rows[0];
            
            // Parse source files if this is a multi-file contract
            let sourceFiles = null;
            if (contract.is_multi_file) {
                if (contract.source_files) {
                    sourceFiles = contract.source_files;
                } else if (contract.source_code && contract.source_code.startsWith('{') && contract.source_code.endsWith('}')) {
                    try {
                        sourceFiles = JSON.parse(contract.source_code);
                    } catch (error) {
                        logger.error(`Error parsing source files for contract ${address}:`, error);
                    }
                }
            }
            
            return {
                verified: contract.verified,
                sourceCode: contract.source_code,
                abi: contract.abi,
                compilerVersion: contract.compiler_version,
                optimizationUsed: contract.optimization_used,
                runs: contract.runs,
                constructorArguments: contract.constructor_arguments,
                libraries: contract.libraries,
                evmVersion: contract.evm_version,
                verifiedAt: contract.verified_at,
                isMultiFile: contract.is_multi_file,
                mainFile: contract.main_file,
                sourceFiles,
                verificationMetadata: contract.verification_metadata
            };
        } catch (error) {
            logger.error('Error getting contract verification:', error);
            throw error;
        }
    }
    
    /**
     * Get verified contracts with support for multi-file contracts
     * @param limit The maximum number of contracts to return
     * @param offset The offset to start from
     * @param isMultiFile Whether to filter for multi-file contracts
     * @returns The verified contracts
     */
    async getVerifiedContracts(
        limit: number = 10,
        offset: number = 0,
        isMultiFile?: boolean
    ): Promise<{
        address: string;
        contractName?: string;
        compilerVersion?: string;
        verified: boolean;
        isMultiFile?: boolean;
        mainFile?: string;
        verifiedAt?: Date;
    }[]> {
        try {
            let query = `
                SELECT 
                    address, 
                    name as contract_name, 
                    compiler_version, 
                    verified, 
                    is_multi_file,
                    main_file,
                    verified_at
                FROM contracts 
                WHERE verified = TRUE
            `;
            
            const params: any[] = [];
            
            // Add filter for multi-file contracts if specified
            if (isMultiFile !== undefined) {
                query += ` AND is_multi_file = $1`;
                params.push(isMultiFile);
            }
            
            // Add order by and limit
            query += ` ORDER BY verified_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
            
            const result = await this.pool.query(query, params);
            
            return result.rows.map(row => ({
                address: row.address,
                contractName: row.contract_name,
                compilerVersion: row.compiler_version,
                verified: row.verified,
                isMultiFile: row.is_multi_file,
                mainFile: row.main_file,
                verifiedAt: row.verified_at
            }));
        } catch (error) {
            logger.error('Error getting verified contracts:', error);
            throw error;
        }
    }
    
    /**
     * Count verified contracts
     * @param isMultiFile Whether to filter for multi-file contracts
     * @returns The number of verified contracts
     */
    async countVerifiedContracts(isMultiFile?: boolean): Promise<number> {
        try {
            let query = `SELECT COUNT(*) FROM contracts WHERE verified = TRUE`;
            const params: any[] = [];
            
            // Add filter for multi-file contracts if specified
            if (isMultiFile !== undefined) {
                query += ` AND is_multi_file = $1`;
                params.push(isMultiFile);
            }
            
            const result = await this.pool.query(query, params);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting verified contracts:', error);
            throw error;
        }
    }
}

// Export a singleton instance
export const enhancedContractsDatabase = new EnhancedContractsDatabase();
