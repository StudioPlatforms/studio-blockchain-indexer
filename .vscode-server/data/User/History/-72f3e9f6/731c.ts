import express from 'express';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';
import { blockchain } from '../blockchain';
import { formatResponse, handleError } from './utils';
import { verificationService } from '../verification';
import { importHandler } from '../verification/import-handler';

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
                importMappings
            } = req.body;
            
            if (!address || !sourceCode || !compilerVersion || !contractName) {
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
            
            // Get the contract from the database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                return formatResponse(res, { 
                    success: false,
                    error: 'Contract not found in database' 
                }, 404);
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
            
            // Set up import mappings if provided
            if (importMappings) {
                importHandler.addMappings(importMappings);
            }
            
            // Verify the contract
            const verificationResult = await verificationService.verifyContract(
                sourceCode,
                compilerVersion,
                contractName,
                onChainBytecode,
                optimizationUsed,
                runs,
                constructorArguments,
                libraries,
                evmVersion,
                importMappings
            );
            
            if (!verificationResult.success) {
                return formatResponse(res, {
                    success: false,
                    error: verificationResult.message
                }, 400);
            }
            
            // Extract metadata hash from bytecode
            const metadataHash = verificationService.extractMetadataHash(onChainBytecode);
            
            // Update the contract with verification data
            await this.database.updateContractVerification(
                address,
                true,
                sourceCode,
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
            return handleError(res, error, 'Error verifying contract');
        }
    }
}
