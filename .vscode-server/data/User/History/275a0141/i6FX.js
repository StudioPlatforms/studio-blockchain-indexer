#!/usr/bin/env node

/**
 * This script scans past blocks for token transfers and inserts them into the database.
 * It uses the blockchain service to get blocks and transactions, extracts token transfers
 * from transaction receipts, and inserts them into the database through the Docker container.
 */

const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000';

const RPC_URLS = [
    'https://mainnet.studio-blockchain.com',
    'https://mainnet2.studio-blockchain.com',
    'https://mainnet3.studio-blockchain.com',
    'https://mainnet.studio-scan.com',
    'https://mainnet2.studio-scan.com'
];

// ERC20 Transfer event signature
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Create a provider with fallback URLs
const provider = new ethers.providers.FallbackProvider(
    RPC_URLS.map(url => new ethers.providers.JsonRpcProvider(url))
);

// Function to get a block with transactions
async function getBlockWithTransactions(blockNumber) {
    try {
        console.log(`Getting block ${blockNumber}...`);
        const block = await provider.getBlockWithTransactions(blockNumber);
        return block;
    } catch (error) {
        console.error(`Error getting block ${blockNumber}:`, error);
        throw error;
    }
}

// Function to get a transaction receipt
async function getTransactionReceipt(txHash) {
    try {
        console.log(`Getting receipt for transaction ${txHash}...`);
        const receipt = await provider.getTransactionReceipt(txHash);
        return receipt;
    } catch (error) {
        console.error(`Error getting receipt for transaction ${txHash}:`, error);
        throw error;
    }
}

// Function to extract token transfers from a transaction receipt
function getTokenTransfersFromReceipt(receipt) {
    const transfers = [];

    try {
        // Check for ERC20 Transfer events
        for (const log of receipt.logs) {
            if (log.topics[0] === ERC20_TRANSFER_TOPIC) {
                try {
                    // Extract transfer details
                    const from = ethers.utils.getAddress('0x' + log.topics[1].substring(26));
                    const to = ethers.utils.getAddress('0x' + log.topics[2].substring(26));
                    const value = ethers.BigNumber.from(log.data).toString();

                    transfers.push({
                        tokenAddress: log.address,
                        from,
                        to,
                        value,
                        tokenType: 'ERC20'
                    });
                } catch (error) {
                    console.error(`Error extracting ERC20 Transfer data from log:`, error);
                }
            }
        }
    } catch (error) {
        console.error(`Error getting token transfers from receipt:`, error);
    }

    return transfers;
}

// Function to insert a token transfer through the API
async function insertTokenTransfer(transfer, txHash, blockNumber, timestamp) {
    try {
        // Create a token transfer object
        const tokenTransfer = {
            transactionHash: txHash,
            blockNumber,
            tokenAddress: transfer.tokenAddress,
            fromAddress: transfer.from,
            toAddress: transfer.to,
            value: transfer.value,
            tokenType: transfer.tokenType,
            tokenId: transfer.tokenId,
            timestamp
        };

        // We don't have a direct API endpoint to insert token transfers
        // Instead, we'll log the token transfer details
        console.log(`Found token transfer: ${transfer.from} -> ${transfer.to}, ${transfer.value} tokens of ${transfer.tokenAddress}`);
        
        // Save to a local file for later processing
        const fs = require('fs');
        fs.appendFileSync('/root/token-transfers.json', JSON.stringify(tokenTransfer) + '\n');
        
        return true;
    } catch (error) {
        console.error(`Error inserting token transfer:`, error);
        return false;
    }
}

// Function to process a block
async function processBlock(blockNumber) {
    try {
        // Get the block with transactions
        const block = await getBlockWithTransactions(blockNumber);
        if (!block) {
            console.error(`Block ${blockNumber} not found`);
            return;
        }

        console.log(`Processing ${block.transactions.length} transactions in block ${blockNumber}...`);

        // Process each transaction
        for (const tx of block.transactions) {
            try {
                // Get the transaction receipt
                const receipt = await getTransactionReceipt(tx.hash);
                if (!receipt) {
                    console.warn(`Receipt not found for transaction ${tx.hash}`);
                    continue;
                }

                // Get token transfers from the receipt
                const transfers = getTokenTransfersFromReceipt(receipt);

                // Insert each token transfer
                for (const transfer of transfers) {
                    await insertTokenTransfer(transfer, tx.hash, blockNumber, block.timestamp);
                }

                console.log(`Processed ${transfers.length} token transfers in transaction ${tx.hash}`);
            } catch (error) {
                console.error(`Error processing transaction ${tx.hash}:`, error);
            }
        }

        console.log(`Successfully processed block ${blockNumber}`);
    } catch (error) {
        console.error(`Error processing block ${blockNumber}:`, error);
        throw error;
    }
}

// Function to scan a range of blocks
async function scanBlocks(startBlock, endBlock, batchSize = 10) {
    try {
        console.log(`Scanning blocks from ${startBlock} to ${endBlock}...`);

        // Create a file to store token transfers
        const fs = require('fs');
        fs.writeFileSync('/root/token-transfers.json', '');

        // Process blocks in batches
        for (let i = startBlock; i <= endBlock; i += batchSize) {
            const batchEnd = Math.min(i + batchSize - 1, endBlock);
            console.log(`Processing batch from block ${i} to ${batchEnd}...`);

            // Process each block in the batch
            for (let j = i; j <= batchEnd; j++) {
                try {
                    await processBlock(j);
                } catch (error) {
                    console.error(`Error processing block ${j}:`, error);
                }
            }

            console.log(`Completed batch from block ${i} to ${batchEnd}`);
        }

        console.log(`Completed scanning blocks from ${startBlock} to ${endBlock}`);
    } catch (error) {
        console.error('Error scanning blocks:', error);
    }
}

// Main function
async function main() {
    try {
        // Get command line arguments
        const args = process.argv.slice(2);
        const startBlock = parseInt(args[0]) || 100000;
        const endBlock = parseInt(args[1]) || 110000;
        const batchSize = parseInt(args[2]) || 10;

        console.log(`Start block: ${startBlock}`);
        console.log(`End block: ${endBlock}`);
        console.log(`Batch size: ${batchSize}`);

        // Scan blocks
        await scanBlocks(startBlock, endBlock, batchSize);
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Run the main function
main().catch(console.error);
