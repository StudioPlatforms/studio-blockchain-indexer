import { createLogger } from '../../utils/logger';
import { bytesToHex, hexToBytes } from '@ethereumjs/util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { enhancedImportHandler } from './enhanced-import-handler';
import { sourceCodeFlattener } from './flattener';
import { compilerManager, SUPPORTED_EVM_VERSIONS } from './compiler-manager';

const logger = createLogger('verification:enhanced-v2');

// Maximum source code size (20MB)
const MAX_SOURCE_CODE_SIZE = 20 * 1024 * 1024;

/**
 * Interface for multi-file verification options
 */
interface MultiFileVerificationOptions {
    sourceFiles: Record<string, string>;
    contractName: string;
    compilerVersion: string;
    optimizationUsed: boolean;
    runs: number;
    evmVersion: string;
    libraries: Record<string, string>;
    constructorArguments?: string;
    autoFlatten?: boolean;
}

/**
 * Enhanced verification service v2
 * Adds support for multi-file contracts, automatic flattening, and compiler caching
 */
export class EnhancedVerificationServiceV2 {
    private compilationCache: Record<string, any> = {};

    /**
     * Generate a cache key for compilation
     * @param sourceCode The source code or source files
     * @param compilerVersion The compiler version
     * @param contractName The contract name
     * @param optimizationUsed Whether optimization was used
     * @param runs The number of optimization runs
     * @param libraries The libraries used
     * @param evmVersion The EVM version
     * @returns The cache key
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
     * Format libraries for solc input
     * @param libraries The libraries to format
     * @param mainFile The main file name
     * @returns The formatted libraries
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
     * Compile a multi-file contract
     * @param sourceFiles The source files to compile
     * @param compilerVersion The compiler version to use
     * @param contractName The name of the contract
     * @param optimizationUsed Whether optimization was used
     * @param runs The number of optimization runs
     * @param libraries The libraries used by the contract
     * @param evmVersion The EVM version to use
     * @param autoFlatten Whether to automatically flatten the source code if compilation fails
     * @returns The compilation result
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
    ): Promise<{
        abi: any;
        bytecode: string;
        deployedBytecode: string;
        metadata?: string;
        mainFile: string;
        flattened?: boolean;
    }> {
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
     * @param autoFlatten Whether to automatically flatten the source code if verification fails
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
        importMappings: Record<string, string> = {},
        autoFlatten: boolean = false
    ): Promise<{
        success: boolean;
        message: string;
        abi?: any;
        bytecode?: string;
        metadata?: string;
        flattened?: boolean;
    }> {
        try {
            // Log verification attempt with detailed parameters
            logger.info(`Verifying contract with parameters:
                Address: [redacted for log]
                Compiler Version: ${compilerVersion}
                Contract Name: ${contractName}
                Optimization: ${optimizationUsed ? 'Enabled' : 'Disabled'}
                Runs: ${runs}
                EVM Version: ${evmVersion}
                Has Constructor Args: ${constructorArguments ? 'Yes' : 'No'}
                Libraries Count: ${Object.keys(libraries).length}
                Import Mappings Count: ${Object.keys(importMappings).length}
                Source Code Length: ${sourceCode.length} bytes
                Auto Flatten: ${autoFlatten ? 'Enabled' : 'Disabled'}
            `);
            
            // Validate constructor arguments
            if (!this.validateConstructorArguments(constructorArguments)) {
                logger.error('Invalid constructor arguments format');
                return {
                    success: false,
                    message: 'Invalid constructor arguments. Must be a valid hex string.'
                };
            }
            
            // Compile the contract
            logger.info(`Starting compilation of ${contractName} with compiler ${compilerVersion}`);
            
            let compilationResult;
            let flattened = false;
            
            try {
                compilationResult = await this.compileContract(
                    sourceCode,
                    compilerVersion,
                    contractName,
                    optimizationUsed,
                    runs,
                    libraries,
                    evmVersion,
                    importMappings
                );
            } catch (compileError) {
                // If auto-flatten is enabled, try flattening the source code
                if (autoFlatten) {
                    logger.info(`Compilation failed, trying to flatten source code for ${contractName}`);
                    
                    try {
                        // Create a source files object with just the main file
                        const sourceFiles = { 'contract.sol': sourceCode };
                        
                        // Add import mappings as source files
                        for (const [importPath, content] of Object.entries(importMappings)) {
                            sourceFiles[importPath] = content;
                        }
                        
                        // Flatten the source code
                        const flattenedSourceCode = sourceCodeFlattener.flattenFiles(sourceFiles);
                        
                        // Compile the flattened source code
                        compilationResult = await this.compileContract(
                            flattenedSourceCode,
                            compilerVersion,
                            contractName,
                            optimizationUsed,
                            runs,
                            libraries,
                            evmVersion,
                            {} // No import mappings needed for flattened code
                        );
                        
                        flattened = true;
                        
                        logger.info(`Successfully compiled flattened source code for ${contractName}`);
                    } catch (flattenError) {
                        logger.error('Error flattening source code:', flattenError);
                        throw compileError;
                    }
                } else {
                    throw compileError;
                }
            }
            
            logger.info(`Compilation successful for ${contractName}`);

            // Compare bytecodes
            logger.info(`Comparing bytecodes for ${contractName}`);
            const isVerified = this.compareDeployedBytecode(
                onChainBytecode,
                compilationResult.deployedBytecode,
                constructorArguments
            );

            if (!isVerified) {
                // Extract metadata hash from both bytecodes
                const onChainMetadata = this.extractMetadataHash(onChainBytecode);
                const compiledMetadata = this.extractMetadataHash(compilationResult.deployedBytecode);
                
                logger.error(`Bytecode verification failed for ${contractName}`);
                logger.error(`On-chain metadata hash: ${onChainMetadata}`);
                logger.error(`Compiled metadata hash: ${compiledMetadata}`);
                
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

            logger.info(`Contract ${contractName} verified successfully${flattened ? ' (using flattened source code)' : ''}`);
            return {
                success: true,
                message: `Contract verified successfully${flattened ? ' (using flattened source code)' : ''}`,
                abi: compilationResult.abi,
                bytecode: compilationResult.bytecode,
                metadata: compilationResult.metadata,
                flattened
            };
        } catch (error: any) {
            logger.error(`Error verifying contract ${contractName}:`, error);
            // Provide more detailed error message
            const errorMessage = error.message || 'Unknown error';
            const detailedMessage = `Verification failed: ${errorMessage}. Please check compiler version, optimization settings, and ensure all imports are correctly included.`;
            return {
                success: false,
                message: detailedMessage
            };
        }
    }

    /**
     * Verify a multi-file contract
     * @param options The verification options
     * @param onChainBytecode The on-chain bytecode
     * @returns The verification result
     */
    async verifyMultiFileContract(
        options: MultiFileVerificationOptions,
        onChainBytecode: string
    ): Promise<{
        success: boolean;
        message: string;
        abi?: any;
        bytecode?: string;
        metadata?: string;
        mainFile?: string;
        flattened?: boolean;
    }> {
        try {
            const {
                sourceFiles,
                contractName,
                compilerVersion,
                optimizationUsed,
                runs,
                evmVersion,
                libraries,
                constructorArguments,
                autoFlatten
            } = options;
            
            // Log verification attempt with detailed parameters
            logger.info(`Verifying multi-file contract with parameters:
                Address: [redacted for log]
                Compiler Version: ${compilerVersion}
                Contract Name: ${contractName}
                Optimization: ${optimizationUsed ? 'Enabled' : 'Disabled'}
                Runs: ${runs}
                EVM Version: ${evmVersion}
                Has Constructor Args: ${constructorArguments ? 'Yes' : 'No'}
                Libraries Count: ${Object.keys(libraries).length}
                Source Files Count: ${Object.keys(sourceFiles).length}
                Total Source Code Length: ${Object.values(sourceFiles).reduce((sum, content) => sum + content.length, 0)} bytes
                Auto Flatten: ${autoFlatten ? 'Enabled' : 'Disabled'}
            `);
            
            // Validate constructor arguments
            if (constructorArguments && !this.validateConstructorArguments(constructorArguments)) {
                logger.error('Invalid constructor arguments format');
                return {
                    success: false,
                    message: 'Invalid constructor arguments. Must be a valid hex string.'
                };
            }
            
            // Compile the contract
            logger.info(`Starting multi-file compilation of ${contractName} with compiler ${compilerVersion}`);
            const compilationResult = await this.compileMultiFileContract(
                sourceFiles,
                compilerVersion,
                contractName,
                optimizationUsed,
                runs,
                libraries,
                evmVersion,
                autoFlatten
            );
            logger.info(`Compilation successful for ${contractName} (main file: ${compilationResult.mainFile})`);

            // Compare bytecodes
            logger.info(`Comparing bytecodes for ${contractName}`);
            const isVerified = this.compareDeployedBytecode(
                onChainBytecode,
                compilationResult.deployedBytecode,
                constructorArguments || ''
            );

            if (!isVerified) {
                // Extract metadata hash from both bytecodes
                const onChainMetadata = this.extractMetadataHash(onChainBytecode);
                const compiledMetadata = this.extractMetadataHash(compilationResult.deployedBytecode);
                
                logger.error(`Bytecode verification failed for ${contractName}`);
                logger.error(`On-chain metadata hash: ${onChainMetadata}`);
                logger.error(`Compiled metadata hash: ${compiledMetadata}`);
                
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

            logger.info(`Contract ${contractName} verified successfully${compilationResult.flattened ? ' (using flattened source code)' : ''}`);
            return {
                success: true,
                message: `Contract verified successfully${compilationResult.flattened ? ' (using flattened source code)' : ''}`,
                abi: compilationResult.abi,
                bytecode: compilationResult.bytecode,
                metadata: compilationResult.metadata,
                mainFile: compilationResult.mainFile,
                flattened: compilationResult.flattened
            };
        } catch (error: any) {
            logger.error(`Error verifying multi-file contract:`, error);
            // Provide more detailed error message
            const errorMessage = error.message || 'Unknown error';
            let detailedMessage = `Verification failed: ${errorMessage}. `;
            
            // Add specific guidance based on the error
            if (errorMessage.includes('not found in any of the source files')) {
                detailedMessage += `Make sure the contract name is correct and matches exactly (including case) with the contract definition in your source files.`;
            } else if (errorMessage.includes('Compilation failed')) {
                detailedMessage += `Check that all imports are correctly included and that the compiler version matches the one used for deployment.`;
            } else if (errorMessage.includes('import')) {
                detailedMessage += `Ensure all imported files are included in your sourceFiles object with the correct paths.`;
            } else {
                detailedMessage += `Please check compiler version, optimization settings, and ensure all imports are correctly included.`;
            }
            
            return {
                success: false,
                message: detailedMessage
            };
        }
    }

    /**
     * Get the list of available compiler versions
     * @returns The list of available compiler versions
     */
    async getAvailableCompilerVersions(): Promise<string[]> {
        return compilerManager.getAvailableVersions();
    }

    /**
     * Get the list of supported EVM versions
     * @returns The list of supported EVM versions
     */
    getSupportedEvmVersions(): string[] {
        return SUPPORTED_EVM_VERSIONS;
    }

    /**
     * Get the appropriate EVM version for a compiler version
     * @param compilerVersion The compiler version
     * @param requestedEvmVersion The requested EVM version
     * @returns The appropriate
