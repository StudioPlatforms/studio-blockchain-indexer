#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000';
const TRANSACTION_HASH = '0x820d3fefdf20b6ea923fc5bfb6e40a14005132a13ddf9c7c1e17a6279ee5847d'; // USDT transfer transaction

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

async function getDecodedTransaction() {
  try {
    console.log(`Getting decoded transaction data for ${TRANSACTION_HASH}...`);
    
    const response = await axios.get(`${API_URL}/transactions/${TRANSACTION_HASH}/decoded`);
    
    console.log('Decoded transaction data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error getting decoded transaction data:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

async function getTokenTransfers() {
  try {
    console.log(`Getting token transfers for token address 0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E...`);
    
    const response = await axios.get(`${API_URL}/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=10`);
    
    console.log('Token transfers:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error getting token transfers:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

async function main() {
  try {
    // Get transaction details
    await getTransactionDetails();
    
    console.log('\n---\n');
    
    // Get transaction receipt
    await getTransactionReceipt();
    
    console.log('\n---\n');
    
    // Get decoded transaction data
    await getDecodedTransaction();
    
    console.log('\n---\n');
    
    // Get token transfers
    await getTokenTransfers();
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed.');
    process.exit(1);
  }
}

main();
