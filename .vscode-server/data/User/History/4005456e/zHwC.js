/**
 * Uniswap V3 Contract Verification Script for Studio Blockchain
 * 
 * This script verifies Uniswap V3 contracts on Studio blockchain with minimal logging.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const VERBOSE = false; // Set to true for detailed logs
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

// Create a directory for modified contract files
const MODIFIED_DIR = '/root/modified-contracts';
if (!fs.existsSync(MODIFIED_DIR)) {
  fs.mkdirSync(MODIFIED_DIR);
}

// Conditional logging function
function log(message, always = false) {
  if (VERBOSE || always) {
    console.log(message);
  }
}

/**
 * Create a modified version of the contract that can be verified
 */
async function createModifiedContract(contractName) {
  log(`Creating modified version of ${contractName}...`);
  
  const contract = contracts[contractName];
  let sourceCode;
  
  // Check if flattened file exists and has content
  if (fs.existsSync(contract.flattenedPath) && fs.statSync(contract.flattenedPath).size > 0) {
    log(`Using flattened file for ${contractName}`);
    sourceCode = fs.readFileSync(contract.flattenedPath, 'utf8');
  } else {
    log(`Using original file for ${contractName}`);
    sourceCode = fs.readFileSync(contract.sourcePath, 'utf8');
  }
  
  // Create a modified version of the contract
  const outputPath = path.join(MODIFIED_DIR, `${contractName}.sol`);
  fs.writeFileSync(outputPath, sourceCode);
  
  return outputPath;
}

/**
 * Verify a contract using the Studio blockchain verification API
 */
async function verifyContract(contractName) {
  log(`Verifying ${contractName}...`, true);
  
  const contract = contracts[contractName];
  
  // Create the contract file
  const contractPath = await createModifiedContract(contractName);
  
  // Read the source code
  const sourceCode = fs.readFileSync(contractPath, 'utf8');
  
  // Only try the recommended EVM version to reduce logs
  const evmVersion = contract.evmVersion;
  
  // Create verification request
  const verificationData = {
    address: contract.address,
    sourceCode: sourceCode,
    compilerVersion: contract.compilerVersion,
    contractName: contract.contractName,
    optimizationUsed: contract.optimizationUsed,
    runs: contract.runs,
    evmVersion: evmVersion,
    constructorArguments: contract.constructorArgs
  };
  
  try {
    // Send the request
    const response = await axios.post(API_URL, verificationData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      log(`✅ ${contractName} verified successfully!`, true);
      return true;
    } else {
      const errorMsg = response.data.error || 'Unknown error';
      log(`❌ Error verifying ${contractName}: ${errorMsg}`, true);
      return false;
    }
  } catch (error) {
    log(`❌ Error verifying ${contractName}: ${error.message}`, true);
    return false;
  }
}

/**
 * Main function to verify all contracts
 */
async function main() {
  log("Starting Uniswap V3 contract verification on Studio blockchain...", true);
  
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
  log("\n=== Verification Summary ===", true);
  for (const [contractName, success] of Object.entries(results)) {
    log(`${contractName}: ${success ? '✅ Verified' : '❌ Failed'}`, true);
  }
  
  log("\nVerification process completed!", true);
}

// Run the main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, true);
});
