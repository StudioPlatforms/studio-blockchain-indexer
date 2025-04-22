#!/usr/bin/env node

const axios = require('axios');

// Configuration
const INDEXER_URL = process.env.INDEXER_URL || 'http://localhost:3000';
const WALLET_ADDRESS = '0x846C234adc6D8E74353c0c355b0c2B6a1e46634f';
const TOKEN_ADDRESS = '0xfb0ae661d04f463b43ae36f9fd2a7ce95538b5a1';

async function main() {
  try {
    console.log('Testing token balance fetch from indexer...');
    console.log(`Wallet: ${WALLET_ADDRESS}`);
    console.log(`Token: ${TOKEN_ADDRESS}`);
    
    // First, try to get the balance from the indexer API
    console.log('\nFetching from indexer API:');
    const indexerResponse = await axios.get(`${INDEXER_URL}/account/${WALLET_ADDRESS}/balances?force_blockchain=true`);
    
    // Find the specific token in the response
    const tokenData = indexerResponse.data.tokens.find(
      token => token.contractAddress.toLowerCase() === TOKEN_ADDRESS.toLowerCase()
    );
    
    if (tokenData) {
      console.log('✅ Token found in indexer response');
      console.log(`Balance: ${tokenData.balance} (${tokenData.rawBalance} wei)`);
      console.log(`Token Name: ${tokenData.name}`);
      console.log(`Token Symbol: ${tokenData.symbol}`);
    } else {
      console.log('❌ Token not found in indexer response');
      console.log('Available tokens:', indexerResponse.data.tokens.map(t => t.contractAddress));
    }
    
    // Now, try to get the balance directly from the blockchain for comparison
    console.log('\nFetching directly from blockchain (for verification):');
    const directResponse = await axios.post(`${INDEXER_URL}/blockchain/call-contract`, {
      contractAddress: TOKEN_ADDRESS,
      method: 'balanceOf(address)',
      params: [WALLET_ADDRESS]
    });
    
    if (directResponse.data && directResponse.data.result) {
      console.log('✅ Direct blockchain call successful');
      console.log(`Raw Balance: ${directResponse.data.result}`);
    } else {
      console.log('❌ Direct blockchain call failed');
      console.log('Response:', directResponse.data);
    }
    
  } catch (error) {
    console.error('Error testing token balance:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

main().catch(console.error);
