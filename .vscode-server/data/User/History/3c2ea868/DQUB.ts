import { Request, Response } from 'express';
import express from 'express';
import { createLogger } from '../../utils/logger';
import { ApiService } from './core';
import { blockchain } from '../blockchain';
import { ContractData } from '../blockchain/types';

const logger = createLogger('api:contracts');

/**
 * ContractsApiService class that extends the ApiService class
 * This class handles contract-related endpoints
 */
export class ContractsApiService extends ApiService {
    constructor(database: any, indexer: any, port: number, app?: express.Application) {
        super(database, indexer, port, app);
    }

    /**
     * Set up contract-related routes
     */
    protected setupRoutes(): void {
        // Call the parent setupRoutes method to set up the base routes
        if (this.isMainService) {
            super.setupRoutes();
        }

        // Get contract information
        this.app.get('/contracts/:address', this.getContractInformation.bind(this));

        // Get contracts by creator
        this.app.get('/address/:address/contracts', this.getContractsByCreator.bind(this));

        // Get token contracts
        this.app.get('/contracts/tokens/:type?', this.getTokenContracts.bind(this));

        // Get contract event logs
        this.app.get('/contracts/:address/logs', this.getContractLogs.bind(this));
    }

    /**
     * Get contract information
     */
    private async getContractInformation(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            
            // Get contract from database
            const contract = await this.database.getContract(address);
            
            if (!contract) {
                // If contract is not in the database, try to get it from the blockchain
                const isContract = await blockchain.isContract(address);
                
                if (!isContract) {
                    res.status(404).json({ error: 'Contract not found' });
                    return;
                }
                
                // Get contract information from the blockchain
                const contractType = await blockchain.getTokenType(address) || 'UNKNOWN';
                const creationInfo = await blockchain.getContractCreationInfo(address);
                
                if (!creationInfo) {
                    res.status(404).json({ error: 'Contract creation info not found' });
                    return;
                }
                
                // Create contract data
                const contractData: ContractData = {
                    address,
                    creatorAddress: creationInfo.creator,
                    transactionHash: creationInfo.transactionHash,
                    blockNumber: creationInfo.blockNumber,
                    timestamp: creationInfo.timestamp,
                    contractType
                };
                
                // If it's a token, get token information
                if (contractType !== 'UNKNOWN') {
                    contractData.name = await blockchain.getTokenName(address) || '';
                    contractData.symbol = await blockchain.getTokenSymbol(address) || '';
                    
                    if (contractType === 'ERC20') {
                        const decimals = await blockchain.getTokenDecimals(address);
                        if (decimals !== null) {
                            contractData.decimals = decimals;
                        }
                        
                        const totalSupply = await blockchain.getTokenTotalSupply(address);
                        if (totalSupply) {
                            contractData.totalSupply = totalSupply.toString();
                        }
                    }
                }
                
                // Store contract in database
                try {
                    await this.database.storeContract(contractData);
                } catch (error) {
                    logger.error(`Error storing contract: ${error}`);
                    // Continue even if storing fails
                }
                
                res.json(contractData);
                return;
            }
            
            // Return contract from database
            res.json(contract);
        } catch (error: any) {
            logger.error('Error getting contract information:', error);
            res.status(500).json({ error: 'Failed to get contract information' });
        }
    }

    /**
     * Get contracts by creator
     */
    private async getContractsByCreator(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            // Get contracts from database
            const contracts = await this.database.getContractsByCreator(address, limit, offset);
            
            res.json(contracts);
        } catch (error: any) {
            logger.error('Error getting contracts by creator:', error);
            res.status(500).json({ error: 'Failed to get contracts by creator' });
        }
    }

    /**
     * Get token contracts
     */
    private async getTokenContracts(req: Request, res: Response): Promise<void> {
        try {
            const type = req.params.type as 'ERC20' | 'ERC721' | 'ERC1155' | undefined;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            // Get token contracts from database
            const contracts = await this.database.getTokenContracts(type, limit, offset);
            
            res.json(contracts);
        } catch (error: any) {
            logger.error('Error getting token contracts:', error);
            res.status(500).json({ error: 'Failed to get token contracts' });
        }
    }

    /**
     * Get contract event logs
     */
    private async getContractLogs(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            const fromBlock = req.query.fromBlock ? parseInt(req.query.fromBlock as string) : undefined;
            const toBlock = req.query.toBlock ? parseInt(req.query.toBlock as string) : undefined;
            const topic0 = req.query.topic0 as string | undefined;
            
            // Get event logs from database
            const logs = await this.database.getEventLogs({
                address,
                topic0,
                fromBlock,
                toBlock,
                limit,
                offset
            });
            
            res.json(logs);
        } catch (error: any) {
            logger.error('Error getting contract logs:', error);
            res.status(500).json({ error: 'Failed to get contract logs' });
        }
    }
}
