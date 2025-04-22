#!/usr/bin/env node

// A script to fetch all transactions from the Studio Blockchain Indexer
// and provide detailed information about each transaction

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const BASE_URL = 'https://mainnetindexer.studio-blockchain.com';

// Function to format ETH values from Wei
function formatEth(weiHex) {
  try {
    const valueInWei = BigInt(weiHex);
    const valueInEther = Number(valueInWei) / 1e18;
    return `${valueInEther} ETH`;
  } catch (error) {
    return 'Unknown ETH value';
  }
}

// Function to format gas values from Wei
function formatGas(weiHex) {
  try {
    const valueInWei = BigInt(weiHex);
    const valueInGwei = Number(valueInWei) / 1e9;
    return `${valueInGwei} Gwei`;
  } catch (error) {
    return 'Unknown gas value';
  }
}

// Function to format timestamp
function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp * 1000);
    return date.toISOString();
  } catch (error) {
    return 'Unknown date';
  }
}

// Get all transactions with pagination
async function getAllTransactions() {
  try {
    console.log('Fetching all transactions from the blockchain...');
    
    let allTransactions = [];
    let offset = 0;
    const limit = 100; // Fetch 100 transactions at a time
    let hasMore = true;
    
    while (hasMore) {
      console.log(`Fetching transactions ${offset} to ${offset + limit}...`);
      const response = await fetch(`${BASE_URL}/transactions?limit=${limit}&offset=${offset}`);
      const transactions = await response.json();
      
      if (transactions.length === 0) {
        hasMore = false;
      } else {
        allTransactions = allTransactions.concat(transactions);
        offset += limit;
      }
    }
    
    console.log(`\nFound a total of ${allTransactions.length} transactions`);
    return allTransactions;
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    throw error;
  }
}

// Get detailed information about a transaction
async function getTransactionDetails(txHash) {
  try {
    console.log(`Fetching details for transaction ${txHash}...`);
    
    // Get transaction data
    const txResponse = await fetch(`${BASE_URL}/transactions/${txHash}`);
    const tx = await txResponse.json();
    
    // Get transaction receipt
    let receipt = null;
    try {
      const receiptResponse = await fetch(`${BASE_URL}/transactions/${txHash}/receipt`);
      receipt = await receiptResponse.json();
    } catch (error) {
      console.log(`Could not fetch receipt for ${txHash}: ${error.message}`);
    }
    
    return { tx, receipt };
  } catch (error) {
    console.error(`Error fetching details for transaction ${txHash}:`, error);
    return { tx: null, receipt: null };
  }
}

// Print transaction summary
function printTransactionSummary(tx) {
  console.log(`\nTransaction: ${tx.hash}`);
  console.log(`Block: ${tx.blockNumber}`);
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to || '(Contract Creation)'}`);
  console.log(`Value: ${formatEth(tx.value.hex)}`);
  console.log(`Gas Price: ${formatGas(tx.gasPrice.hex)}`);
  console.log(`Gas Limit: ${BigInt(tx.gasLimit.hex).toString()}`);
  console.log(`Nonce: ${tx.nonce}`);
  console.log(`Status: ${tx.status ? 'Success' : 'Failed'}`);
  console.log(`Timestamp: ${formatTimestamp(tx.timestamp)}`);
  
  if (tx.data && tx.data !== '0x') {
    console.log(`Data: ${tx.data.length > 66 ? tx.data.substring(0, 66) + '...' : tx.data}`);
  }
}

// Print detailed transaction information
function printTransactionDetails(tx, receipt) {
  console.log('\n=== TRANSACTION DETAILS ===');
  printTransactionSummary(tx);
  
  if (receipt) {
    console.log('\n--- Receipt Information ---');
    console.log(`Gas Used: ${BigInt(receipt.gasUsed).toString()}`);
    console.log(`Cumulative Gas Used: ${BigInt(receipt.cumulativeGasUsed).toString()}`);
    console.log(`Effective Gas Price: ${formatGas(receipt.effectiveGasPrice)}`);
    
    if (receipt.contractAddress) {
      console.log(`Contract Created: ${receipt.contractAddress}`);
    }
    
    if (receipt.logs && receipt.logs.length > 0) {
      console.log(`\nEvent Logs (${receipt.logs.length}):`);
      receipt.logs.forEach((log, index) => {
        console.log(`\nLog #${index + 1}:`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Topics: ${log.topics.join(', ')}`);
        console.log(`  Data: ${log.data.length > 66 ? log.data.substring(0, 66) + '...' : log.data}`);
      });
    }
  }
}

