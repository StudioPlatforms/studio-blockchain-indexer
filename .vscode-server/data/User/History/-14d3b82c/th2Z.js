#!/usr/bin/env node

/**
 * This script manually processes a token transfer for a specific transaction.
 * It gets the transaction receipt, extracts token transfers, and inserts them into the database.
 */

const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000';
const TRANSACTION_HASH = '0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d'; // USDT transfer transaction

async function getTransactionReceipt() {
    try {
        console.log(`Getting transaction receipt for ${TRANSACTION_HASH}...`);
        
        const response = await axios.get(`${API_URL}/transactions/${TRANSACTION_HASH}/receipt`);
        
        console.log('Transaction receipt:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error getting transaction receipt:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

async function getTransactionDetails() {
    try {
        console.log(`Getting transaction details for ${TRANSACTION_HASH}...`);
        
        const response = await axios.get(`${API_URL}/transactions/${TRANSACTION_HASH}`);
        
        console.log('Transaction details:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error getting transaction details:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

async function processTokenTransfer() {
    try {
        // Get the transaction receipt
        const receipt = await getTransactionReceipt();
        
        // Get the transaction details
        const tx = await getTransactionDetails();
        
        // Check if the receipt has logs
        if (!receipt.logs || receipt.logs.length === 0) {
            console.log('No logs found in the receipt');
            return;
        }
        
        // Check for ERC20 Transfer events
        const erc20TransferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        
        for (const log of receipt.logs) {
            if (log.topics[0] === erc20TransferTopic) {
                console.log('Found ERC20 Transfer event:');
                console.log(JSON.stringify(log, null, 2));
                
                // Extract transfer details
                const from = ethers.utils.getAddress('0x' + log.topics[1].substring(26));
                const to = ethers.utils.getAddress('0x' + log.topics[2].substring(26));
                const value = ethers.BigNumber.from(log.data).toString();
                
                console.log(`From: ${from}`);
                console.log(`To: ${to}`);
                console.log(`Value: ${value}`);
                
                // Create a token transfer object
                const tokenTransfer = {
                    transactionHash: TRANSACTION_HASH,
                    blockNumber: receipt.blockNumber,
                    tokenAddress: log.address,
                    fromAddress: from,
                    toAddress: to,
                    value,
                    tokenType: 'ERC20',
                    timestamp: tx.timestamp
                };
                
                // Insert the token transfer into the database
                console.log('Inserting token transfer into the database...');
                
                try {
                    const response = await axios.post(`${API_URL}/admin/token-transfers`, tokenTransfer);
                    console.log('Token transfer inserted successfully:');
                    console.log(JSON.stringify(response.data, null, 2));
                } catch (error) {
                    console.error('Error inserting token transfer:');
                    if (error.response) {
                        console.error(JSON.stringify(error.response.data, null, 2));
                    } else {
                        console.error(error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing token transfer:', error);
    }
}

processTokenTransfer();
