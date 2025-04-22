import express from 'express';
import { IDatabase } from '../database/types';
import { createLogger } from '../../utils/logger';
import { blockchain } from '../blockchain';
import { formatResponse, handleError } from './utils';

const logger = createLogger('api:transactions');

/**
 * API service for transaction-related endpoints
 */
export class TransactionsApiService {
    private database: IDatabase;
    private app: express.Application;

    constructor(database: IDatabase, app: express.Application) {
        this.database = database;
        this.app = app;

        this.setupRoutes();
    }

    private setupRoutes() {
        // Get transaction details
        this.app.get('/transactions/:hash', this.getTransaction.bind(this));

        // Get decoded transaction data
        this.app.get('/transactions/:hash/decoded', this.getDecodedTransaction.bind(this));
    }

    /**
     * Get transaction details
     */
    private async getTransaction(req: express.Request, res: express.Response) {
        try {
            const hash = req.params.hash;
            
            // Get transaction from blockchain
            const transaction = await blockchain.getTransaction(hash);
            
            if (!transaction) {
                return formatResponse(res, { error: 'Transaction not found' }, 404);
            }
            
            return formatResponse(res, transaction);
        } catch (error) {
            return handleError(res, error, 'Error getting transaction');
        }
    }

    /**
     * Get decoded transaction data
     */
    private async getDecodedTransaction(req: express.Request, res: express.Response) {
        try {
            const hash = req.params.hash;
            
            // Get transaction from blockchain
            const transaction = await blockchain.getTransaction(hash);
            
            if (!transaction) {
                return formatResponse(res, { error: 'Transaction not found' }, 404);
            }
            
            // Check if the transaction is a contract interaction
            if (!transaction.to || !transaction.data || transaction.data === '0x') {
                return formatResponse(res, {
                    transaction,
                    decoded: null,
                    description: 'Not a contract interaction'
                });
            }
            
            // Get the contract from the database
            const contract = await this.database.getContract(transaction.to);
            
            // Get the contract verification data
            const verification = contract ? await this.database.getContractVerification(transaction.to) : null;
            
            // If the contract is not verified, return the transaction without decoded data
            if (!verification || !verification.verified || !verification.abi) {
                return formatResponse(res, {
                    transaction,
                    decoded: null,
                    description: 'Contract is not verified'
                });
            }
            
            // Decode the transaction data
            const decodedData = blockchain.decodeTransactionData(transaction.data, verification.abi);
            
            if (!decodedData) {
                return formatResponse(res, {
                    transaction,
                    decoded: null,
                    description: 'Could not decode transaction data'
                });
            }
            
            // Format the decoded data
            const formattedData = blockchain.formatDecodedData(decodedData);
            
            // Get a human-readable description of the transaction
            const description = blockchain.getTransactionDescription(
                decodedData,
                contract?.name,
                contract?.contractType
            );
            
            // Get transaction receipt to calculate gas used and transaction fee
            const receipt = await blockchain.getTransactionReceipt(hash);
            
            // Calculate transaction cost
            const transactionCost = {
                value: transaction.value ? transaction.value.toString() : '0',
                gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : '0',
                gasLimit: transaction.gasLimit ? transaction.gasLimit.toString() : '0',
                gasUsed: receipt ? receipt.gasUsed.toString() : '0',
                transactionFee: receipt && transaction.gasPrice ? 
                    (receipt.gasUsed.mul(transaction.gasPrice)).toString() : '0',
                // Format values for display
                valueFormatted: transaction.value ? 
                    (parseFloat(transaction.value.toString()) / 1e18).toString() + ' ETH' : '0 ETH',
                transactionFeeFormatted: receipt && transaction.gasPrice ? 
                    (parseFloat(receipt.gasUsed.mul(transaction.gasPrice).toString()) / 1e18).toString() + ' ETH' : '0 ETH'
            };
            
            return formatResponse(res, {
                transaction,
                decoded: formattedData,
                description,
                cost: transactionCost
            });
        } catch (error) {
            return handleError(res, error, 'Error getting decoded transaction');
        }
    }
}
