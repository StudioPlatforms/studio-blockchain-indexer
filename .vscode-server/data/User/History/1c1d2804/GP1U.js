#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';

async function getBytecode() {
    try {
        console.log(`Getting bytecode for contract ${CONTRACT_ADDRESS}...`);
        
        // Use the API to get the bytecode
        const response = await axios.get(`${API_URL}/contracts/${CONTRACT_ADDRESS}/bytecode`);
        
        if (response.data && response.data.bytecode) {
            const bytecode = response.data.bytecode;
            console.log(`Bytecode: ${bytecode}`);
            
            // Save the bytecode to a file
            fs.writeFileSync('bytecode.txt', bytecode);
            
            console.log('Bytecode saved to bytecode.txt');
            
            return bytecode;
        } else {
            console.error('Error: Bytecode not found in response');
            throw new Error('Bytecode not found in response');
        }
    } catch (error) {
        console.error('Error getting bytecode:', error);
        throw error;
    }
}

async function main() {
    try {
        await getBytecode();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
