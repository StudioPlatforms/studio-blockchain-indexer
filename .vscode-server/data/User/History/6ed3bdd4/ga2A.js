#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';
const SOURCE_FILE_PATH = path.join(__dirname, 'UniswapV3Factory.sol');
const COMPILER_VERSION = '0.7.6';
const CONTRACT_NAME = 'UniswapV3Factory';
const OPTIMIZATION_USED = true;
const RUNS = 800; // From the hardhat.config.ts file
const CONSTRUCTOR_ARGUMENTS = ''; // No constructor arguments
const EVM_VERSION = 'berlin'; // From the hardhat.config.ts file

async function verifyContract() {
    try {
        console.log(`Verifying contract ${CONTRACT_ADDRESS}...`);
        
        // Read the source code from the file
        const sourceCode = fs.readFileSync(SOURCE_FILE_PATH, 'utf8');
        
        // Verify the contract
        const response = await axios.post(`${API_URL}/contracts/verify`, {
            address: CONTRACT_ADDRESS,
            sourceCode: sourceCode,
            compilerVersion: COMPILER_VERSION,
            contractName: CONTRACT_NAME,
            optimizationUsed: OPTIMIZATION_USED,
            runs: RUNS,
            constructorArguments: CONSTRUCTOR_ARGUMENTS,
            evmVersion: EVM_VERSION
        });
        
        console.log('Verification result:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error verifying contract:');
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
        await verifyContract();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
