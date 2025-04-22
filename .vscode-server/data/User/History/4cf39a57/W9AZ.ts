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
            
            // Get native STO balance
            const nativeBalance = await blockchain.getBalance(address);
            
            // Get token balances
            const tokens = await this.getAddressTokens(address);
            
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
            // Get token transfers for this address
            const transfers = await this.database.getTokenTransfers({
                fromAddress: address,
                toAddress: address,
                limit: 1000,
                offset: 0
            });
            
            // Extract unique token addresses
            const tokenAddresses = new Set<string>();
            transfers.forEach((transfer: TokenTransfer) => {
                tokenAddresses.add(transfer.tokenAddress);
            });
            
            // Get token balances for each token
            const tokens = await Promise.all(Array.from(tokenAddresses).map(async (tokenAddress) => {
                try {
                    // Get token type
                    const tokenType = await blockchain.getTokenType(tokenAddress);
                    if (!tokenType) return null;
                    
                    // Get token information
                    const name = await blockchain.getTokenName(tokenAddress) || '';
                    const symbol = await blockchain.getTokenSymbol(tokenAddress) || '';
                    let decimals = 18;
                    let balance = '0';
                    
                    if (tokenType === 'ERC20') {
                        const tokenDecimals = await blockchain.getTokenDecimals(tokenAddress);
                        if (tokenDecimals !== null) {
                            decimals = tokenDecimals;
                        }
                        
                        const tokenBalance = await blockchain.getTokenBalance(tokenAddress, address);
                        if (tokenBalance) {
                            balance = tokenBalance.toString();
                        }
                    } else if (tokenType === 'ERC721') {
                        const tokenBalance = await blockchain.getTokenBalance(tokenAddress, address);
                        if (tokenBalance) {
                            balance = tokenBalance.toString();
                        }
                    }
                    
                    // Convert balance from wei to token units
                    const balanceInTokenUnits = parseFloat(ethers.utils.formatUnits(balance, decimals));
                    
                    return {
                        contractAddress: tokenAddress,
                        symbol,
                        name,
                        balance: balanceInTokenUnits,
                        decimals,
                        type: tokenType
                    };
                } catch (error) {
                    logger.error(`Error getting token balance for ${tokenAddress}:`, error);
                    return null;
                }
            }));
            
            // Filter out null values and return
            return tokens.filter(token => token !== null);
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
            const transfers = await this.database.getTokenTransfers({
                fromAddress: address,
                toAddress: address,
                limit,
                offset
            });
            
            // Format the transfers to match the required format
            const formattedTransfers = await Promise.all(transfers.map(async (transfer: TokenTransfer) => {
                // Get token information
                let tokenSymbol = '';
                let tokenName = '';
                let decimals = 18;
                
                try {
                    if (transfer.tokenType === 'ERC20') {
                        tokenSymbol = await blockchain.getTokenSymbol(transfer.tokenAddress) || '';
                        tokenName = await blockchain.getTokenName(transfer.tokenAddress) || '';
                        const tokenDecimals = await blockchain.getTokenDecimals(transfer.tokenAddress);
                        if (tokenDecimals !== null) {
                            decimals = tokenDecimals;
                        }
                    } else if (transfer.tokenType === 'ERC721' || transfer.tokenType === 'ERC1155') {
                        tokenSymbol = await blockchain.getTokenSymbol(transfer.tokenAddress) || '';
                        tokenName = await blockchain.getTokenName(transfer.tokenAddress) || '';
                    }
                } catch (error) {
                    logger.error(`Error getting token info for ${transfer.tokenAddress}:`, error);
                }
                
                return formatTokenTransfer(transfer, tokenSymbol, tokenName, decimals);
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
            
            // Get token type
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
            
            // Get token holders and transfers count (optional)
            // This would typically require indexing all token transfers
            // For now, we'll return placeholder values
            const holders = 0;
            const transfers = 0;
            
            res.json({
                address: tokenAddress,
                symbol,
                name,
                decimals,
                totalSupply,
                type: tokenType,
                holders,
                transfers
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
            
            // Get token holders
            // This would typically require indexing all token transfers
            // For now, we'll return an empty array
            const holders = await blockchain.getTokenHolders(tokenAddress) || [];
            
            res.json(holders);
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
