import { Request, Response } from 'express';
import express from 'express';
import { createLogger } from '../../utils/logger';
import { ApiService } from './core';
import { blockchain } from '../blockchain';
import { fetchNFTMetadata } from './utils';

const logger = createLogger('api:nfts');

/**
 * NFTsApiService class that extends the ApiService class
 * This class handles NFT-related endpoints
 */
export class NFTsApiService extends ApiService {
    constructor(database: any, indexer: any, port: number, app?: express.Application) {
        super(database, indexer, port, app);
    }

    /**
     * Set up NFT-related routes
     */
    protected setupRoutes(): void {
        // Call the parent setupRoutes method to set up the base routes
        if (this.isMainService) {
            super.setupRoutes();
        }

        // Get NFTs owned by an address
        this.app.get('/address/:address/nfts', this.getNFTsByOwner.bind(this));

        // Get NFT metadata
        this.app.get('/nfts/:tokenAddress/:tokenId', this.getNFTMetadata.bind(this));

        // Get NFT transfers by address
        this.app.get('/address/:address/nft-transfers', this.getNFTTransfersByAddress.bind(this));

        // Get NFT collection
        this.app.get('/nfts/:tokenAddress', this.getNFTCollection.bind(this));

        // Get NFT collections
        this.app.get('/nfts', this.getNFTCollections.bind(this));
    }

    /**
     * Get NFTs owned by an address
     */
    private async getNFTsByOwner(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            const tokenAddress = req.query.tokenAddress as string;
            
            const nfts = await this.database.getNFTsByOwner(
                req.params.address,
                {
                    tokenAddress,
                    limit,
                    offset
                }
            );
            
            res.json(nfts);
        } catch (error: any) {
            logger.error('Error getting NFTs by owner:', error);
            res.status(500).json({ error: 'Failed to get NFTs' });
        }
    }

    /**
     * Get NFT metadata
     */
    private async getNFTMetadata(req: Request, res: Response): Promise<void> {
        try {
            const { tokenAddress, tokenId } = req.params;
            
            // Try to get the NFT metadata from the database
            const metadata = await this.database.getNFTMetadata(tokenAddress, tokenId);
            if (!metadata) {
                res.status(404).json({ error: 'NFT metadata not found' });
                return;
            }
            
            // Since we don't have a direct method to get an NFT by token address and token ID,
            // we'll just return the metadata
            res.json({
                tokenAddress,
                tokenId,
                metadata
            });
        } catch (error: any) {
            logger.error('Error getting NFT metadata:', error);
            res.status(500).json({ error: 'Failed to get NFT metadata' });
        }
    }

    /**
     * Get NFT transfers by address
     */
    private async getNFTTransfersByAddress(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            const tokenAddress = req.query.tokenAddress as string;
            const tokenType = req.query.tokenType as 'ERC721' | 'ERC1155' | undefined;
            
            const transfers = await this.database.getNFTTransfersByAddress(
                req.params.address,
                {
                    tokenAddress,
                    tokenType,
                    limit,
                    offset
                }
            );
            
            res.json(transfers);
        } catch (error: any) {
            logger.error('Error getting NFT transfers by address:', error);
            res.status(500).json({ error: 'Failed to get NFT transfers' });
        }
    }

    /**
     * Get NFT collection
     */
    private async getNFTCollection(req: Request, res: Response): Promise<void> {
        try {
            const { tokenAddress } = req.params;
            
            // Try to get the NFT collection from the database
            const nftCollection = await this.database.getNFTCollection(tokenAddress);
            if (!nftCollection) {
                res.status(404).json({ error: 'NFT collection not found' });
                return;
            }
            
            res.json(nftCollection);
        } catch (error: any) {
            logger.error('Error getting NFT collection:', error);
            res.status(500).json({ error: 'Failed to get NFT collection' });
        }
    }

    /**
     * Get NFT collections
     */
    private async getNFTCollections(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const collections = await this.database.getNFTCollections({
                limit,
                offset
            });
            
            res.json(collections);
        } catch (error: any) {
            logger.error('Error getting NFT collections:', error);
            res.status(500).json({ error: 'Failed to get NFT collections' });
        }
    }
}
