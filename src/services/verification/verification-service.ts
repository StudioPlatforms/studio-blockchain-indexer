import { createLogger } from '../../utils/logger';
import { verificationCompiler } from './verification-compiler';
import { enhancedImportHandler } from './enhanced-import-handler';
import { sourceCodeFlattener } from './flattener';
import { 
    VerificationResult, 
    MultiFileVerificationResult, 
    MultiFileVerificationOptions 
} from './verification-types';

const logger = createLogger('verification:service');

/**
 * Verification service
 * Handles contract verification
 */
export class VerificationService {
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
    ): Promise<VerificationResult> {
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
            const compilationResult = await verificationCompiler.compileContract(
                sourceCode,
                compilerVersion,
                contractName,
                optimizationUsed,
                runs,
                libraries,
                evmVersion,
                importMappings
            );
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

            logger.info(`Contract ${contractName} verified successfully`);
            return {
                success: true,
                message: 'Contract verified successfully',
                abi: compilationResult.abi,
                bytecode: compilationResult.bytecode,
                metadata: compilationResult.metadata
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
    ): Promise<MultiFileVerificationResult> {
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
                Auto Flatten: ${autoFlatten ? 'Enabled' : 'Disabled'}
                Total Source Code Length: ${Object.values(sourceFiles).reduce((sum, content) => sum + content.length, 0)} bytes
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
            const compilationResult = await verificationCompiler.compileMultiFileContract(
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

            logger.info(`Contract ${contractName} verified successfully`);
            return {
                success: true,
                message: 'Contract verified successfully',
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
     * Flatten a multi-file contract
     * @param sourceFiles The source files
     * @param mainFile The main file
     * @returns The flattened source code
     */
    flattenContract(sourceFiles: Record<string, string>, mainFile?: string): string {
        try {
            // If main file is not provided, detect it
            if (!mainFile) {
                mainFile = enhancedImportHandler.detectMainFile(sourceFiles, '');
            }
            
            // Flatten the source code
            return sourceCodeFlattener.flattenFiles(sourceFiles, mainFile);
        } catch (error: any) {
            logger.error('Error flattening contract:', error);
            throw new Error(`Failed to flatten contract: ${error.message}`);
        }
    }

    /**
     * Get the list of available compiler versions
     */
    async getAvailableCompilerVersions(): Promise<string[]> {
        return verificationCompiler.getAvailableCompilerVersions();
    }

    /**
     * Get the list of supported EVM versions
     */
    getSupportedEvmVersions(): string[] {
        return verificationCompiler.getSupportedEvmVersions();
    }

    /**
     * Get the appropriate EVM version for a compiler version
     */
    getAppropriateEvmVersion(compilerVersion: string, requestedEvmVersion: string): string {
        return verificationCompiler.getAppropriateEvmVersion(compilerVersion, requestedEvmVersion);
    }
}

export const verificationService = new VerificationService();
