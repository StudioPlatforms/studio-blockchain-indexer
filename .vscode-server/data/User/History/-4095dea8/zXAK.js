const { ethers } = require('ethers');
const { blockchain } = require('./mainnet-indexer/src/services/blockchain');
const { db } = require('./mainnet-indexer/src/services/database');

async function testTokenTransfers() {
  try {
    // Get the transaction receipt for a known token transfer
    const txHash = '0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d';
    console.log(`Testing token transfers for transaction: ${txHash}`);
    
    const receipt = await blockchain.getTransactionReceipt(txHash);
    if (!receipt) {
      console.error('Receipt not found');
      return;
    }
    
    console.log('Receipt found:');
    console.log(JSON.stringify(receipt, null, 2));
    
    // Get token transfers from the receipt
    console.log('Detecting token transfers...');
    const transfers = await blockchain.getTokenTransfersFromReceipt(receipt);
    
    console.log(`Detected ${transfers.length} token transfers:`);
    console.log(JSON.stringify(transfers, null, 2));
    
    // If transfers were detected, try to insert them into the database
    if (transfers.length > 0) {
      console.log('Inserting token transfers into the database...');
      
      for (const transfer of transfers) {
        try {
          await db.insertTokenTransfer({
            transactionHash: txHash,
            blockNumber: receipt.blockNumber,
            tokenAddress: transfer.tokenAddress,
            fromAddress: transfer.from,
            toAddress: transfer.to,
            value: transfer.value,
            tokenType: transfer.tokenType,
            tokenId: transfer.tokenId,
            timestamp: Math.floor(Date.now() / 1000) // Use current timestamp for testing
          });
          
          console.log(`Successfully inserted token transfer: ${transfer.tokenAddress} from ${transfer.from} to ${transfer.to} with value ${transfer.value}`);
        } catch (error) {
          console.error(`Error inserting token transfer:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error testing token transfers:', error);
  } finally {
    // Close the database connection
    await db.close();
    process.exit(0);
  }
}

// Run the test
testTokenTransfers();
