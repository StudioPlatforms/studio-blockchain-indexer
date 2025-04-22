#!/usr/bin/env node

/**
 * This script scans past blocks for token transfers and inserts them into the database.
 * It uses the blockchain service to get blocks and transactions, extracts token transfers
 * from transaction receipts, and inserts them into the database.
 */

const { ethers } = require('ethers');
const { Pool } = require('pg');

// Configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'studio_indexer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
};

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

// Create a database connection pool
const pool = new Pool(DB_CONFIG);

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

// Function to insert a token transfer into the database
async function insertTokenTransfer(client, transfer, txHash, blockNumber, timestamp) {
    try {
        await client.query(
            `INSERT INTO token_transfers (
                transaction_hash, block_number, token_address, from_address, to_address,
                value, token_type, token_id, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))
            DO UPDATE SET
                value = EXCLUDED.value,
                token_type = EXCLUDED.token_type,
                timestamp = EXCLUDED.timestamp`,
            [
                txHash,
                blockNumber,
                transfer.tokenAddress.toLowerCase(),
                transfer.from.toLowerCase(),
                transfer.to.toLowerCase(),
                transfer.value,
                transfer.tokenType,
                transfer.tokenId || null,
                new Date(timestamp * 1000),
            ]
        );

        console.log(`Inserted token transfer: ${transfer.from} -> ${transfer.to}, ${transfer.value} tokens of ${transfer.tokenAddress}`);
    } catch (error) {
        console.error(`Error inserting token transfer:`, error);
        throw error;
    }
}

// Function to process a block
async function processBlock(blockNumber) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

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

                // Insert each token transfer into the database
                for (const transfer of transfers) {
                    await insertTokenTransfer(client, transfer, tx.hash, blockNumber, block.timestamp);
                }

                console.log(`Processed ${transfers.length} token transfers in transaction ${tx.hash}`);
            } catch (error) {
                console.error(`Error processing transaction ${tx.hash}:`, error);
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully processed block ${blockNumber}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error processing block ${blockNumber}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

// Function to scan a range of blocks
async function scanBlocks(startBlock, endBlock, batchSize = 10) {
    try {
        console.log(`Scanning blocks from ${startBlock} to ${endBlock}...`);

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
    } finally {
        // Close the database connection pool
        await pool.end();
    }
}

// Main function
async function main() {
    try {
        // Get command line arguments
        const args = process.argv.slice(2);
        const startBlock = parseInt(args[0]) || 0;
        const endBlock = parseInt(args[1]) || await provider.getBlockNumber();
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
