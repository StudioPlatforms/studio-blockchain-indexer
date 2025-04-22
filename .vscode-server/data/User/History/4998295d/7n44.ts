import { Request, Response } from 'express';
import { createLogger } from '../../utils/logger';
import { ApiService } from './core';
import { blockchain } from '../blockchain';

const logger = createLogger('api:blockchain');

/**
 * BlockchainApiService class that extends the ApiService class
 * This class handles blockchain-related endpoints
 */
export class BlockchainApiService extends ApiService {
    /**
     * Set up blockchain-related routes
     */
    protected setupRoutes(): void {
        // Call the parent setupRoutes method to set up the base routes
        super.setupRoutes();

        // Get block by number
        this.app.get('/blocks/:number', this.getBlockByNumber.bind(this));

        // Get block by hash
        this.app.get('/blocks/hash/:hash', this.getBlockByHash.bind(this));

        // Get transaction receipt
        this.app.get('/transactions/:hash/receipt', this.getTransactionReceipt.bind(this));

        // Get pending transactions
        this.app.get('/transactions/pending', this.getPendingTransactions.bind(this));

        // Get latest transactions
        this.app.get('/transactions', this.getLatestTransactions.bind(this));

        // Filter logs
        this.app.post('/logs/filter', this.filterLogs.bind(this));

        // Get latest blocks
        this.app.get('/blocks', this.getLatestBlocks.bind(this));

        // Get transaction by hash
        this.app.get('/transactions/:hash', this.getTransactionByHash.bind(this));

        // Get transactions by address
        this.app.get('/address/:address/transactions', this.getTransactionsByAddress.bind(this));

        // Get address type
        this.app.get('/address/:address/type', this.getAddressType.bind(this));

        // Search endpoint
        this.app.get('/search', this.search.bind(this));

        // Detect new contracts
        this.app.get('/contracts/detect', this.detectNewContracts.bind(this));
    }

    /**
     * Get a block by its number
     */
    private async getBlockByNumber(req: Request, res: Response): Promise<void> {
        try {
            const blockNumber = parseInt(req.params.number);
            const block = await this.database.getBlock(blockNumber);
            if (!block) {
                res.status(404).json({ error: 'Block not found' });
                return;
            }
            
            const transactions = await this.database.getTransactionsByBlock(block.number);
            res.json({
                ...block,
                transactions
            });
        } catch (error: any) {
            logger.error('Error getting block:', error);
            res.status(500).json({ error: 'Failed to get block' });
        }
    }

    /**
     * Get a block by its hash
     */
    private async getBlockByHash(req: Request, res: Response): Promise<void> {
        try {
            const block = await this.database.getBlock(req.params.hash);
            if (!block) {
                res.status(404).json({ error: 'Block not found' });
                return;
            }
            
            const transactions = await this.database.getTransactionsByBlock(block.number);
            res.json({
                ...block,
                transactions
            });
        } catch (error: any) {
            logger.error('Error getting block by hash:', error);
            res.status(500).json({ error: 'Failed to get block' });
        }
    }

    /**
     * Get a transaction receipt
     */
    private async getTransactionReceipt(req: Request, res: Response): Promise<void> {
        try {
            const receipt = await blockchain.getTransactionReceipt(req.params.hash);
            if (!receipt) {
                res.status(404).json({ error: 'Transaction receipt not found' });
                return;
            }
            res.json(receipt);
        } catch (error: any) {
            logger.error('Error getting transaction receipt:', error);
            res.status(500).json({ error: 'Failed to get transaction receipt' });
        }
    }

    /**
     * Get pending transactions
     */
    private async getPendingTransactions(req: Request, res: Response): Promise<void> {
        try {
            const pendingTxs = await blockchain.getPendingTransactions();
            res.json(pendingTxs);
        } catch (error: any) {
            logger.error('Error getting pending transactions:', error);
            res.status(500).json({ error: 'Failed to get pending transactions' });
        }
    }

