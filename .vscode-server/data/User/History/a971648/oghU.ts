import solc from 'solc';
import { createLogger } from '../../utils/logger';
import { bytesToHex, hexToBytes } from '@ethereumjs/util';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const logger = createLogger('verification');

// Maximum source code size (1MB)
const MAX_SOURCE_CODE_SIZE = 1024 * 1024;

/**
 * Service for compiling and verifying contracts
 */
export class VerificationService {
    private solcCache: Record<string, any> = {};
    private solcVersionsUrl = 'https://binaries.soliditylang.org/bin/list.json';
    private compilationCache: Record<string, any> = {};

    /**
     * Load a specific compiler version
     * @param version The compiler version to load
     * @returns The compiler
     */
    private async loadCompilerVersion(version: string): Promise<any> {
        // Check if we already have this version in cache
        if (this.solcCache[version]) {
            return this.solcCache[version];
        }

        try {
            // Use solc.loadRemoteVersion for all compiler versions
            // This is more reliable than trying to load the compiler manually
            return new Promise((resolve, reject) => {
                // Extract the version without commit hash if present
                const versionToLoad = version.includes('+') ? version : version;
                
                logger.info(`Loading compiler version ${versionToLoad} using solc.loadRemoteVersion`);
                
                solc.loadRemoteVersion(versionToLoad, (err: any, solcSnapshot: any) => {
                    if (err) {
                        logger.error(`Error loading remote compiler version ${versionToLoad}: ${err}`);
                        
                        // If loading with full version fails, try with just the base version
                        if (version.includes('+')) {
                            const baseVersion = version.split('+')[0];
                            logger.info(`Trying again with base version ${baseVersion}`);
                            
                            solc.loadRemoteVersion(baseVersion, (err2: any, solcSnapshot2: any) => {
                                if (err2) {
                                    logger.error(`Error loading remote compiler version ${baseVersion}: ${err2}`);
                                    reject(new Error(`Failed to load compiler version ${version}`));
                                    return;
                                }
                                
                                // Cache the compiler
                                this.solcCache[version] = solcSnapshot2;
                                resolve(solcSnapshot2);
                            });
                        } else {
                            reject(new Error(`Failed to load compiler version ${version}`));
                        }
                        return;
                    }
                    
                    // Cache the compiler
                    this.solcCache[version] = solcSnapshot;
                    resolve(solcSnapshot);
                });
            });
        } catch (error) {
            logger.error(`Error loading compiler version ${version}:`, error);
            throw new Error(`Failed to load compiler version ${version}`);
        }
    }

    /**
     * Format libraries for solc input
     * @param libraries The libraries to format
     * @returns The formatted libraries
     */
    private formatLibraries(libraries: Record<string, string>): Record<string, Record<string, string>> {
        const result: Record<string, Record<string, string>> = {};
        
        for (const [name, address] of Object.entries(libraries)) {
            result['contract.sol'] = result['contract.sol'] || {};
            result['contract.sol'][name] = address;
        }
        
        return result;
    }

    /**
     * Generate a cache key for compilation
     * @param sourceCode The source code
     * @param compilerVersion The compiler version
     * @param contractName The contract name
     * @param optimizationUsed Whether optimization was used
     * @param runs The number of optimization runs
     * @param libraries The libraries used
     * @param evmVersion The EVM version
     * @returns The cache key
     */
    private generateCacheKey(
        sourceCode: string,
        compilerVersion: string,
        contractName: string,
        optimizationUsed: boolean,
        runs: number,
        libraries: Record<string, string>,
        evmVersion: string
    ): string {
        const input = {
            sourceCode,
            compilerVersion,
            contractName,
            optimizationUsed,
            runs,
            libraries,
            evmVersion
        };
        
        return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    }

    /**
     * Extract metadata hash from bytecode
     * @param bytecode The bytecode
     * @returns The metadata hash
     */
    extractMetadataHash(bytecode: string): string {
        // Metadata hash is the last 43 bytes (0xa165627a7a72305820...)
        return bytecode.slice(-86);
    }

    /**
     * Validate constructor arguments
     * @param constructorArguments The constructor arguments
     * @returns Whether the constructor arguments are valid
     */
    validateConstructorArguments(constructorArguments: string): boolean {
        if (!constructorArguments) {
            return true;
        }
        
        // Check if the constructor arguments are a valid hex string
        const hexRegex = /^(0x)?[0-9a-fA-F]+$/;
        return hexRegex.test(constructorArguments);
    }

