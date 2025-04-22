#!/usr/bin/env node

// A script to estimate the total number of transactions in the blockchain
// by sampling blocks and calculating the average transactions per block

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const BASE_URL = 'https://mainnetindexer.studio-blockchain.com';

async function getLatestBlockNumber() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    return data.lastBlock;
  } catch (error) {
    console.error('Error fetching latest block number:', error);
    throw error;
  }
}

async function getBlockWithTransactions(blockNumber) {
  try {
    const response = await fetch(`${BASE_URL}/blocks/${blockNumber}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching block ${blockNumber}:`, error);
    throw error;
  }
}

async function getTransactionCount(blockNumber) {
  try {
    const block = await getBlockWithTransactions(blockNumber);
    return block.transactions ? block.transactions.length : 0;
  } catch (error) {
    console.error(`Error getting transaction count for block ${blockNumber}:`, error);
    return 0; // Return 0 if there's an error
  }
}

async function estimateTotalTransactions(sampleSize = 10) {
  try {
    // Get the latest block number
    const latestBlock = await getLatestBlockNumber();
    console.log(`Latest block: ${latestBlock}`);
    
    // Sample blocks to calculate average transactions per block
    let totalTransactions = 0;
    const sampleBlocks = [];
    
    // Generate sample block numbers (evenly distributed)
    for (let i = 0; i < sampleSize; i++) {
      // Skip the first few blocks as they might be empty
      const blockNumber = Math.max(10, Math.floor((latestBlock * (i + 1)) / (sampleSize + 1)));
      sampleBlocks.push(blockNumber);
    }
    
    console.log(`Sampling blocks: ${sampleBlocks.join(', ')}`);
    
    // Get transaction counts for sample blocks
    for (const blockNumber of sampleBlocks) {
      const txCount = await getTransactionCount(blockNumber);
      console.log(`Block ${blockNumber}: ${txCount} transactions`);
      totalTransactions += txCount;
    }
    
    // Calculate average transactions per block
    const avgTxPerBlock = totalTransactions / sampleBlocks.length;
    console.log(`Average transactions per block: ${avgTxPerBlock.toFixed(2)}`);
    
    // Estimate total transactions
    const estimatedTotal = Math.round(avgTxPerBlock * latestBlock);
    console.log(`Estimated total transactions: ${estimatedTotal}`);
    
    return estimatedTotal;
  } catch (error) {
    console.error('Error estimating total transactions:', error);
    throw error;
  }
}

// Alternative method: Try to get the total directly from the database
// This will only work if the indexer exposes this endpoint
async function getTotalTransactionsDirectly() {
  try {
    // Note: This endpoint doesn't exist in the current API
    // This is just an example of how it might work if implemented
    const response = await fetch(`${BASE_URL}/stats/transactions/count`);
    const data = await response.json();
    
    if (data.count !== undefined) {
      console.log(`Total transactions (direct): ${data.count}`);
      return data.count;
    } else {
      console.log('Direct count endpoint not available');
      return null;
    }
  } catch (error) {
    console.log('Direct count endpoint not available');
    return null;
  }
}

// Method 2: Count transactions in the latest blocks and extrapolate
async function countRecentTransactions(blockCount = 100) {
  try {
    const latestBlock = await getLatestBlockNumber();
    console.log(`Latest block: ${latestBlock}`);
    
    let totalTx = 0;
    let blocksWithTx = 0;
    
    // Get transactions from the most recent blocks
    for (let i = 0; i < blockCount; i++) {
      const blockNumber = latestBlock - i;
      if (blockNumber <= 0) break;
      
      const txCount = await getTransactionCount(blockNumber);
      if (txCount > 0) {
        blocksWithTx++;
        totalTx += txCount;
      }
      
      // Log progress every 10 blocks
      if (i % 10 === 0) {
        console.log(`Processed ${i + 1}/${blockCount} blocks, found ${totalTx} transactions so far`);
      }
    }
    
    const avgTxPerBlock = blocksWithTx > 0 ? totalTx / blocksWithTx : 0;
    console.log(`\nAnalyzed ${blockCount} recent blocks`);
    console.log(`Found ${totalTx} transactions in ${blocksWithTx} blocks with transactions`);
    console.log(`Average transactions per block with transactions: ${avgTxPerBlock.toFixed(2)}`);
    
    // Estimate total based on percentage of blocks with transactions
    const blockWithTxPercentage = blocksWithTx / blockCount;
    const estimatedBlocksWithTx = Math.round(latestBlock * blockWithTxPercentage);
    const estimatedTotal = Math.round(avgTxPerBlock * estimatedBlocksWithTx);
    
    console.log(`\nEstimated blocks with transactions: ${estimatedBlocksWithTx} (${(blockWithTxPercentage * 100).toFixed(2)}% of all blocks)`);
    console.log(`Estimated total transactions: ${estimatedTotal}`);
    
    return estimatedTotal;
  } catch (error) {
    console.error('Error counting recent transactions:', error);
    throw error;
  }
}

// Method 3: Get transactions directly from the API
async function getLatestTransactions(limit = 1) {
  try {
    const response = await fetch(`${BASE_URL}/transactions?limit=${limit}`);
    const transactions = await response.json();
    
    console.log(`\nLatest ${transactions.length} transactions:`);
    transactions.forEach(tx => {
      const valueInWei = BigInt(tx.value.hex);
      const valueInEther = Number(valueInWei) / 1e18;
      
      console.log(`Transaction: ${tx.hash}`);
      console.log(`  Block: ${tx.blockNumber}`);
      console.log(`  From: ${tx.from}`);
      console.log(`  To: ${tx.to || '(Contract Creation)'}`);
      console.log(`  Value: ${valueInEther} ETH`);
      console.log(`  Timestamp: ${new Date(tx.timestamp * 1000).toISOString()}`);
      console.log('');
    });
    
    return transactions;
  } catch (error) {
    console.error('Error getting latest transactions:', error);
    throw error;
  }
}

// Run the script
async function main() {
  console.log('Fetching total transactions from Studio Blockchain Indexer...\n');
  
  // Try to get the total directly (if the endpoint exists)
  const directTotal = await getTotalTransactionsDirectly();
  
  if (directTotal === null) {
    // If direct method fails, use estimation methods
    console.log('\n=== METHOD 1: Random Sampling ===');
    await estimateTotalTransactions(20);
    
    console.log('\n=== METHOD 2: Recent Block Analysis ===');
    await countRecentTransactions(50);
  }
  
  // Get some sample transactions
  console.log('\n=== SAMPLE TRANSACTIONS ===');
  await getLatestTransactions(3);
  
  console.log('\nDone!');
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
