import express from 'express';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';
import { blockchain } from '../blockchain';
import { formatResponse, handleError } from './utils';
import { verificationService } from '../verification';
import { importHandler } from '../verification/import-handler';
import fs from 'fs';
import { exec } from 'child_process';

const logger = createLogger('api:contracts-verification');

/**
 * API service for contract verification endpoints
 */
export class ContractsVerificationApiService {
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
                const metadataHash = verificationService.extractMetadataHash(bytecode);
                
                // Format verification date
                const verifiedAt = verification.verifiedAt ? new Date(verification.verifiedAt).toISOString() : null;
                
                // Get contract creation info
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                // Determine contract name - use the one from verification if available, otherwise from contract
                const contractName = contract.name || 'Unknown';
                
                // Format libraries
                const libraries = verification.libraries ? JSON.parse(verification.libraries) : {};
                
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
            
            // Check required parameters
            if (!address || (!sourceCode && !sourceFiles) || !compilerVersion || !contractName) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Missing required parameters' 
                }, 400);
            }
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (!isContract) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Not a contract address' 
                }, 404);
            }
            
            // Get the contract bytecode from the blockchain
            const onChainBytecode = await blockchain.getCode(address);
            
            // Get the contract from the database
            let contract = await this.database.getContract(address);
            
            // If the contract is not in the database, add it
            if (!contract) {
                logger.info(`Contract ${address} not found in database. Adding it...`);
                
                // Get contract creation info from the blockchain
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                // Add the contract to the database
                await this.database.addContract({
                    address,
                    creatorAddress: creationInfo?.creator || null,
                    ownerAddress: null,
                    blockNumber: creationInfo?.blockNumber || null,
                    timestamp: creationInfo?.timestamp || null,
                    transactionHash: creationInfo?.transactionHash || null,
                    contractType: 'unknown',
                    name: null,
                    symbol: null,
                    decimals: null,
                    totalSupply: null,
                    balance: null,
                    bytecode: onChainBytecode,
                    holderCount: 0,
                    transferCount: 0,
                    verified: false
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
            
            // Get the contract bytecode from the blockchain
            const onChainBytecode = await blockchain.getCode(address);
            
            // Validate constructor arguments
            if (constructorArguments && !verificationService.validateConstructorArguments(constructorArguments)) {
                return formatResponse(res, {
                    success: false,
                    error: 'Invalid constructor arguments. Must be a valid hex string.'
                }, 400);
            }
            
            // Handle multi-part source files
            let finalSourceCode = sourceCode;
            let finalImportMappings = importMappings || {};
            
            if (isMultiPart && sourceFiles) {
                logger.info(`Processing multi-part verification for contract ${address}`);
                
                // For multi-part verification, we use the main file as the source code
                // and add all other files as import mappings
                const mainFile = sourceFiles[contractName + '.sol'] || Object.values(sourceFiles)[0];
                finalSourceCode = mainFile;
                
                // Add all source files as import mappings
                for (const [fileName, fileContent] of Object.entries(sourceFiles)) {
                    if (fileName !== contractName + '.sol') {
                        finalImportMappings[fileName] = fileContent;
                    }
                }
                
                logger.info(`Using ${Object.keys(finalImportMappings).length} import mappings for multi-part verification`);
            }
            
            // Set up import mappings
            if (Object.keys(finalImportMappings).length > 0) {
                importHandler.addMappings(finalImportMappings);
            }
            
            // Log if we detect a complex contract like Uniswap
            if (contractName.includes('Uniswap') || 
                finalSourceCode.includes('@uniswap/v3-core') || 
                finalSourceCode.includes('@uniswap/v3-periphery')) {
                logger.info(`Detected complex contract: ${contractName}`);
                logger.info(`Using ${Object.keys(finalImportMappings).length} import mappings for verification`);
            }
            
            // Verify the contract
            const verificationResult = await verificationService.verifyContract(
                finalSourceCode,
                compilerVersion,
                contractName,
                onChainBytecode,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries,
                evmVersion,
                finalImportMappings
            );
            
            if (!verificationResult.success) {
                return formatResponse(res, {
                    success: false,
                    error: verificationResult.message
                }, 400);
            }
            
            // Extract metadata hash from bytecode
            const metadataHash = verificationService.extractMetadataHash(onChainBytecode);
            
            // For multi-part verification, store all source files
            let sourceToStore = finalSourceCode;
            if (isMultiPart && sourceFiles) {
                // Create a JSON representation of all source files
                sourceToStore = JSON.stringify(sourceFiles, null, 2);
            }
            
            // Update the contract with verification data
            await this.database.updateContractVerification(
                address,
                true,
                sourceToStore,
                verificationResult.abi,
                compilerVersion,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries,
                evmVersion
            );
            
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
            return handleError(res, error, 'Error verifying contract');
        }
    }
}
