#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890'; // Replace with a real contract address
const SOURCE_CODE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;
    
    event ValueChanged(uint256 newValue);
    
    constructor(uint256 initialValue) {
        value = initialValue;
    }
    
    function setValue(uint256 newValue) public {
        value = newValue;
        emit ValueChanged(newValue);
    }
    
    function getValue() public view returns (uint256) {
        return value;
    }
}
`;
const COMPILER_VERSION = '0.8.0';
const CONTRACT_NAME = 'SimpleStorage';
const OPTIMIZATION_USED = true;
const RUNS = 200;
const CONSTRUCTOR_ARGUMENTS = '0x0000000000000000000000000000000000000000000000000000000000000064'; // Hex encoded uint256(100)
const EVM_VERSION = 'cancun';

async function verifyContract() {
    try {
        console.log('Verifying contract...');
        
        const response = await axios.post(`${API_URL}/contracts/verify`, {
            address: CONTRACT_ADDRESS,
            sourceCode: SOURCE_CODE,
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

async function getContractABI() {
    try {
        console.log('Getting contract ABI...');
        
        const response = await axios.get(`${API_URL}/contracts/${CONTRACT_ADDRESS}/abi`);
        
        console.log('Contract ABI:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error getting contract ABI:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

async function getContractSource() {
    try {
        console.log('Getting contract source code...');
        
        const response = await axios.get(`${API_URL}/contracts/${CONTRACT_ADDRESS}/source`);
        
        console.log('Contract source code:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error getting contract source code:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

async function interactWithContract() {
    try {
        console.log('Interacting with contract...');
        
        const response = await axios.post(`${API_URL}/contracts/${CONTRACT_ADDRESS}/interact`, {
            method: 'getValue',
            params: []
        });
        
        console.log('Interaction result:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error interacting with contract:');
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
        // Verify the contract
        await verifyContract();
        
        // Get the contract ABI
        await getContractABI();
        
        // Get the contract source code
        await getContractSource();
        
        // Interact with the contract
        await interactWithContract();
        
        console.log('All tests completed successfully!');
    } catch (error) {
        console.error('Test failed.');
        process.exit(1);
    }
}

main();
