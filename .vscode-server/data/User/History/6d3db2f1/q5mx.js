#!/usr/bin/env node

const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';

async function getBytecode() {
    try {
        console.log(`Getting bytecode for contract ${CONTRACT_ADDRESS}...`);
        
        // Create a provider using the RPC URL
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        
        // Get the bytecode
        const bytecode = await provider.getCode(CONTRACT_ADDRESS);
        
        console.log(`Bytecode: ${bytecode}`);
        
        // Save the bytecode to a file
        fs.writeFileSync('bytecode.txt', bytecode);
        
        console.log('Bytecode saved to bytecode.txt');
        
        return bytecode;
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
