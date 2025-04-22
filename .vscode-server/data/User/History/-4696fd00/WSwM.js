#!/usr/bin/env node

/**
 * This script scans specific blocks for token transfers and logs only the results.
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
const transfersFile = '/root/token-transfers-specific.json';
fs.writeFileSync(transfersFile, '');

// Counter for token transfers found
let transfersFound = 0;
let blocksProcessed = 0;

// List of specific blocks to scan
const specificBlocks = [
    232709, 232643, 232564, 232556, 232554, 232529, 232493, 232484, 232481, 
    232474, 232435, 232410, 232354, 232352, 232327, 232323, 217101, 217098, 
    216632, 214842, 214771, 181270, 181268, 178978, 178844
];

// Function to get a block with transactions
async function getBlockWithTransactions(blockNumber) {
    try {
        console.log(`Getting block ${blockNumber}...`);
        const block = await provider.getBlockWithTransactions(blockNumber);
        return block;
    } catch (error) {
        console.error(`Error getting block ${blockNumber}:`, error);
        return null;
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
        return null;
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
        console.log(`Found token transfer in block ${blockNumber}: ${transfer.from} -> ${transfer.to}, ${transfer.value} tokens of ${transfer.tokenAddress}`);
        
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
            console.log(`Block ${blockNumber} not found`);
            return;
        }

        console.log(`Processing ${block.transactions.length} transactions in block ${blockNumber}...`);

        // Process each transaction
        for (const tx of block.transactions) {
            try {
                // Get the transaction receipt
                const receipt = await getTransactionReceipt(tx.hash);
                if (!receipt) {
                    console.log(`Receipt not found for transaction ${tx.hash}`);
                    continue;
                }

                // Get token transfers from the receipt
                const transfers = getTokenTransfersFromReceipt(receipt);

                // Save each token transfer
                for (const transfer of transfers) {
                    saveTokenTransfer(transfer, tx.hash, blockNumber, block.timestamp);
                }

                if (transfers.length > 0) {
                    console.log(`Processed ${transfers.length} token transfers in transaction ${tx.hash}`);
                }
            } catch (error) {
                console.error(`Error processing transaction ${tx.hash}:`, error);
            }
        }

        // Increment the counter
        blocksProcessed++;
        
        console.log(`Successfully processed block ${blockNumber}`);
    } catch (error) {
        console.error(`Error processing block ${blockNumber}:`, error);
    }
}

// Function to scan specific blocks
async function scanSpecificBlocks() {
    try {
        console.log(`Scanning ${specificBlocks.length} specific blocks...`);
        console.log(`Results will be saved to ${transfersFile}`);

        // Process each block
        for (const blockNumber of specificBlocks) {
            await processBlock(blockNumber);
        }

        console.log(`Completed scanning ${specificBlocks.length} blocks`);
        console.log(`Found ${transfersFound} token transfers in ${blocksProcessed} blocks`);
        console.log(`Results saved to ${transfersFile}`);
    } catch (error) {
        console.error('Error scanning blocks:', error);
    }
}

// Main function
async function main() {
    try {
        // Scan specific blocks
        await scanSpecificBlocks();
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Run the main function
main().catch(console.error);
