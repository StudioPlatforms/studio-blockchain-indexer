import express from 'express';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';
import { blockchain } from '../blockchain';
import { formatResponse, handleError } from './utils';
import { enhancedVerificationService } from '../verification/enhanced-verification';
import { enhancedImportHandler } from '../verification/enhanced-import-handler';
import fs from 'fs';
import { exec } from 'child_process';

const logger = createLogger('api:enhanced-contracts-verification');

/**
 * Enhanced API service for contract verification endpoints
 * Adds support for multi-file contracts and complex imports
 */
export class EnhancedContractsVerificationApiService {
    private database: IDatabase;
    private app: express.Application;

    constructor(database: IDatabase, app: express.Application) {
        this.database = database;
        this.app = app;

        this.setupRoutes();
    }

    private setupRoutes() {
        // Get contract verification details
        this.app.get('/contracts/:address/verification', this.getContractVerificationDetails.bind(this));
        
        // Verify a contract
        this.app.post('/contracts/verify', this.verifyContract.bind(this));
        
        // Verify a multi-file contract
        this.app.post('/contracts/verify-multi', this.verifyMultiFileContract.bind(this));
    }

    /**
     * Extract license from source code
     * @param sourceCode The source code
     * @returns The license
     */
    private extractLicense(sourceCode: string): string | null {
        // Look for SPDX license identifier
        const spdxMatch = sourceCode.match(/SPDX-License-Identifier:\s*([^\n\r]+)/);
        if (spdxMatch && spdxMatch[1]) {
            return spdxMatch[1].trim();
        }

        // Look for other common license patterns
        const licensePatterns = [
            /\s*@license\s+([^\n\r]+)/i,
            /\s*@title\s+.*\n\s*@license\s+([^\n\r]+)/i,
            /\s*License:\s+([^\n\r]+)/i,
            /\s*Licensed under\s+([^\n\r]+)/i
        ];

        for (const pattern of licensePatterns) {
            const match = sourceCode.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Get contract verification details
     */
    private async getContractVerificationDetails(req: express.Request, res: express.Response) {
        try {
            const address = req.params.address.toLowerCase();
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { error: 'Not a contract address' }, 404);
            }
            
            // Get the contract from the database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                return formatResponse(res, { error: 'Contract not found in database' }, 404);
            }
            
            // Get the contract verification data
            const verification = await this.database.getContractVerification(address);
            
            // If the contract is verified, return the verification details
            if (verification && verification.verified && verification.sourceCode && verification.abi) {
                // Extract license from source code
                const license = this.extractLicense(verification.sourceCode);
                
                // Get contract bytecode to extract metadata hash
                const bytecode = await blockchain.getCode(address);
                const metadataHash = enhancedVerificationService.extractMetadataHash(bytecode);
                
                // Format verification date
                const verifiedAt = verification.verifiedAt ? new Date(verification.verifiedAt).toISOString() : null;
                
                // Get contract creation info
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                // Determine contract name - use the one from verification if available, otherwise from contract
                const contractName = contract.name || 'Unknown';
                
                // Format libraries
                const libraries = verification.libraries ? JSON.parse(verification.libraries) : {};
                
                // Check if this is a multi-file contract
                const isMultiFile = verification.sourceCode.startsWith('{') && verification.sourceCode.endsWith('}');
                let sourceFiles = null;
                
                if (isMultiFile) {
                    try {
                        sourceFiles = JSON.parse(verification.sourceCode);
                    } catch (error) {
                        logger.error(`Error parsing source files for contract ${address}:`, error);
                    }
                }
                
                return formatResponse(res, {
                    address,
                    contractName,
                    compilerVersion: verification.compilerVersion,
                    license,
                    optimizationUsed: verification.optimizationUsed,
                    runs: verification.runs,
                    evmVersion: verification.evmVersion,
                    constructorArguments: verification.constructorArguments,
                    libraries,
                    verifiedAt,
                    metadataHash,
                    isMultiFile,
                    sourceFiles,
                    ownerAddress: contract.ownerAddress,
                    creatorAddress: contract.creatorAddress,
                    creationInfo: {
                        creator: creationInfo?.creator,
                        blockNumber: creationInfo?.blockNumber,
                        timestamp: creationInfo?.timestamp,
                        transactionHash: creationInfo?.transactionHash
                    }
                });
            }
            
            // If the contract is not verified, return an error
            return formatResponse(res, { 
                success: false,
                error: 'Contract is not verified' 
            }, 404);
        } catch (error) {
            return handleError(res, error, 'Error getting contract verification details');
        }
    }

    /**
     * Verify a contract by submitting its source code
     */
    private async verifyContract(req: express.Request, res: express.Response) {
        try {
            // Log the verification request
            logger.info(`Received verification request for address: ${req.body.address}`);
            
            const { 
                address, 
                sourceCode, 
                compilerVersion, 
                optimizationUsed, 
                runs, 
                constructorArguments, 
                contractName, 
                libraries, 
                evmVersion,
                importMappings,
                isMultiPart,
                sourceFiles
            } = req.body;
            
            // Check required parameters with detailed error messages
            const missingParams = [];
            if (!address) missingParams.push('address');
            if (!sourceCode && !sourceFiles) missingParams.push('sourceCode or sourceFiles');
            if (!compilerVersion) missingParams.push('compilerVersion');
            if (!contractName) missingParams.push('contractName');
            
            if (missingParams.length > 0) {
                const errorMessage = `Missing required parameters: ${missingParams.join(', ')}`;
                logger.error(errorMessage);
                return formatResponse(res, { 
                    success: false,
                    error: errorMessage
                }, 400);
            }
            
            // If isMultiPart is true and sourceFiles is provided, redirect to the multi-file verification endpoint
            if (isMultiPart && sourceFiles) {
                logger.info(`Redirecting to multi-file verification for contract ${address}`);
                return this.verifyMultiFileContract(req, res);
            }
            
            // Check if it's a contract
            logger.info(`Checking if ${address} is a contract...`);
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                logger.error(`Address ${address} is not a contract`);
                return formatResponse(res, { 
                    success: false,
                    error: 'Not a contract address' 
                }, 404);
            }
            
            // Get the contract bytecode from the blockchain
            logger.info(`Getting bytecode for contract ${address}...`);
            const onChainBytecode = await blockchain.getCode(address);
            
            // Get the contract from the database
            let contract = await this.database.getContract(address);
            
            // If the contract is not in the database, add it
            if (!contract) {
                logger.info(`Contract ${address} not found in database. Adding it...`);
                
                // Get contract creation info from the blockchain
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                if (!creationInfo) {
                    logger.error(`Failed to get creation info for contract ${address}`);
                    return formatResponse(res, { 
                        success: false,
                        error: 'Failed to get contract creation info' 
                    }, 500);
                }
                
                // Store the contract in the database
                await this.database.storeContract({
                    address,
                    creatorAddress: creationInfo.creator,
                    blockNumber: creationInfo.blockNumber,
                    timestamp: creationInfo.timestamp,
                    transactionHash: creationInfo.transactionHash,
                    contractType: 'UNKNOWN',
                    bytecode: onChainBytecode,
                    holderCount: 0,
                    transferCount: 0
                });
                
                // Get the contract from the database again
                contract = await this.database.getContract(address);
                
                if (!contract) {
                    logger.error(`Failed to add contract ${address} to database`);
                    return formatResponse(res, { 
                        success: false,
                        error: 'Failed to add contract to database' 
                    }, 500);
                }
            }
            
            // Validate constructor arguments
            if (constructorArguments && !enhancedVerificationService.validateConstructorArguments(constructorArguments)) {
                logger.error(`Invalid constructor arguments format: ${constructorArguments}`);
                return formatResponse(res, {
                    success: false,
                    error: 'Invalid constructor arguments. Must be a valid hex string without 0x prefix.'
                }, 400);
            }
            
            // Handle import mappings
            let finalImportMappings = importMappings || {};
            
            // Clear previous import mappings to avoid conflicts
            enhancedImportHandler.clearMappings();
            
            // Set up import mappings
            if (Object.keys(finalImportMappings).length > 0) {
                logger.info(`Adding ${Object.keys(finalImportMappings).length} import mappings`);
                enhancedImportHandler.addMappings(finalImportMappings);
            }
            
            // Log if we detect a complex contract like Uniswap
            if (contractName.includes('Uniswap') || 
                (sourceCode && (sourceCode.includes('@uniswap/v3-core') || 
                sourceCode.includes('@uniswap/v3-periphery')))) {
                logger.info(`Detected complex contract: ${contractName}`);
                logger.info(`Using ${Object.keys(finalImportMappings).length} import mappings for verification`);
            }
            
            // Verify the contract
            logger.info(`Starting verification for contract ${address} (${contractName})...`);
            const verificationResult = await enhancedVerificationService.verifyContract(
                sourceCode,
                compilerVersion,
                contractName,
                onChainBytecode,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries || {},
                evmVersion || 'istanbul',
                finalImportMappings
            );
            
            if (!verificationResult.success) {
                logger.error(`Verification failed for contract ${address}: ${verificationResult.message}`);
                return formatResponse(res, {
                    success: false,
                    error: verificationResult.message
                }, 400);
            }
            
            // Extract metadata hash from bytecode
            const metadataHash = enhancedVerificationService.extractMetadataHash(onChainBytecode);
            
            // Update the contract with verification data
            logger.info(`Updating contract verification data for ${address}...`);
            await this.database.updateContractVerification(
                address,
                true,
                sourceCode,
                verificationResult.abi,
                compilerVersion,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries || {},
                evmVersion || 'istanbul'
            );
            
            logger.info(`Contract ${address} (${contractName}) verified successfully`);
            return formatResponse(res, {
                success: true,
                message: 'Contract verified successfully',
                address,
                abi: verificationResult.abi,
                metadata: verificationResult.metadata,
                metadataHash
            });
        } catch (error) {
            logger.error('Error verifying contract:', error);
            
            // Provide more detailed error message
            let errorMessage = 'Error verifying contract';
            if (error instanceof Error) {
                errorMessage = `Error verifying contract: ${error.message}`;
                
                // Check for specific error types
                if (error.message.includes('compiler version')) {
                    errorMessage += '. Try using just the major.minor.patch version (e.g., "0.7.6") without the commit hash.';
                } else if (error.message.includes('import')) {
                    errorMessage += '. Check that all imported files are included in your sourceFiles object with the correct paths.';
                } else if (error.message.includes('bytecode')) {
                    errorMessage += '. Ensure your compiler settings match those used during deployment.';
                }
            }
            
            return handleError(res, error, errorMessage);
        }
    }

    /**
     * Verify a multi-file contract
     */
    private async verifyMultiFileContract(req: express.Request, res: express.Response) {
        try {
            // Log the verification request
            logger.info(`Received multi-file verification request for address: ${req.body.address}`);
            
            const { 
                address, 
                sourceFiles, 
                compilerVersion, 
                optimizationUsed, 
                runs, 
                constructorArguments, 
                contractName, 
                libraries, 
                evmVersion
            } = req.body;
            
            // Check required parameters with detailed error messages
            const missingParams = [];
            if (!address) missingParams.push('address');
            if (!sourceFiles) missingParams.push('sourceFiles');
            if (!compilerVersion) missingParams.push('compilerVersion');
            if (!contractName) missingParams.push('contractName');
            
            if (missingParams.length > 0) {
                const errorMessage = `Missing required parameters: ${missingParams.join(', ')}`;
                logger.error(errorMessage);
                return formatResponse(res, { 
                    success: false,
                    error: errorMessage
                }, 400);
            }
            
            // Check if sourceFiles is an object
            if (typeof sourceFiles !== 'object' || Array.isArray(sourceFiles)) {
                logger.error(`Invalid sourceFiles format: ${typeof sourceFiles}`);
                return formatResponse(res, {
                    success: false,
                    error: 'sourceFiles must be an object mapping file paths to file contents'
                }, 400);
            }
            
            // Check if it's a contract
            logger.info(`Checking if ${address} is a contract...`);
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                logger.error(`Address ${address} is not a contract`);
                return formatResponse(res, { 
                    success: false,
                    error: 'Not a contract address' 
                }, 404);
            }
            
            // Get the contract bytecode from the blockchain
            logger.info(`Getting bytecode for contract ${address}...`);
            const onChainBytecode = await blockchain.getCode(address);
            
            // Get the contract from the database
            let contract = await this.database.getContract(address);
            
            // If the contract is not in the database, add it
            if (!contract) {
                logger.info(`Contract ${address} not found in database. Adding it...`);
                
                // Get contract creation info from the blockchain
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                if (!creationInfo) {
                    logger.error(`Failed to get creation info for contract ${address}`);
                    return formatResponse(res, { 
                        success: false,
                        error: 'Failed to get contract creation info' 
                    }, 500);
                }
                
                // Store the contract in the database
                await this.database.storeContract({
                    address,
                    creatorAddress: creationInfo.creator,
                    blockNumber: creationInfo.blockNumber,
                    timestamp: creationInfo.timestamp,
                    transactionHash: creationInfo.transactionHash,
                    contractType: 'UNKNOWN',
                    bytecode: onChainBytecode,
                    holderCount: 0,
                    transferCount: 0
                });
                
                // Get the contract from the database again
                contract = await this.database.getContract(address);
                
                if (!contract) {
                    logger.error(`Failed to add contract ${address} to database`);
                    return formatResponse(res, { 
                        success: false,
                        error: 'Failed to add contract to database' 
                    }, 500);
                }
            }
            
            // Validate constructor arguments
            if (constructorArguments && !enhancedVerificationService.validateConstructorArguments(constructorArguments)) {
                logger.error(`Invalid constructor arguments format: ${constructorArguments}`);
                return formatResponse(res, {
                    success: false,
                    error: 'Invalid constructor arguments. Must be a valid hex string without 0x prefix.'
                }, 400);
            }
            
            // Log the source files for debugging
            logger.info(`Source files keys: ${Object.keys(sourceFiles).join(', ')}`);
            
            // Verify the multi-file contract
            logger.info(`Starting multi-file verification for contract ${address} (${contractName})...`);
            const verificationResult = await enhancedVerificationService.verifyMultiFileContract(
                {
                    sourceFiles,
                    contractName,
                    compilerVersion,
                    optimizationUsed: optimizationUsed || false,
                    runs: runs || 200,
                    evmVersion: evmVersion || 'istanbul',
                    libraries: libraries || {},
                    constructorArguments
                },
                onChainBytecode
            );
            
            if (!verificationResult.success) {
                logger.error(`Multi-file verification failed for contract ${address}: ${verificationResult.message}`);
                return formatResponse(res, {
                    success: false,
                    error: verificationResult.message
                }, 400);
            }
            
            // Extract metadata hash from bytecode
            const metadataHash = enhancedVerificationService.extractMetadataHash(onChainBytecode);
            
            // Store all source files as JSON
            const sourceFilesJson = JSON.stringify(sourceFiles, null, 2);
            
            // Update the contract with verification data
            logger.info(`Updating contract verification data for ${address}...`);
            await this.database.updateContractVerification(
                address,
                true,
                sourceFilesJson,
                verificationResult.abi,
                compilerVersion,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries || {},
                evmVersion || 'istanbul'
            );
            
            logger.info(`Contract ${address} (${contractName}) verified successfully with main file: ${verificationResult.mainFile}`);
            return formatResponse(res, {
                success: true,
                message: 'Contract verified successfully',
                address,
                abi: verificationResult.abi,
                metadata: verificationResult.metadata,
                metadataHash,
                mainFile: verificationResult.mainFile
            });
        } catch (error) {
            logger.error('Error verifying multi-file contract:', error);
            
            // Provide more detailed error message
            let errorMessage = 'Error verifying multi-file contract';
            if (error instanceof Error) {
                errorMessage = `Error verifying multi-file contract: ${error.message}`;
                
                // Check for specific error types
                if (error.message.includes('compiler version')) {
                    errorMessage += '. Try using just the major.minor.patch version (e.g., "0.7.6") without the commit hash.';
                } else if (error.message.includes('import')) {
                    errorMessage += '. Check that all imported files are included in your sourceFiles object with the correct paths.';
                } else if (error.message.includes('bytecode')) {
                    errorMessage += '. Ensure your compiler settings match those used during deployment.';
                } else if (error.message.includes('not found in any of the source files')) {
                    errorMessage += '. Make sure the contract name is correct and matches exactly (including case) with the contract definition in your source files.';
                }
            }
            
            return handleError(res, error, errorMessage);
        }
    }
}
