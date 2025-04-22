import { Request, Response } from 'express';
import express from 'express';
import { ethers } from 'ethers';
import { createLogger } from '../../utils/logger';
import { ApiService } from './core';
import { blockchain } from '../blockchain';
import { TokenTransfer } from '../database/types';
import { formatTokenTransfer } from './utils';

const logger = createLogger('api:tokens');

/**
 * TokensApiService class that extends the ApiService class
 * This class handles token-related endpoints
 */
export class TokensApiService extends ApiService {
    constructor(database: any, indexer: any, port: number, app?: express.Application) {
        super(database, indexer, port, app);
    }

    /**
     * Set up token-related routes
     */
    protected setupRoutes(): void {
        // Call the parent setupRoutes method to set up the base routes
        if (this.isMainService) {
            super.setupRoutes();
        }

        // Get account balances
        this.app.get('/account/:address/balances', this.getAccountBalances.bind(this));

        // Get address tokens
        this.app.get('/address/:address/tokens', this.getAddressTokensEndpoint.bind(this));

        // Get token transfers for an address
        this.app.get('/address/:address/token-transfers', this.getAddressTokenTransfers.bind(this));

        // Get token information
        this.app.get('/tokens/:tokenAddress', this.getTokenInformation.bind(this));

        // Get token holders
        this.app.get('/tokens/:tokenAddress/holders', this.getTokenHolders.bind(this));

        // Get token transfers
        this.app.get('/tokens/:address/transfers', this.getTokenTransfers.bind(this));
    }

