import { createLogger } from '../../utils/logger';
import crypto from 'crypto';
import { enhancedImportHandler } from './enhanced-import-handler';
import { sourceCodeFlattener } from './flattener';
import { compilerManager, SUPPORTED_EVM_VERSIONS } from './compiler-manager';
import { CompilationResult, MultiFileCompilationResult } from './verification-types';

const logger = createLogger('verification:compiler');

// Maximum source code size (20MB)
const MAX_SOURCE_CODE_SIZE = 20 * 1024 * 1024;

/**
 * Verification compiler service
 * Handles compilation of contracts for verification
 */
export class VerificationCompiler {
    private compilationCache: Record<string, any> = {};

    /**
     * Generate a cache key for compilation
     */
    private generateCacheKey(
        sourceCode: string | Record<string, string>,
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
     * Format libraries for solc input
     */
    private formatLibraries(libraries: Record<string, string>, mainFile: string = 'contract.sol'): Record<string, Record<string, string>> {
        const result: Record<string, Record<string, string>> = {};
        
        for (const [name, address] of Object.entries(libraries)) {
            // If the name contains a colon, it's already in the format "file:library"
            if (name.includes(':')) {
                const [file, lib] = name.split(':');
                result[file] = result[file] || {};
                result[file][lib] = address;
            } else {
                // Otherwise, use the main file
                result[mainFile] = result[mainFile] || {};
                result[mainFile][name] = address;
            }
        }
        
        return result;
    }

    /**
     * Compile a contract with support for imports
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
    ): Promise<CompilationResult> {
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

            // Check if the EVM version is supported
            if (!SUPPORTED_EVM_VERSIONS.includes(evmVersion)) {
                logger.warn(`Unsupported EVM version: ${evmVersion}, using 'cancun' instead`);
                evmVersion = 'cancun';
            }

            // Check if the EVM version is supported by the compiler version
            if (!compilerManager.isEvmVersionSupported(compilerVersion, evmVersion)) {
                // Get the appropriate EVM version for the compiler version
                evmVersion = compilerManager.getAppropriateEvmVersion(compilerVersion, evmVersion);
                logger.info(`Using appropriate EVM version for compiler ${compilerVersion}: ${evmVersion}`);
            }

            // Load the compiler
            const compiler = await compilerManager.loadCompiler(compilerVersion);
            
            // Set up import handler
            enhancedImportHandler.clearMappings();
            enhancedImportHandler.addMappings(importMappings);
            
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

            // Compile with import handler
            let output;
            try {
                const compiledOutput = compiler.compile(
                    JSON.stringify(input),
                    { import: enhancedImportHandler.findImport.bind(enhancedImportHandler) }
                );
                output = JSON.parse(compiledOutput);
            } catch (compileError: any) {
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
            if (!output.contracts['contract.sol'] || !output.contracts['contract.sol'][contractName]) {
                throw new Error(`Contract ${contractName} not found in source code`);
            }
            
            const contract = output.contracts['contract.sol'][contractName];

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
     * Compile a multi-file contract
     */
    async compileMultiFileContract(
        sourceFiles: Record<string, string>,
        compilerVersion: string,
        contractName: string,
        optimizationUsed: boolean = false,
        runs: number = 200,
        libraries: Record<string, string> = {},
        evmVersion: string = 'cancun',
        autoFlatten: boolean = false
    ): Promise<MultiFileCompilationResult> {
        try {
            // Check total source code size
            const totalSize = Object.values(sourceFiles).reduce((sum, content) => sum + content.length, 0);
            if (totalSize > MAX_SOURCE_CODE_SIZE) {
                throw new Error(`Total source code size exceeds maximum limit of ${MAX_SOURCE_CODE_SIZE} bytes`);
            }
            
            // Check cache
            const cacheKey = this.generateCacheKey(
                sourceFiles,
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

            // Check if the EVM version is supported
            if (!SUPPORTED_EVM_VERSIONS.includes(evmVersion)) {
                logger.warn(`Unsupported EVM version: ${evmVersion}, using 'cancun' instead`);
                evmVersion = 'cancun';
            }

            // Check if the EVM version is supported by the compiler version
            if (!compilerManager.isEvmVersionSupported(compilerVersion, evmVersion)) {
                // Get the appropriate EVM version for the compiler version
                evmVersion = compilerManager.getAppropriateEvmVersion(compilerVersion, evmVersion);
                logger.info(`Using appropriate EVM version for compiler ${compilerVersion}: ${evmVersion}`);
            }

            // Load the compiler
            const compiler = await compilerManager.loadCompiler(compilerVersion);
            
            // Detect the main file
            const mainFile = enhancedImportHandler.detectMainFile(sourceFiles, contractName);
            
            // Set up import handler with all source files
            enhancedImportHandler.clearMappings();
            enhancedImportHandler.addMappings(sourceFiles);
            
            // Create input for solc
            const input: any = {
                language: 'Solidity',
                sources: {},
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
                    libraries: this.formatLibraries(libraries, mainFile),
                    evmVersion: evmVersion
                }
            };
            
            // Add all source files to the input
            for (const [filePath, content] of Object.entries(sourceFiles)) {
                input.sources[filePath] = { content };
            }

            // Compile with import handler
            let output;
            let flattened = false;
            
            try {
                const compiledOutput = compiler.compile(
                    JSON.stringify(input),
                    { import: enhancedImportHandler.findImport.bind(enhancedImportHandler) }
                );
                output = JSON.parse(compiledOutput);
            } catch (compileError: any) {
                logger.error('Compilation error:', compileError);
                
                // If auto-flatten is enabled, try flattening the source code
                if (autoFlatten) {
                    logger.info(`Trying to flatten source code for ${contractName}`);
                    
                    try {
                        // Flatten the source code
                        const flattenedSourceCode = sourceCodeFlattener.flattenFiles(sourceFiles, mainFile);
                        
                        // Create input for solc with flattened source code
                        const flattenedInput = {
                            language: 'Solidity',
                            sources: {
                                'flattened.sol': {
                                    content: flattenedSourceCode
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
                                libraries: this.formatLibraries(libraries, 'flattened.sol'),
                                evmVersion: evmVersion
                            }
                        };
                        
                        // Compile the flattened source code
                        const flattenedOutput = compiler.compile(JSON.stringify(flattenedInput));
                        output = JSON.parse(flattenedOutput);
                        flattened = true;
                        
                        logger.info(`Successfully compiled flattened source code for ${contractName}`);
                    } catch (flattenError: any) {
                        logger.error('Error flattening source code:', flattenError);
                        throw new Error(`Compilation failed: ${compileError.message || 'Unknown error during compilation'}`);
                    }
                } else {
                    throw new Error(`Compilation failed: ${compileError.message || 'Unknown error during compilation'}`);
                }
            }

            // Check for errors
            if (output.errors) {
                const errors = output.errors.filter((error: any) => error.severity === 'error');
                if (errors.length > 0) {
                    throw new Error(`Compilation errors: ${errors.map((e: any) => e.message).join(', ')}`);
                }
            }

            // Find the contract in the output
            let contract = null;
            let contractFile = '';
            
            if (flattened) {
                // If flattened, look for the contract in the flattened file
                if (output.contracts['flattened.sol'] && output.contracts['flattened.sol'][contractName]) {
                    contract = output.contracts['flattened.sol'][contractName];
                    contractFile = 'flattened.sol';
                } else {
                    // Try to find the contract in the flattened file
                    for (const contractKey of Object.keys(output.contracts['flattened.sol'] || {})) {
                        if (contractKey === contractName) {
                            contract = output.contracts['flattened.sol'][contractKey];
                            contractFile = 'flattened.sol';
                            break;
                        }
                    }
                }
            } else {
                // First try to find the contract in the main file
                if (output.contracts[mainFile] && output.contracts[mainFile][contractName]) {
                    contract = output.contracts[mainFile][contractName];
                    contractFile = mainFile;
                } else {
                    // If not found in the main file, search in all files
                    for (const file of Object.keys(output.contracts)) {
                        if (output.contracts[file][contractName]) {
                            contract = output.contracts[file][contractName];
                            contractFile = file;
                            break;
                        }
                    }
                }
            }
            
            if (!contract) {
                throw new Error(`Contract ${contractName} not found in any of the source files`);
            }

            const result = {
                abi: contract.abi,
                bytecode: '0x' + contract.evm.bytecode.object,
                deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
                metadata: contract.metadata,
                mainFile: contractFile,
                flattened
            };
            
            // Cache the result
            this.compilationCache[cacheKey] = result;
            
            return result;
        } catch (error) {
            logger.error('Error compiling multi-file contract:', error);
            throw error;
        }
    }

    /**
     * Get the list of available compiler versions
     */
    async getAvailableCompilerVersions(): Promise<string[]> {
        return compilerManager.getAvailableVersions();
    }

    /**
     * Get the list of supported EVM versions
     */
    getSupportedEvmVersions(): string[] {
        return SUPPORTED_EVM_VERSIONS;
    }

    /**
     * Get the appropriate EVM version for a compiler version
     */
    getAppropriateEvmVersion(compilerVersion: string, requestedEvmVersion: string): string {
        return compilerManager.getAppropriateEvmVersion(compilerVersion, requestedEvmVersion);
    }

    /**
     * Check if an EVM version is supported by a compiler version
     */
    isEvmVersionSupported(compilerVersion: string, evmVersion: string): boolean {
        return compilerManager.isEvmVersionSupported(compilerVersion, evmVersion);
    }
}

export const verificationCompiler = new VerificationCompiler();
