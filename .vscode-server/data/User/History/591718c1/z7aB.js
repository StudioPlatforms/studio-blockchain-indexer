const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:3000'; // Adjust if your API is running on a different port

// Test address and token address
const TEST_ADDRESS = '0x846c234adc6d8e74353c0c355b0c2b6a1e46634f';
const TEST_TOKEN_ADDRESS = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E';

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', data = null) {
    try {
        const url = `${BASE_URL}${endpoint}`;
        console.log(`Making ${method} request to ${url}`);
        
        const response = method === 'GET' 
            ? await axios.get(url)
            : await axios.post(url, data);
        
        return response.data;
    } catch (error) {
        console.error(`Error making request to ${endpoint}:`, error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        return null;
    }
}

// Test functions for each endpoint
async function testAccountBalances() {
    console.log('\n=== Testing /account/:address/balances ===');
