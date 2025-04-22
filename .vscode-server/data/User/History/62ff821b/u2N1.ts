import solc from 'solc';
import { createLogger } from '../../utils/logger';
import { bytesToHex, hexToBytes } from '@ethereumjs/util';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const logger = createLogger('verification');

// Maximum source code size (5MB - increased from 1MB)
const MAX_SOURCE_CODE_SIZE = 5 * 1024 * 1024;

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
            // Check if the name contains a colon (file:library format)
            if (name.includes(':')) {
                const [file, lib] = name.split(':');
                result[file] = result[file] || {};
                result[file][lib] = address;
            } else {
                // Default to contract.sol if no file is specified
                result['contract.sol'] = result['contract.sol'] || {};
                result['contract.sol'][name] = address;
            }
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
     * @param viaIR Whether to use the IR-based code generator
     * @returns The cache key
     */
    private generateCacheKey(
        sourceCode: string,
        compilerVersion: string,
        contractName: string,
        optimizationUsed: boolean,
        runs: number,
        libraries: Record<string, string>,
        evmVersion: string,
        viaIR: boolean = false
    ): string {
        const input = {
            sourceCode,
            compilerVersion,
            contractName,
            optimizationUsed,
            runs,
            libraries,
            evmVersion,
            viaIR
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
