/**
 * Uniswap V3 Contract Verification Script with Import Support
 * 
 * This script verifies Uniswap V3 contracts on Studio blockchain by:
 * 1. Creating import mappings for all required dependencies
 * 2. Submitting verification requests with these import mappings
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API URL for verification
const API_URL = 'https://mainnetindexer.studio-blockchain.com/contracts/verify';

// Contract addresses and verification details from README.md
const contracts = {
  "UniswapV3Factory": {
    address: '0x6f1aF63eb91723a883c632E38D34f2cB6090b805',
    contractName: 'UniswapV3Factory',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 800,
    constructorArgs: '',
    sourcePath: '/root/archive-for-verification/UniswapV3Factory.sol',
    flattenedPath: '/root/archive-for-verification/UniswapV3Factory_flattened.sol'
  },
  "NFTDescriptor": {
    address: '0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6',
    contractName: 'NFTDescriptor',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 1000,
    constructorArgs: '',
    sourcePath: '/root/archive-for-verification/NFTDescriptor.sol',
    flattenedPath: '/root/archive-for-verification/NFTDescriptor_flattened.sol'
  },
  "NonfungibleTokenPositionDescriptor": {
    address: '0x68550Fc74cf81066ef7b8D991Ce76C8cf685F346',
    contractName: 'NonfungibleTokenPositionDescriptor',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 1000,
    constructorArgs: '0000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db053544f0000000000000000000000000000000000000000000000000000000000',
    sourcePath: '/root/archive-for-verification/NonfungibleTokenPositionDescriptor.sol',
    flattenedPath: '/root/archive-for-verification/NonfungibleTokenPositionDescriptor_flattened.sol'
  },
  "SwapRouter": {
    address: '0x5D16d5b06bB052A91D74099A70D4048143a56406',
    contractName: 'SwapRouter',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 1000000,
    constructorArgs: '0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db0',
    sourcePath: '/root/archive-for-verification/SwapRouter.sol',
    flattenedPath: '/root/archive-for-verification/SwapRouter_flattened.sol'
  },
  "NonfungiblePositionManager": {
    address: '0x402306D1864657168B7614E459C7f3d5be0677eA',
    contractName: 'NonfungiblePositionManager',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 2000,
    constructorArgs: '0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db000000000000000000000000068550fc74cf81066ef7b8d991ce76c8cf685f346',
    sourcePath: '/root/archive-for-verification/NonfungiblePositionManager.sol',
    flattenedPath: '/root/archive-for-verification/NonfungiblePositionManager_flattened.sol'
  },
  "WETH9": {
    address: '0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0',
    contractName: 'WETH9',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 200,
    constructorArgs: '',
    sourcePath: '/root/archive-for-verification/WETH9.sol',
    flattenedPath: '/root/archive-for-verification/WETH9_flattened.sol'
  }
};

// Create a directory for import files
const IMPORTS_DIR = '/root/uniswap-imports';
if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

/**
 * Create import mappings for Uniswap V3 contracts
 * This is a simplified version that would need to be expanded with actual imports
 */
function createImportMappings() {
  // For a real implementation, we would need to:
  // 1. Clone the Uniswap V3 repositories
  // 2. Extract all the necessary import files
  // 3. Create mappings from import paths to file contents
  
  // For now, we'll return a placeholder
  return {
    // Core imports
    '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol': 
      fs.readFileSync('/root/archive-for-verification/UniswapV3Factory_flattened.sol', 'utf8'),
    
    // Periphery imports would be added here
    // ...
  };
}

/**
 * Verify a contract using the Studio blockchain verification API with import support
 */
async function verifyContract(contractName) {
  console.log(`\n=== Verifying ${contractName} ===`);
  
  const contract = contracts[contractName];
  
  // Read the source code
  let sourceCode;
  if (fs.existsSync(contract.flattenedPath) && fs.statSync(contract.flattenedPath).size > 100) {
    console.log(`Using flattened file for ${contractName}`);
    sourceCode = fs.readFileSync(contract.flattenedPath, 'utf8');
  } else {
    console.log(`Using original file for ${contractName}`);
    sourceCode = fs.readFileSync(contract.sourcePath, 'utf8');
  }
  
  console.log(`Source code length: ${sourceCode.length} characters`);
  
  // Create import mappings
  const importMappings = createImportMappings();
  console.log(`Created ${Object.keys(importMappings).length} import mappings`);
  
  // Create verification request
  const verificationData = {
    address: contract.address,
    sourceCode: sourceCode,
    compilerVersion: contract.compilerVersion,
    contractName: contract.contractName,
    optimizationUsed: contract.optimizationUsed,
    runs: contract.runs,
    evmVersion: contract.evmVersion,
    constructorArguments: contract.constructorArgs,
    importMappings: importMappings
  };
  
  try {
    // Send the request
    console.log(`Sending verification request to ${API_URL}...`);
    const response = await axios.post(API_URL, verificationData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    
    if (response.data.success) {
      console.log(`✅ ${contractName} verified successfully!`);
      return true;
    } else {
      const errorMsg = response.data.error || 'Unknown error';
      console.log(`❌ Error verifying ${contractName}: ${errorMsg}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error verifying ${contractName}: ${error.message}`);
    
    if (error.response) {
      console.log(`Response status: ${error.response.status}`);
      if (error.response.data) {
        console.log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    
    return false;
  }
}

/**
 * Main function to verify all contracts
 */
async function main() {
  console.log("Starting Uniswap V3 contract verification on Studio blockchain with import support...");
  
  // Verify contracts in dependency order
  const results = {};
  
  // First verify WETH9 as it's a dependency for other contracts
  results["WETH9"] = await verifyContract("WETH9");
  
  // Then verify UniswapV3Factory
  results["UniswapV3Factory"] = await verifyContract("UniswapV3Factory");
  
  // Then verify NFTDescriptor
  results["NFTDescriptor"] = await verifyContract("NFTDescriptor");
  
  // Then verify NonfungibleTokenPositionDescriptor
  results["NonfungibleTokenPositionDescriptor"] = await verifyContract("NonfungibleTokenPositionDescriptor");
  
  // Then verify SwapRouter
  results["SwapRouter"] = await verifyContract("SwapRouter");
  
  // Finally verify NonfungiblePositionManager
  results["NonfungiblePositionManager"] = await verifyContract("NonfungiblePositionManager");
  
  // Print summary
  console.log("\n=== Verification Summary ===");
  for (const [contractName, success] of Object.entries(results)) {
    console.log(`${contractName}: ${success ? '✅ Verified' : '❌ Failed'}`);
  }
  
  console.log("\nVerification process completed!");
}

// Run the main function
main().catch(error => {
  console.log(`Fatal error: ${error.message}`);
});
