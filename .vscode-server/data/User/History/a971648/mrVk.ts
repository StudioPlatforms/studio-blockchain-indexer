import solc from 'solc';
import { createLogger } from '../../utils/logger';
import { bytesToHex, hexToBytes } from '@ethereumjs/util';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

const logger = createLogger('verification');

/**
 * Service for compiling and verifying contracts
 */
export class VerificationService {
    private solcCache: Record<string, any> = {};
    private solcVersionsUrl = 'https://binaries.soliditylang.org/bin/list.json';

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
            // Get the list of available versions
            const response = await axios.get(this.solcVersionsUrl);
            const builds = response.data.builds;

            // Find the exact version or the closest match
            let exactMatch = builds.find((build: any) => build.version === version);
            if (!exactMatch) {
                // Try to find a match with the commit hash
                const versionWithCommit = builds.find((build: any) => {
                    return build.version.startsWith(version.split('+')[0]) && 
                           build.version.includes(version.split('+')[1] || '');
                });
                
                if (versionWithCommit) {
                    exactMatch = versionWithCommit;
                } else {
                    // Just use the version without commit hash
                    exactMatch = builds.find((build: any) => build.version.startsWith(version.split('+')[0]));
                }
            }

            if (!exactMatch) {
                throw new Error(`Compiler version ${version} not found`);
            }

            // Get the compiler
            const compilerUrl = `https://binaries.soliditylang.org/bin/${exactMatch.path}`;
            const compilerResponse = await axios.get(compilerUrl);
            const compiler = solc.setupMethods(compilerResponse.data);

            // Cache the compiler
            this.solcCache[version] = compiler;
            return compiler;
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
    }> {
        try {
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
                            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
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

            return {
                abi: contract.abi,
                bytecode: '0x' + contract.evm.bytecode.object,
                deployedBytecode: '0x' + contract.evm.deployedBytecode.object
            };
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
    }> {
        try {
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
                return {
                    success: false,
                    message: 'Bytecode verification failed. The compiled bytecode does not match the on-chain bytecode.'
                };
            }

            return {
                success: true,
                message: 'Contract verified successfully',
                abi: compilationResult.abi,
                bytecode: compilationResult.bytecode
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
