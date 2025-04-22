#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000';
const TRANSACTION_HASH = '0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46'; // Example transaction hash

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

async function getDecodedTransaction() {
    try {
        console.log(`Getting decoded transaction data for ${TRANSACTION_HASH}...`);
        
        const response = await axios.get(`${API_URL}/transactions/${TRANSACTION_HASH}/decoded`);
        
        console.log('Decoded transaction data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.decoded) {
            console.log(`\nFunction: ${response.data.decoded.functionName}`);
            console.log(`Signature: ${response.data.decoded.functionSignature}`);
            console.log('Parameters:');
            response.data.decoded.params.forEach(param => {
                console.log(`  ${param.name} (${param.type}): ${param.value}`);
            });
            console.log(`\nDescription: ${response.data.description}`);
            
            if (response.data.cost) {
                console.log('\nTransaction Cost:');
                console.log(`  Value: ${response.data.cost.valueFormatted}`);
                console.log(`  Gas Price: ${response.data.cost.gasPrice} wei`);
                console.log(`  Gas Limit: ${response.data.cost.gasLimit}`);
                console.log(`  Gas Used: ${response.data.cost.gasUsed}`);
                console.log(`  Transaction Fee: ${response.data.cost.transactionFeeFormatted}`);
            }
        } else {
            console.log(`\nCould not decode transaction: ${response.data.description}`);
        }
        
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

async function main() {
    try {
        // Get transaction details
        await getTransactionDetails();
        
        console.log('\n---\n');
        
        // Get decoded transaction data
        await getDecodedTransaction();
        
        console.log('\nTest completed successfully!');
    } catch (error) {
        console.error('Test failed.');
        process.exit(1);
    }
}

main();