// Get transactions by address
async function getTransactionsByAddress(address) {
  try {
    console.log(`\nFetching transactions for address ${address}...`);
    
    const response = await fetch(`${BASE_URL}/address/${address}/transactions?limit=100`);
    const transactions = await response.json();
    
    console.log(`Found ${transactions.length} transactions for address ${address}`);
    return transactions;
  } catch (error) {
    console.error(`Error fetching transactions for address ${address}:`, error);
    return [];
  }
}

// Get token transfers by address
async function getTokenTransfersByAddress(address) {
  try {
    console.log(`\nFetching token transfers for address ${address}...`);
    
    const response = await fetch(`${BASE_URL}/address/${address}/tokens?limit=100`);
    const transfers = await response.json();
    
    console.log(`Found ${transfers.length} token transfers for address ${address}`);
    return transfers;
  } catch (error) {
    console.error(`Error fetching token transfers for address ${address}:`, error);
    return [];
  }
}

// Print token transfer information
function printTokenTransfer(transfer) {
  console.log(`\nToken Transfer in Transaction: ${transfer.transactionHash}`);
  console.log(`Block: ${transfer.blockNumber}`);
  console.log(`Token: ${transfer.tokenAddress}`);
  console.log(`From: ${transfer.fromAddress}`);
  console.log(`To: ${transfer.toAddress}`);
  console.log(`Value: ${transfer.value}`);
  console.log(`Token Type: ${transfer.tokenType}`);
  
  if (transfer.tokenId) {
    console.log(`Token ID: ${transfer.tokenId}`);
  }
  
  console.log(`Timestamp: ${formatTimestamp(transfer.timestamp)}`);
}

// Main function
async function main() {
  console.log('Studio Blockchain Transaction Explorer\n');
  
  try {
    // Get all transactions
    const transactions = await getAllTransactions();
    
    if (transactions.length === 0) {
      console.log('No transactions found in the blockchain.');
      return;
    }
    
    // Print summary of all transactions
    console.log('\n=== TRANSACTION SUMMARY ===');
    transactions.forEach((tx, index) => {
      console.log(`\n[${index + 1}/${transactions.length}] Transaction: ${tx.hash}`);
      console.log(`Block: ${tx.blockNumber}`);
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to || '(Contract Creation)'}`);
      console.log(`Value: ${formatEth(tx.value.hex)}`);
      console.log(`Timestamp: ${formatTimestamp(tx.timestamp)}`);
    });
    
    // Get unique addresses involved in transactions
    const addresses = new Set();
    transactions.forEach(tx => {
      addresses.add(tx.from.toLowerCase());
      if (tx.to) {
        addresses.add(tx.to.toLowerCase());
      }
    });
    
    console.log(`\n=== ADDRESSES INVOLVED (${addresses.size}) ===`);
    Array.from(addresses).forEach(address => {
      console.log(address);
    });
    
    // Get detailed information for each transaction
    console.log('\n=== DETAILED TRANSACTION INFORMATION ===');
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      console.log(`\n[${i + 1}/${transactions.length}] Fetching details for ${tx.hash}...`);
      
      const { tx: txDetails, receipt } = await getTransactionDetails(tx.hash);
      if (txDetails) {
        printTransactionDetails(txDetails, receipt);
      }
    }
    
    // Get token transfers for each address
    console.log('\n=== TOKEN TRANSFERS BY ADDRESS ===');
    for (const address of addresses) {
      const transfers = await getTokenTransfersByAddress(address);
      
      if (transfers.length > 0) {
        console.log(`\nToken transfers for ${address}:`);
        transfers.forEach(transfer => {
          printTokenTransfer(transfer);
        });
      }
    }
    
    console.log('\nTransaction analysis complete!');
    console.log(`Total Transactions: ${transactions.length}`);
    console.log(`Total Addresses: ${addresses.size}`);
    
    // Calculate total value transferred
    let totalValueWei = BigInt(0);
    transactions.forEach(tx => {
      try {
        totalValueWei += BigInt(tx.value.hex);
      } catch (error) {
        // Skip if we can't parse the value
      }
    });
    const totalValueEth = Number(totalValueWei) / 1e18;
    
    console.log(`Total Value Transferred: ${totalValueEth} ETH`);
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

// Run the script
main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
