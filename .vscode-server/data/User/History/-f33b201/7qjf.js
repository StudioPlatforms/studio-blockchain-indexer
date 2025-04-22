#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000'; // Change to your API URL
const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890'; // Replace with actual contract address
const CONTRACT_NAME = 'UniswapV3Factory';
const COMPILER_VERSION = '0.7.6';
const OPTIMIZATION_USED = true;
const RUNS = 1000;
const EVM_VERSION = 'istanbul';

// Source files directory - where your contract source files are located
const SOURCE_DIR = './uniswap-v3-core'; // Change to your source directory

/**
 * Read all Solidity files from a directory recursively
 * @param {string} dir Directory to read
 * @param {string} baseDir Base directory for relative paths
 * @returns {Object} Object with file paths as keys and file contents as values
 */
function readSolidityFiles(dir, baseDir = dir) {
  const files = {};
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // Recursively read files from subdirectories
      const subFiles = readSolidityFiles(itemPath, baseDir);
      Object.assign(files, subFiles);
    } else if (item.endsWith('.sol')) {
      // Get relative path from base directory
      const relativePath = path.relative(baseDir, itemPath).replace(/\\/g, '/');
      files[relativePath] = fs.readFileSync(itemPath, 'utf8');
    }
  }
  
  return files;
}

/**
 * Verify a contract using multi-part verification
 */
async function verifyContract() {
  try {
    console.log('Reading source files...');
    const sourceFiles = readSolidityFiles(SOURCE_DIR);
    
    console.log(`Found ${Object.keys(sourceFiles).length} Solidity files`);
    
    console.log('Verifying contract...');
    const response = await axios.post(`${API_URL}/contracts/verify`, {
      address: CONTRACT_ADDRESS,
      compilerVersion: COMPILER_VERSION,
      contractName: CONTRACT_NAME,
      optimizationUsed: OPTIMIZATION_USED,
      runs: RUNS,
      evmVersion: EVM_VERSION,
      isMultiPart: true,
      sourceFiles
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

/**
 * Main function
 */
async function main() {
  try {
    // Verify the contract
    await verifyContract();
    
    console.log('Multi-part verification test completed successfully!');
  } catch (error) {
    console.error('Test failed.');
    process.exit(1);
  }
}

// Run the main function
main();
