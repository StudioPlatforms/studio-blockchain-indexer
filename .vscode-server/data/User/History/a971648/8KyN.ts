import solc from 'solc';
import { createLogger } from '../../utils/logger';
import { bytesToHex, hexToBytes } from '@ethereumjs/util';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { importHandler } from './import-handler';

const logger = createLogger('verification');

// Maximum source code size (10MB)
const MAX_SOURCE_CODE_SIZE = 10 * 1024 * 1024; // Increased from 1MB to 10MB

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
            // Get the list of available versions to find the correct path
            const response = await axios.get(this.solcVersionsUrl);
            const releases = response.data.releases;
            
            // Check if the version exists in the releases
            const baseVersion = version.split('+')[0];
            if (!releases[baseVersion]) {
                throw new Error(`Compiler version ${version} not found in releases`);
            }
            
            // Get the correct path with 'v' prefix from releases
            const correctPath = releases[baseVersion];
            
            // Extract the version string from the path (e.g., "v0.4.26+commit.4563c3fc")
            const versionMatch = correctPath.match(/soljson-(v[^.]+\.[^.]+\.[^+]+(?:\+commit\.[a-f0-9]+)?).js/);
            if (!versionMatch || !versionMatch[1]) {
                throw new Error(`Could not extract version from path: ${correctPath}`);
            }
            
            const correctVersion = versionMatch[1];
            logger.info(`Using correct version string: ${correctVersion} for version ${version}`);
            
            // Use solc.loadRemoteVersion with the correct version string
            return new Promise((resolve, reject) => {
                solc.loadRemoteVersion(correctVersion, (err: any, solcSnapshot: any) => {
                    if (err) {
                        logger.error(`Error loading remote compiler version ${correctVersion}: ${err}`);
                        reject(new Error(`Failed to load compiler version ${version}`));
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
     * Get appropriate EVM version for a compiler version
     * @param compilerVersion The compiler version
     * @param requestedEvmVersion The requested EVM version
     * @returns The appropriate EVM version
     */
    private getAppropriateEvmVersion(compilerVersion: string, requestedEvmVersion: string): string {
        // Extract the major, minor, and patch version numbers
        const versionMatch = compilerVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!versionMatch) {
            return requestedEvmVersion; // Default to requested version if parsing fails
        }
        
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const patch = parseInt(versionMatch[3]);
        
        // For Solidity 0.4.x, use 'byzantium'
        if (major === 0 && minor <= 4) {
            logger.info(`Using 'byzantium' EVM version for Solidity ${compilerVersion}`);
            return 'byzantium';
        }
        
        // For Solidity 0.5.x, use 'petersburg'
        if (major === 0 && minor === 5) {
            logger.info(`Using 'petersburg' EVM version for Solidity ${compilerVersion}`);
            return 'petersburg';
        }
        
        // For Solidity 0.6.x, use 'istanbul'
        if (major === 0 && minor === 6) {
            logger.info(`Using 'istanbul' EVM version for Solidity ${compilerVersion}`);
            return 'istanbul';
        }
        
        // For Solidity 0.7.x, use 'berlin'
        if (major === 0 && minor === 7) {
            logger.info(`Using 'berlin' EVM version for Solidity ${compilerVersion}`);
            return 'berlin';
        }
        
        // For Solidity 0.8.x
        if (major === 0 && minor === 8) {
            // 0.8.0 defaults to 'istanbul'
            if (patch === 0) {
                logger.info(`Using 'istanbul' EVM version for Solidity ${compilerVersion}`);
                return 'istanbul';
            }
            // 0.8.1 - 0.8.5 can accept 'berlin' or 'istanbul'
            else if (patch < 6) {
                logger.info(`Using 'berlin' EVM version for Solidity ${compilerVersion}`);
                return 'berlin';
            }
            // 0.8.6 - 0.8.9 accept 'london'
            else if (patch < 10) {
                logger.info(`Using 'london' EVM version for Solidity ${compilerVersion}`);
                return 'london';
            }
            // 0.8.10+ accept 'paris'
            else {
                logger.info(`Using 'paris' EVM version for Solidity ${compilerVersion}`);
                return 'paris';
            }
        }
        
        // For newer versions, return the requested version
        return requestedEvmVersion;
    }

    /**
     * Compile a contract with support for imports
     * @param sourceCode The source code to compile
     * @param compilerVersion The compiler version to use
     * @param contractName The name of the contract
     * @param optimizationUsed Whether optimization was used
     * @param runs The number of optimization runs
     * @param libraries The libraries used by the contract
     * @param evmVersion The EVM version to use
     * @param importMappings Optional import mappings
     * @returns The compilation result
     */
    async compileContract(
        sourceCode: string,
        compilerVersion: string,
        contractName: string,
        optimizationUsed: boolean = false,
        runs: number = 200,
        libraries: Record<string, string> = {},
        evmVersion: string = 'cancun',
        importMappings: Record<string, string> = {}
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

            // Get appropriate EVM version for the compiler version
            const appropriateEvmVersion = this.getAppropriateEvmVersion(compilerVersion, evmVersion);
            
            // Set up import handler
            importHandler.addMappings(importMappings);
            
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
                    evmVersion: appropriateEvmVersion
                }
            };

            // Compile with import handler
            let output;
            try {
                const compiledOutput = compiler.compile(
                    JSON.stringify(input),
                    { import: importHandler.findImport.bind(importHandler) }
                );
                output = JSON.parse(compiledOutput);
            } catch (compileError) {
                logger.error('Compilation error:', compileError);
                throw new Error(`Compilation failed: ${compileError.message || 'Unknown error during compilation'}`);
            }

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
     * @param importMappings Optional import mappings
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
        evmVersion: string = 'cancun',
        importMappings: Record<string, string> = {}
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
                evmVersion,
                importMappings
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