    /**
     * Compile a contract
     * @param sourceCode The source code to compile
     * @param compilerVersion The compiler version to use
     * @param contractName The name of the contract
     * @param optimizationUsed Whether optimization was used
     * @param runs The number of optimization runs
     * @param libraries The libraries used by the contract
     * @param evmVersion The EVM version to use
     * @returns The compilation result
     */
    async compileContract(
        sourceCode: string,
        compilerVersion: string,
        contractName: string,
        optimizationUsed: boolean = false,
        runs: number = 200,
        libraries: Record<string, string> = {},
        evmVersion: string = 'cancun'
    ): Promise<{
        abi: any;
        bytecode: string;
        deployedBytecode: string;
        metadata?: string;
    }> {
        try {
            // Check source code size
            if (sourceCode.length > MAX_SOURCE_CODE_SIZE) {
                throw new Error(`Source code size exceeds maximum limit of ${MAX_SOURCE_CODE_SIZE} bytes`);
            }
            
            // Check cache
            const cacheKey = this.generateCacheKey(
                sourceCode,
                compilerVersion,
                contractName,
                optimizationUsed,
                runs,
                libraries,
                evmVersion
            );
            
            if (this.compilationCache[cacheKey]) {
                return this.compilationCache[cacheKey];
            }

            // Load the compiler
            const compiler = await this.loadCompilerVersion(compilerVersion);

            // Create input for solc
            const input = {
                language: 'Solidity',
                sources: {
                    'contract.sol': {
                        content: sourceCode
                    }
                },
                settings: {
                    outputSelection: {
                        '*': {
                            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata']
                        }
                    },
                    optimizer: {
                        enabled: optimizationUsed,
                        runs: runs
                    },
                    libraries: this.formatLibraries(libraries),
                    evmVersion: evmVersion
                }
            };

            // Compile
            const output = JSON.parse(compiler.compile(JSON.stringify(input)));

            // Check for errors
            if (output.errors) {
                const errors = output.errors.filter((error: any) => error.severity === 'error');
                if (errors.length > 0) {
                    throw new Error(`Compilation errors: ${errors.map((e: any) => e.message).join(', ')}`);
                }
            }

            // Extract contract
            const contract = output.contracts['contract.sol'][contractName];
            if (!contract) {
                throw new Error(`Contract ${contractName} not found in source code`);
            }

            const result = {
                abi: contract.abi,
                bytecode: '0x' + contract.evm.bytecode.object,
                deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
                metadata: contract.metadata
            };
            
            // Cache the result
            this.compilationCache[cacheKey] = result;
            
            return result;
        } catch (error) {
            logger.error('Error compiling contract:', error);
            throw error;
        }
    }

    /**
     * Compare deployed bytecode with compiled bytecode
     * @param onChainBytecode The on-chain bytecode
     * @param compiledBytecode The compiled bytecode
     * @param constructorArguments The constructor arguments
     * @returns Whether the bytecodes match
     */
    compareDeployedBytecode(
        onChainBytecode: string,
        compiledBytecode: string,
        constructorArguments: string = ''
    ): boolean {
        try {
            // Remove metadata hash (last 43 bytes) from both bytecodes
            const onChainCode = onChainBytecode.slice(0, -86);
            const compiledCode = compiledBytecode.slice(0, -86);

            // Compare
            if (onChainCode !== compiledCode) {
                // Try with constructor arguments
                if (constructorArguments && constructorArguments !== '0x' && onChainCode.startsWith(compiledCode)) {
                    const argsInBytecode = onChainCode.slice(compiledCode.length);
                    // Verify constructor arguments match
                    const cleanArgs = constructorArguments.startsWith('0x') ? constructorArguments.slice(2) : constructorArguments;
                    if (argsInBytecode === cleanArgs) {
                        return true;
                    }
                }
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error comparing bytecodes:', error);
            return false;
        }
    }

    /**
     * Verify a contract
     * @param sourceCode The source code to verify
     * @param compilerVersion The compiler version to use
     * @param contractName The name of the contract
     * @param onChainBytecode The on-chain bytecode
     * @param optimizationUsed Whether optimization was used
     * @param runs The number of optimization runs
     * @param constructorArguments The constructor arguments
     * @param libraries The libraries used by the contract
     * @param evmVersion The EVM version to use
     * @returns The verification result
     */
    async verifyContract(
        sourceCode: string,
        compilerVersion: string,
        contractName: string,
        onChainBytecode: string,
        optimizationUsed: boolean = false,
        runs: number = 200,
        constructorArguments: string = '',
        libraries: Record<string, string> = {},
        evmVersion: string = 'cancun'
    ): Promise<{
        success: boolean;
        message: string;
        abi?: any;
        bytecode?: string;
        metadata?: string;
    }> {
        try {
            // Validate constructor arguments
            if (!this.validateConstructorArguments(constructorArguments)) {
                return {
                    success: false,
                    message: 'Invalid constructor arguments. Must be a valid hex string.'
                };
            }
            
            // Compile the contract
            const compilationResult = await this.compileContract(
                sourceCode,
                compilerVersion,
                contractName,
                optimizationUsed,
                runs,
                libraries,
                evmVersion
            );

            // Compare bytecodes
            const isVerified = this.compareDeployedBytecode(
                onChainBytecode,
                compilationResult.deployedBytecode,
                constructorArguments
            );

            if (!isVerified) {
                // Extract metadata hash from both bytecodes
                const onChainMetadata = this.extractMetadataHash(onChainBytecode);
                const compiledMetadata = this.extractMetadataHash(compilationResult.deployedBytecode);
                
                // Check if metadata hashes match
                if (onChainMetadata === compiledMetadata) {
                    return {
                        success: false,
                        message: 'Metadata hashes match, but bytecodes do not. This could be due to incorrect constructor arguments or libraries.'
                    };
                }
                
                return {
                    success: false,
                    message: 'Bytecode verification failed. The compiled bytecode does not match the on-chain bytecode.'
                };
            }

            return {
                success: true,
                message: 'Contract verified successfully',
                abi: compilationResult.abi,
                bytecode: compilationResult.bytecode,
                metadata: compilationResult.metadata
            };
        } catch (error: any) {
            logger.error('Error verifying contract:', error);
            return {
                success: false,
                message: `Verification failed: ${error.message}`
            };
        }
    }
}

export const verificationService = new VerificationService();
