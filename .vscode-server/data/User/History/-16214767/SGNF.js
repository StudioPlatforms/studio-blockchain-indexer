#!/usr/bin/env node

/**
 * This script scans past blocks for token transfers and logs only the results.
 * It uses the blockchain service to get blocks and transactions, extracts token transfers
 * from transaction receipts, and saves them to a file.
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
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

// Create a file to store token transfers
const transfersFile = '/root/token-transfers.json';
fs.writeFileSync(transfersFile, '');

// Counter for token transfers found
let transfersFound = 0;
let blocksProcessed = 0;

// Function to get a block with transactions
async function getBlockWithTransactions(blockNumber) {
    try {
        return await provider.getBlockWithTransactions(blockNumber);
    } catch (error) {
        console.error(`Error getting block ${blockNumber}:`, error);
        throw error;
    }
}

// Function to get a transaction receipt
async function getTransactionReceipt(txHash) {
    try {
        return await provider.getTransactionReceipt(txHash);
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
                    // Silently ignore errors in transfer extraction
                }
            }
        }
    } catch (error) {
        // Silently ignore errors in receipt processing
    }

    return transfers;
}

// Function to save a token transfer
function saveTokenTransfer(transfer, txHash, blockNumber, timestamp) {
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

        // Log the token transfer details
        console.log(`Found token transfer: ${transfer.from} -> ${transfer.to}, ${transfer.value} tokens of ${transfer.tokenAddress}`);
        
        // Save to a local file
        fs.appendFileSync(transfersFile, JSON.stringify(tokenTransfer) + '\n');
        
        // Increment the counter
        transfersFound++;
        
        return true;
    } catch (error) {
        return false;
    }
}

// Function to process a block
async function processBlock(blockNumber) {
    try {
        // Get the block with transactions
        const block = await getBlockWithTransactions(blockNumber);
        if (!block) {
            return;
        }

        // Process each transaction
        for (const tx of block.transactions) {
            try {
                // Get the transaction receipt
                const receipt = await getTransactionReceipt(tx.hash);
                if (!receipt) {
                    continue;
                }

                // Get token transfers from the receipt
                const transfers = getTokenTransfersFromReceipt(receipt);

                // Save each token transfer
                for (const transfer of transfers) {
                    saveTokenTransfer(transfer, tx.hash, blockNumber, block.timestamp);
                }
            } catch (error) {
                // Silently ignore errors in transaction processing
            }
        }

        // Increment the counter
        blocksProcessed++;
        
        // Log progress every 100 blocks
        if (blocksProcessed % 100 === 0) {
            console.log(`Processed ${blocksProcessed} blocks, found ${transfersFound} token transfers so far`);
        }
    } catch (error) {
        // Silently ignore errors in block processing
    }
}

// Function to scan a range of blocks
async function scanBlocks(startBlock, endBlock, batchSize = 10) {
    try {
        console.log(`Scanning blocks from ${startBlock} to ${endBlock}...`);
        console.log(`Results will be saved to ${transfersFile}`);

        // Process blocks in batches
        for (let i = startBlock; i <= endBlock; i += batchSize) {
            const batchEnd = Math.min(i + batchSize - 1, endBlock);

            // Process each block in the batch
            const promises = [];
            for (let j = i; j <= batchEnd; j++) {
                promises.push(processBlock(j));
            }
            
            // Wait for all blocks in the batch to be processed
            await Promise.all(promises);
        }

        console.log(`Completed scanning blocks from ${startBlock} to ${endBlock}`);
        console.log(`Found ${transfersFound} token transfers in ${blocksProcessed} blocks`);
        console.log(`Results saved to ${transfersFile}`);
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
        const endBlock = parseInt(args[1]) || 200000;
        const batchSize = parseInt(args[2]) || 50;

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