    /**
     * Get latest transactions
     */
    private async getLatestTransactions(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const transactions = await this.database.getLatestTransactions(limit, offset);
            res.json(transactions);
        } catch (error: any) {
            logger.error('Error getting latest transactions:', error);
            res.status(500).json({ error: 'Failed to get latest transactions' });
        }
    }

    /**
     * Filter logs
     */
    private async filterLogs(req: Request, res: Response): Promise<void> {
        try {
            const filter = req.body;
            
            // Validate filter
            if (!filter || (!filter.address && !filter.topics)) {
                res.status(400).json({ error: 'Invalid filter. Must provide address and/or topics.' });
                return;
            }
            
            const logs = await blockchain.getLogs(filter);
            res.json(logs);
        } catch (error: any) {
            logger.error('Error filtering logs:', error);
            res.status(500).json({ error: 'Failed to filter logs' });
        }
    }

    /**
     * Get latest blocks
     */
    private async getLatestBlocks(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const latestBlock = await this.database.getLatestBlock();
            if (!latestBlock) {
                res.json([]);
                return;
            }

            const blocks = [];
            for (let i = 0; i < limit && (latestBlock - i - offset) >= 0; i++) {
                const blockNumber = latestBlock - i - offset;
                const block = await this.database.getBlock(blockNumber);
                if (block) {
                    blocks.push(block);
                }
            }
            
            res.json(blocks);
        } catch (error: any) {
            logger.error('Error getting blocks:', error);
            res.status(500).json({ error: 'Failed to get blocks' });
        }
    }

    /**
     * Get a transaction by its hash
     */
    private async getTransactionByHash(req: Request, res: Response): Promise<void> {
        try {
            const transaction = await this.database.getTransaction(req.params.hash);
            if (!transaction) {
                res.status(404).json({ error: 'Transaction not found' });
                return;
            }
            res.json(transaction);
        } catch (error: any) {
            logger.error('Error getting transaction:', error);
            res.status(500).json({ error: 'Failed to get transaction' });
        }
    }

    /**
     * Get transactions by address
     */
    private async getTransactionsByAddress(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            
            const transactions = await this.database.getTransactionsByAddress(
                req.params.address,
                limit,
                offset
            );
            
            res.json(transactions);
        } catch (error: any) {
            logger.error('Error getting address transactions:', error);
            res.status(500).json({ error: 'Failed to get transactions' });
        }
    }

    /**
     * Get address type
     */
    private async getAddressType(req: Request, res: Response): Promise<void> {
        try {
            const address = req.params.address;
            
            // Check if it's a contract
            const isContract = await blockchain.isContract(address);
            
            if (isContract) {
                // Determine token type
                const tokenType = await blockchain.getTokenType(address);
                
                if (tokenType) {
                    res.json({ 
                        address, 
                        type: 'contract', 
                        contractType: tokenType 
                    });
                } else {
                    res.json({ 
                        address, 
                        type: 'contract', 
                        contractType: 'unknown' 
                    });
                }
            } else {
                // It's a regular wallet address
                res.json({ 
                    address, 
                    type: 'wallet' 
                });
            }
        } catch (error: any) {
            logger.error('Error getting address type:', error);
            res.status(500).json({ error: 'Failed to get address type' });
        }
    }

    /**
     * Search for a block, transaction, or address
     */
    private async search(req: Request, res: Response): Promise<void> {
        try {
            const query = req.query.q as string;
            if (!query) {
                res.status(400).json({ error: 'Query parameter is required' });
                return;
            }
            
            // Check if it's a block number (all digits)
            if (/^\d+$/.test(query)) {
                const block = await this.database.getBlock(parseInt(query));
                if (block) {
                    res.json({ type: 'block', data: block });
                    return;
                }
            }
            
            // Check if it's a block hash or transaction hash (0x followed by 64 hex chars)
            if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
                // Try as transaction hash first
                const tx = await this.database.getTransaction(query);
                if (tx) {
                    res.json({ type: 'transaction', data: tx });
                    return;
                }
                
                // Try as block hash
                const block = await this.database.getBlock(query);
                if (block) {
                    res.json({ type: 'block', data: block });
                    return;
                }
            }
            
            // Check if it's an address (0x followed by 40 hex chars)
            if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
                // Check if it's a contract
                const isContract = await blockchain.isContract(query);
                
                // Get transactions for this address
                const transactions = await this.database.getTransactionsByAddress(query, 10, 0);
                
                if (isContract) {
                    // Determine token type
                    const tokenType = await blockchain.getTokenType(query);
                    
                    if (tokenType) {
                        res.json({ 
                            type: 'address', 
                            addressType: 'contract',
                            contractType: tokenType,
                            data: { 
                                address: query, 
                                transactions 
                            } 
                        });
                    } else {
                        res.json({ 
                            type: 'address', 
                            addressType: 'contract',
                            contractType: 'unknown',
                            data: { 
                                address: query, 
                                transactions 
                            } 
                        });
                    }
                } else {
                    // It's a regular wallet address
                    res.json({ 
                        type: 'address', 
                        addressType: 'wallet',
                        data: { 
                            address: query, 
                            transactions 
                        } 
                    });
                }
                return;
            }
            
            res.status(404).json({ error: 'No results found' });
        } catch (error: any) {
            logger.error('Error searching:', error);
            res.status(500).json({ error: 'Search failed' });
        }
    }

    /**
     * Detect new contracts
     */
    private async detectNewContracts(req: Request, res: Response): Promise<void> {
        try {
            const fromBlock = parseInt(req.query.fromBlock as string) || 0;
            const toBlock = parseInt(req.query.toBlock as string) || await blockchain.getLatestBlockNumber();
            
            const contracts = await blockchain.detectNewContracts(fromBlock, toBlock);
            res.json(contracts);
        } catch (error: any) {
            logger.error('Error detecting new contracts:', error);
            res.status(500).json({ error: 'Failed to detect new contracts' });
        }
    }
}