    /**
     * Get account balances
     */
    private async getAccountBalances(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            
            // Get native STO balance from the blockchain
            const nativeBalance = await blockchain.getBalance(address);
            
            // Get token balances
            const tokens = await this.getAddressTokens(address);
            
            // Format the response according to the required format
            res.json({
                native: parseFloat(ethers.utils.formatEther(nativeBalance)),
                tokens: tokens
            });
        } catch (error: any) {
            logger.error('Error getting account balances:', error);
            res.status(500).json({ error: 'Failed to get account balances' });
        }
    }

    /**
     * Helper method to get token balances for an address
     */
    private async getAddressTokens(address: string): Promise<any[]> {
        try {
            // Get token balances from the database
            const tokenBalances = await this.database.getAddressTokenBalances(address);
            
            // Get token information for each token
            const tokens = await Promise.all(tokenBalances.map(async (tokenBalance) => {
                try {
                    // Get token information from the contracts database
                    const contract = await this.database.getContract(tokenBalance.tokenAddress);
                    
                    // Use contract data if available, otherwise fallback to blockchain calls
                    let name = contract?.name || '';
                    let symbol = contract?.symbol || '';
                    let decimals = contract?.decimals || 18;
                    
                    // If contract data is not available, try to get it from the blockchain
                    if (!contract || !contract.name) {
                        name = await blockchain.getTokenName(tokenBalance.tokenAddress) || '';
                    }
                    
                    if (!contract || !contract.symbol) {
                        symbol = await blockchain.getTokenSymbol(tokenBalance.tokenAddress) || '';
                    }
                    
                    if (!contract || !contract.decimals) {
                        if (tokenBalance.tokenType === 'ERC20') {
                            const tokenDecimals = await blockchain.getTokenDecimals(tokenBalance.tokenAddress);
                            if (tokenDecimals !== null) {
                                decimals = tokenDecimals;
                            }
                        }
                    }
                    
                    // Convert balance from wei to token units based on decimals
                    const balanceInTokenUnits = parseFloat(ethers.utils.formatUnits(tokenBalance.balance, decimals));
                    
                    // Include additional metadata about the token
                    return {
                        contractAddress: tokenBalance.tokenAddress,
                        symbol,
                        name,
                        balance: balanceInTokenUnits,
                        rawBalance: tokenBalance.balance,
                        decimals,
                        type: tokenBalance.tokenType,
                        isCreator: tokenBalance.isCreator || false,
                        hasActivity: tokenBalance.hasActivity || false
                    };
                } catch (error) {
                    logger.error(`Error getting token info for ${tokenBalance.tokenAddress}:`, error);
                    return null;
                }
            }));
            
            // Filter out null values and return
            // Include tokens with zero balances if they have historical activity or if the address is the creator
            return tokens.filter(token => token !== null && (token.balance > 0 || token.isCreator || token.hasActivity));
        } catch (error) {
            logger.error(`Error getting token balances for ${address}:`, error);
            return [];
        }
    }

    /**
     * Get address tokens
     */
    private async getAddressTokensEndpoint(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            const tokens = await this.getAddressTokens(address);
            res.json(tokens);
        } catch (error: any) {
            logger.error('Error getting address tokens:', error);
            res.status(500).json({ error: 'Failed to get address tokens' });
        }
    }

    /**
     * Get token transfers for an address
     */
    private async getAddressTokenTransfers(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            // Get token transfers where the address is either the sender or receiver
            const transfers = await this.database.getAddressTokenTransfers(
                address,
                { limit, offset }
            );
            
            // Format the transfers to match the required format
            const formattedTransfers = await Promise.all(transfers.map(async (transfer: TokenTransfer) => {
                // Get token information from the contracts database
                let tokenSymbol = '';
                let tokenName = '';
                let decimals = 18;
                
                try {
                    // Get token information from the contracts database
                    const contract = await this.database.getContract(transfer.tokenAddress);
                    
                    // Use contract data if available, otherwise fallback to blockchain calls
                    tokenName = contract?.name || '';
                    tokenSymbol = contract?.symbol || '';
                    decimals = contract?.decimals || 18;
                    
                    // If contract data is not available, try to get it from the blockchain
                    if (!contract || !contract.name) {
                        tokenName = await blockchain.getTokenName(transfer.tokenAddress) || '';
                    }
                    
                    if (!contract || !contract.symbol) {
                        tokenSymbol = await blockchain.getTokenSymbol(transfer.tokenAddress) || '';
                    }
                    
                    if (!contract || !contract.decimals) {
                        if (transfer.tokenType === 'ERC20') {
                            const tokenDecimals = await blockchain.getTokenDecimals(transfer.tokenAddress);
                            if (tokenDecimals !== null) {
                                decimals = tokenDecimals;
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`Error getting token info for ${transfer.tokenAddress}:`, error);
                }
                
                // Return the formatted transfer according to the required format
                return {
                    hash: transfer.transactionHash,
                    blockNumber: transfer.blockNumber,
                    timestamp: transfer.timestamp,
                    from: transfer.fromAddress,
                    to: transfer.toAddress,
                    tokenAddress: transfer.tokenAddress,
                    tokenSymbol,
                    tokenName,
                    value: transfer.value,  // Raw value in wei as a string
                    decimals
                };
            }));
            
            res.json(formattedTransfers);
        } catch (error: any) {
            logger.error('Error getting token transfers:', error);
            res.status(500).json({ error: 'Failed to get token transfers' });
        }
    }

    /**
     * Get token information
     */
    private async getTokenInformation(req: Request, res: Response): Promise<void> {
        try {
            const tokenAddress = req.params.tokenAddress;
            
            // Try to get contract information from the database first
            const contract = await this.database.getContract(tokenAddress);
            
            // If contract exists in the database, use that information
            if (contract) {
                // Get token holders and transfers count from the database
                const holdersCount = await this.database.getTokenHoldersCount(tokenAddress);
                const transfersCount = await this.database.getTokenTransfersCount(tokenAddress);
                
                res.json({
                    address: tokenAddress,
                    symbol: contract.symbol || 'UNKNOWN',
                    name: contract.name || 'Unknown Token',
                    decimals: contract.decimals || 18,
                    totalSupply: contract.totalSupply || '0',  // Raw value in wei as a string
                    type: contract.contractType || 'UNKNOWN',
                    holders: holdersCount,
                    transfers: transfersCount
                });
                return;
            }
            
            // If contract doesn't exist in the database, get information from the blockchain
            const tokenType = await blockchain.getTokenType(tokenAddress);
            if (!tokenType) {
                res.status(404).json({ error: 'Token not found' });
                return;
            }
            
            // Get token information
            const name = await blockchain.getTokenName(tokenAddress) || '';
            const symbol = await blockchain.getTokenSymbol(tokenAddress) || '';
            let decimals = 18;
            let totalSupply = '0';
            
            if (tokenType === 'ERC20') {
                const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                if (tokenDecimals !== null) {
                    decimals = tokenDecimals;
                }
                
                const supply = await blockchain.getTokenTotalSupply(tokenAddress);
                if (supply) {
                    totalSupply = supply.toString();
                }
            }
            
            // Get token holders and transfers count from the database
            const holdersCount = await this.database.getTokenHoldersCount(tokenAddress);
            const transfersCount = await this.database.getTokenTransfersCount(tokenAddress);
            
            // Store the contract information in the database for future use
            const contractData = {
                address: tokenAddress,
                creatorAddress: '0x0000000000000000000000000000000000000000', // Unknown creator
                transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Unknown transaction
                blockNumber: 0, // Unknown block
                timestamp: Math.floor(Date.now() / 1000),
                contractType: tokenType,
                name,
                symbol,
                decimals,
                totalSupply
            };
            
            try {
                await this.database.storeContract(contractData);
            } catch (error) {
                logger.error(`Error storing contract data: ${error}`);
                // Continue even if storing fails
            }
            
            res.json({
                address: tokenAddress,
                symbol,
                name,
                decimals,
                totalSupply,  // Raw value in wei as a string
                type: tokenType,
                holders: holdersCount,
                transfers: transfersCount
            });
        } catch (error: any) {
            logger.error('Error getting token information:', error);
            res.status(500).json({ error: 'Failed to get token information' });
        }
    }

    /**
     * Get token holders
     */
    private async getTokenHolders(req: Request, res: Response): Promise<void> {
        try {
            const tokenAddress = req.params.tokenAddress;
            const limit = parseInt(req.query.limit as string) || 100;
            const offset = parseInt(req.query.offset as string) || 0;
            
            // Get token holders from the database
            const holders = await this.database.getTokenHolders(tokenAddress, limit, offset);
            
            // Format the holders to match the required format
            const formattedHolders = holders.map((holder: { address: string, balance: string, percentage?: number }) => {
                return {
                    address: holder.address,
                    balance: holder.balance,  // Raw value in wei as a string
                    percentage: holder.percentage || 0  // Percentage of total supply
                };
            });
            
            res.json(formattedHolders);
        } catch (error: any) {
            logger.error('Error getting token holders:', error);
            res.status(500).json({ error: 'Failed to get token holders' });
        }
    }

    /**
     * Get token transfers
     */
    private async getTokenTransfers(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const transfers = await this.database.getTokenTransfers({
                tokenAddress: req.params.address,
                limit,
                offset
            });
            
            res.json(transfers);
        } catch (error: any) {
            logger.error('Error getting token transfers:', error);
            res.status(500).json({ error: 'Failed to get token transfers' });
        }
    }
}
