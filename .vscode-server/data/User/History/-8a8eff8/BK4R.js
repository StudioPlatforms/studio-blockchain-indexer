#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E'; // USDT contract address

async function checkContractVerification() {
    try {
        console.log(`Checking if contract ${CONTRACT_ADDRESS} is verified...`);
        
        const response = await axios.get(`${API_URL}/contracts/${CONTRACT_ADDRESS}/verified`);
        
        console.log('Verification status:', response.data);
        
        return response.data.verified;
    } catch (error) {
        console.error('Error checking contract verification status:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

async function getContractVerificationDetails() {
    try {
        console.log(`Getting verification details for contract ${CONTRACT_ADDRESS}...`);
        
        const response = await axios.get(`${API_URL}/contracts/${CONTRACT_ADDRESS}/verification`);
        
        console.log('Verification details:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Verify that the response includes owner and creator addresses
        if (!response.data.ownerAddress) {
            console.error('Error: Owner address is missing from the response');
            throw new Error('Owner address is missing from the response');
        }
        
        if (!response.data.creatorAddress) {
            console.error('Error: Creator address is missing from the response');
            throw new Error('Creator address is missing from the response');
        }
        
        console.log(`Owner address: ${response.data.ownerAddress}`);
        console.log(`Creator address: ${response.data.creatorAddress}`);
        
        return response.data;
    } catch (error) {
        console.error('Error getting contract verification details:');
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
        // Check if the contract is verified
        const isVerified = await checkContractVerification();
        
        if (!isVerified) {
            console.error('Contract is not verified. Please verify it first using verify-contract.js');
            process.exit(1);
        }
        
        // Get the verification details
        await getContractVerificationDetails();
        
        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Test failed.');
        process.exit(1);
    }
}

main();
