# Enhanced Contract Verification System

This document provides an overview of the enhanced contract verification system in the mainnet-indexer, which adds support for multi-file complex contracts like Uniswap v3.

## Overview

The enhanced verification system extends the existing contract verification functionality with improved support for:

1. **Multi-file contracts** - Verify contracts that span multiple files
2. **Complex import structures** - Handle npm-style imports and complex relative paths
3. **Library linking** - Better support for libraries in different files
4. **Memory optimization** - Improved memory management for large contracts
5. **Detailed error reporting** - More helpful error messages for verification failures

## Components

The enhanced verification system consists of the following components:

1. **Enhanced Import Handler** (`src/services/verification/enhanced-import-handler.ts`)
   - Improved import resolution for complex import structures
   - Support for npm-style imports (e.g., `@uniswap/v3-core/contracts/...`)
   - Dependency graph construction for better import handling
   - Automatic main file detection

2. **Enhanced Verification Service** (`src/services/verification/enhanced-verification.ts`)
   - Support for multi-file contract compilation
   - Improved memory management for large contracts
   - Better library handling
   - More detailed error reporting

3. **Enhanced Contracts Verification API** (`src/services/api/enhanced-contracts-verification.ts`)
   - New endpoint for multi-file verification
   - Improved error handling and reporting
   - Support for storing and retrieving multi-file contracts

4. **Enhanced Contracts Database** (`src/services/database/enhanced-contracts.ts`)
   - Support for storing and retrieving multi-file contracts
   - New fields for multi-file contract metadata

5. **Database Migration** (`migrations/012_multi_file_contracts.sql`)
   - Adds new columns to the contracts table for multi-file support
   - Updates existing contracts with JSON source code

## API Endpoints

### Verify a Contract

**Endpoint:** `POST /contracts/verify`

This endpoint supports both single-file and multi-file verification. For multi-file verification, set `isMultiPart` to `true` and provide the source files in the `sourceFiles` object.

**Request Body:**

```json
{
  "address": "0x123...",
  "compilerVersion": "0.7.6",
  "contractName": "UniswapV3Factory",
  "optimizationUsed": true,
  "runs": 200,
  "evmVersion": "istanbul",
  "constructorArguments": "000000...",
  "libraries": {
    "NFTDescriptor": "0x456..."
  },
  "isMultiPart": true,
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: BUSL-1.1\npragma solidity =0.7.6;\n...",
    "interfaces/IUniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.5.0;\n...",
    // Include all other source files
  }
}
```

### Verify a Multi-file Contract

**Endpoint:** `POST /contracts/verify-multi`

This endpoint is specifically for multi-file verification.

**Request Body:**

```json
{
  "address": "0x123...",
  "compilerVersion": "0.7.6",
  "contractName": "UniswapV3Factory",
  "optimizationUsed": true,
  "runs": 200,
  "evmVersion": "istanbul",
  "constructorArguments": "000000...",
  "libraries": {
    "NFTDescriptor": "0x456..."
  },
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: BUSL-1.1\npragma solidity =0.7.6;\n...",
    "interfaces/IUniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.5.0;\n...",
    // Include all other source files
  }
}
```

### Get Contract Verification Details

**Endpoint:** `GET /contracts/:address/verification`

This endpoint returns the verification details for a contract, including multi-file information if available.

**Response:**

```json
{
  "address": "0x123...",
  "contractName": "UniswapV3Factory",
  "compilerVersion": "0.7.6",
  "license": "BUSL-1.1",
  "optimizationUsed": true,
  "runs": 200,
  "evmVersion": "istanbul",
  "constructorArguments": "000000...",
  "libraries": {
    "NFTDescriptor": "0x456..."
  },
  "verifiedAt": "2023-01-01T00:00:00.000Z",
  "metadataHash": "0xa165627a7a72305820...",
  "isMultiFile": true,
  "mainFile": "UniswapV3Factory.sol",
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: BUSL-1.1\npragma solidity =0.7.6;\n...",
    "interfaces/IUniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.5.0;\n...",
    // All source files
  }
}
```

## Verifying Uniswap v3 Contracts

To verify Uniswap v3 contracts, you need to:

1. Collect all source files from the Uniswap v3 repositories:
   - [@uniswap/v3-core](https://github.com/Uniswap/v3-core)
   - [@uniswap/v3-periphery](https://github.com/Uniswap/v3-periphery)

2. Organize the source files with the correct paths:
   - For files from `@uniswap/v3-core`, use paths like `@uniswap/v3-core/contracts/...`
   - For files from `@uniswap/v3-periphery`, use paths like `@uniswap/v3-periphery/contracts/...`

3. Submit the verification request with all source files:
   - Use the `/contracts/verify-multi` endpoint
   - Include all source files in the `sourceFiles` object
   - Set the correct compiler version (0.7.6 for most Uniswap v3 contracts)
   - Set the correct EVM version (istanbul for most Uniswap v3 contracts)
   - Include any libraries used by the contract

### Example: Verifying UniswapV3Factory

```json
{
  "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "compilerVersion": "0.7.6",
  "contractName": "UniswapV3Factory",
  "optimizationUsed": true,
  "runs": 200,
  "evmVersion": "istanbul",
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: BUSL-1.1\npragma solidity =0.7.6;\n...",
    "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.5.0;\n...",
    // Include all other source files
  }
}
```

## Troubleshooting

### Common Issues

1. **Missing imports**
   - Make sure all imported files are included in the `sourceFiles` object
   - Check that the import paths match exactly with the paths in the source code

2. **Compiler version mismatch**
   - Use the exact compiler version used for deployment
   - For Uniswap v3, most contracts use version 0.7.6

3. **EVM version mismatch**
   - Use the correct EVM version for the compiler version
   - For Solidity 0.7.x, use 'berlin' or 'istanbul'

4. **Library linking issues**
   - Make sure all libraries are correctly linked with their addresses
   - For libraries in different files, use the format `File.sol:Library`

5. **Memory issues**
   - If you encounter memory issues during verification, try reducing the number of source files
   - Only include the necessary files for the contract being verified

### Error Messages

The enhanced verification system provides more detailed error messages to help diagnose issues:

- **Import not found**: Indicates that an imported file is missing from the `sourceFiles` object
- **Compilation failed**: Indicates a compilation error in the source code
- **Contract not found**: Indicates that the contract name doesn't match any contract in the source files
- **Bytecode verification failed**: Indicates that the compiled bytecode doesn't match the on-chain bytecode

## Database Schema

The enhanced verification system adds the following columns to the contracts table:

- `is_multi_file`: Boolean indicating whether this is a multi-file contract
- `main_file`: The main file of the multi-file contract
- `source_files`: JSONB column storing all source files for multi-file contracts
- `verification_metadata`: JSONB column for additional verification metadata

## Implementation Details

### Import Resolution

The enhanced import handler uses a multi-step process to resolve imports:

1. Try direct mapping from the import path to the source file
2. Try normalized path (removing leading './' or '../')
3. Try to resolve npm-style imports
4. Try alternative paths (with/without file extension, different path separators)
5. Try fuzzy matching for similar file names

### Dependency Graph

The enhanced import handler builds a dependency graph of the source files to better understand the import structure:

1. Extract imports from each source file
2. Create a node in the graph for each source file
3. Add edges for each import
4. Use the graph to detect circular dependencies and resolve import order

### Main File Detection

The enhanced verification service automatically detects the main file for a contract:

1. Try the file with the contract name (e.g., `ContractName.sol`)
2. Try to find a file that contains the contract definition
3. If no match is found, use the first file as the main file

### Memory Optimization

The enhanced verification service includes memory optimization for large contracts:

1. Increase the maximum source code size limit
2. Set Node.js memory limit for compilation
3. Optimize the compilation process to reduce memory usage

## Practical Guide for Verifying Studio-Deployed Uniswap v3 Contracts

This section provides specific guidance for developers who have deployed Uniswap v3 contracts on Studio and need to verify them.

### Automated Source File Collection

Here's a Node.js script to automatically collect and prepare all necessary source files for Uniswap v3 verification:

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration - MODIFY THESE VALUES
const CONTRACT_ADDRESS = '0x1234...'; // Your deployed contract address
const CONTRACT_NAME = 'UniswapV3Factory'; // The contract you want to verify
const COMPILER_VERSION = '0.7.6';
const OPTIMIZATION_USED = true;
const RUNS = 200;
const EVM_VERSION = 'istanbul';
const CONSTRUCTOR_ARGS = ''; // Add constructor arguments if any
const LIBRARIES = {}; // Add libraries if any, e.g. {"NFTDescriptor": "0x1234..."}

// Temporary directory for cloning repositories
const TEMP_DIR = './uniswap-verification-temp';
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Clone repositories if they don't exist
console.log('Cloning Uniswap repositories...');
if (!fs.existsSync(path.join(TEMP_DIR, 'v3-core'))) {
  execSync('git clone https://github.com/Uniswap/v3-core.git', { cwd: TEMP_DIR });
  // Use the exact tag/version that matches your deployment
  execSync('git checkout v1.0.0', { cwd: path.join(TEMP_DIR, 'v3-core') });
}

if (!fs.existsSync(path.join(TEMP_DIR, 'v3-periphery'))) {
  execSync('git clone https://github.com/Uniswap/v3-periphery.git', { cwd: TEMP_DIR });
  // Use the exact tag/version that matches your deployment
  execSync('git checkout v1.0.0', { cwd: path.join(TEMP_DIR, 'v3-periphery') });
}

// Create source files object
const sourceFiles = {};

// Function to read files recursively
function processDirectory(baseDir, targetPath, prefix) {
  const files = fs.readdirSync(targetPath);
  
  files.forEach(file => {
    const fullPath = path.join(targetPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(baseDir, fullPath, prefix);
    } else if (file.endsWith('.sol')) {
      // Create the import path as it would appear in import statements
      const relativePath = path.relative(baseDir, fullPath);
      const importPath = path.join(prefix, relativePath).replace(/\\/g, '/');
      
      // Read the file content
      const content = fs.readFileSync(fullPath, 'utf8');
      sourceFiles[importPath] = content;
      
      console.log(`Added: ${importPath}`);
    }
  });
}

// Process core and periphery repositories
console.log('Processing v3-core files...');
processDirectory(
  path.join(TEMP_DIR, 'v3-core'), 
  path.join(TEMP_DIR, 'v3-core', 'contracts'), 
  '@uniswap/v3-core/contracts'
);

console.log('Processing v3-periphery files...');
processDirectory(
  path.join(TEMP_DIR, 'v3-periphery'), 
  path.join(TEMP_DIR, 'v3-periphery', 'contracts'), 
  '@uniswap/v3-periphery/contracts'
);

// Create verification request
const verificationRequest = {
  address: CONTRACT_ADDRESS,
  compilerVersion: COMPILER_VERSION,
  contractName: CONTRACT_NAME,
  optimizationUsed: OPTIMIZATION_USED,
  runs: RUNS,
  evmVersion: EVM_VERSION,
  sourceFiles: sourceFiles
};

// Add constructor arguments if provided
if (CONSTRUCTOR_ARGS) {
  verificationRequest.constructorArguments = CONSTRUCTOR_ARGS;
}

// Add libraries if provided
if (Object.keys(LIBRARIES).length > 0) {
  verificationRequest.libraries = LIBRARIES;
}

// Write the verification request to a file
const outputFile = 'uniswap-verification-request.json';
fs.writeFileSync(outputFile, JSON.stringify(verificationRequest, null, 2));
console.log(`Verification request saved to ${outputFile}`);
```

### Specific Guidance for Common Uniswap v3 Contracts

#### 1. UniswapV3Factory

- **Contract Name**: `UniswapV3Factory`
- **Compiler Version**: `0.7.6`
- **EVM Version**: `istanbul`
- **Optimization**: `true` with 200 runs
- **Constructor Arguments**: None
- **Required Files**: All files from v3-core repository

#### 2. NonfungiblePositionManager

- **Contract Name**: `NonfungiblePositionManager`
- **Compiler Version**: `0.7.6`
- **EVM Version**: `istanbul`
- **Optimization**: `true` with 200 runs
- **Libraries**: May require `NFTDescriptor` library address
- **Required Files**: Files from both v3-core and v3-periphery repositories

#### 3. SwapRouter

- **Contract Name**: `SwapRouter`
- **Compiler Version**: `0.7.6`
- **EVM Version**: `istanbul`
- **Optimization**: `true` with 200 runs
- **Constructor Arguments**: Factory address and WETH9 address
- **Required Files**: Files from both v3-core and v3-periphery repositories

### Extracting Constructor Arguments

If you don't have the constructor arguments from your deployment, you can extract them from the transaction that created the contract:

1. Find the transaction hash that created your contract
2. Get the transaction input data
3. Remove the contract bytecode to get the constructor arguments

Here's a script to help extract constructor arguments:

```javascript
const { ethers } = require('ethers');

// Configure these values
const RPC_URL = 'https://your-rpc-endpoint';
const TRANSACTION_HASH = '0x...'; // The transaction that created your contract

async function extractConstructorArgs() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  // Get the transaction
  const tx = await provider.getTransaction(TRANSACTION_HASH);
  
  // Get the transaction receipt to find the contract address
  const receipt = await provider.getTransactionReceipt(TRANSACTION_HASH);
  const contractAddress = receipt.contractAddress;
  
  // Get the contract code
  const code = await provider.getCode(contractAddress);
  
  // The input data contains the bytecode + constructor arguments
  // We need to find where the bytecode ends and the arguments begin
  const deployedBytecode = code.slice(2); // Remove 0x prefix
  const inputData = tx.data.slice(2); // Remove 0x prefix
  
  // Find where the deployed bytecode ends in the input data
  // This is a simplification - for complex contracts you might need a more sophisticated approach
  const constructorArgs = inputData.slice(inputData.indexOf(deployedBytecode) + deployedBytecode.length);
  
  console.log(`Constructor Arguments: ${constructorArgs}`);
  return constructorArgs;
}

extractConstructorArgs().catch(console.error);
```

### Submitting the Verification Request

Once you have prepared your verification request JSON file, you can submit it to the API:

```bash
curl -X POST http://your-indexer-url/contracts/verify-multi \
  -H "Content-Type: application/json" \
  -d @uniswap-verification-request.json
```

### Troubleshooting Uniswap-Specific Issues

1. **Missing NPM-style imports**: Ensure all files are included with the correct npm-style paths (`@uniswap/v3-core/contracts/...`)

2. **Library linking for NonfungiblePositionManager**: This contract uses the NFTDescriptor library, which must be correctly linked

3. **Version mismatches**: Make sure you're using the exact same version of the repositories that was used for deployment

4. **Bytecode verification failures**: Double-check that your optimization settings match those used during deployment

5. **Memory issues**: The Uniswap contracts are large and complex. If you encounter memory issues:
   - Increase the Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096`
   - Try using the flattener if direct multi-file verification fails

## Important: Additional Dependencies for Uniswap v3 Contracts

When verifying Uniswap v3 contracts, you need to include **all** dependencies, not just the files from v3-core and v3-periphery. Based on the error messages, you need to include:

### 1. OpenZeppelin Contracts

Uniswap v3 depends on several OpenZeppelin contracts. You need to include:

- `@openzeppelin/contracts/token/ERC721/ERC721.sol`
- `@openzeppelin/contracts/token/ERC721/IERC721.sol`
- `@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol`
- `@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/drafts/IERC20Permit.sol`
- `@openzeppelin/contracts/drafts/ERC20Permit.sol`
- `@openzeppelin/contracts/utils/Address.sol`
- `@openzeppelin/contracts/utils/Strings.sol`
- `@openzeppelin/contracts/math/SafeMath.sol`
- `@openzeppelin/contracts/math/SignedSafeMath.sol`

### 2. Uniswap v2 Core

Some Uniswap v3 contracts reference Uniswap v2:

- `@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol`

### 3. Uniswap Lib

Uniswap v3 uses utilities from the Uniswap lib package:

- `@uniswap/lib/contracts/libraries/SafeERC20Namer.sol`

### 4. Base64

The NFT-related contracts use a Base64 library:

- `base64-sol/base64.sol`

### Updated Verification Script

Here's an updated script that includes all necessary dependencies:

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONTRACT_ADDRESS = '0x1234...'; // Your deployed contract address
const CONTRACT_NAME = 'UniswapV3Factory'; // The contract you want to verify
const COMPILER_VERSION = '0.7.6';
const OPTIMIZATION_USED = true;
const RUNS = 200;
const EVM_VERSION = 'istanbul';
const CONSTRUCTOR_ARGS = ''; // Add constructor arguments if any
const LIBRARIES = {}; // Add libraries if any, e.g. {"NFTDescriptor": "0x1234..."}

// Temporary directory for cloning repositories
const TEMP_DIR = './uniswap-verification-temp';
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Clone all required repositories
console.log('Cloning repositories...');

// 1. Clone v3-core
if (!fs.existsSync(path.join(TEMP_DIR, 'v3-core'))) {
  execSync('git clone https://github.com/Uniswap/v3-core.git', { cwd: TEMP_DIR });
  execSync('git checkout v1.0.0', { cwd: path.join(TEMP_DIR, 'v3-core') });
}

// 2. Clone v3-periphery
if (!fs.existsSync(path.join(TEMP_DIR, 'v3-periphery'))) {
  execSync('git clone https://github.com/Uniswap/v3-periphery.git', { cwd: TEMP_DIR });
  execSync('git checkout v1.0.0', { cwd: path.join(TEMP_DIR, 'v3-periphery') });
}

// 3. Clone v2-core
if (!fs.existsSync(path.join(TEMP_DIR, 'v2-core'))) {
  execSync('git clone https://github.com/Uniswap/v2-core.git', { cwd: TEMP_DIR });
  execSync('git checkout v1.0.1', { cwd: path.join(TEMP_DIR, 'v2-core') });
}

// 4. Clone uniswap-lib
if (!fs.existsSync(path.join(TEMP_DIR, 'lib'))) {
  execSync('git clone https://github.com/Uniswap/uniswap-lib.git lib', { cwd: TEMP_DIR });
  execSync('git checkout v4.0.1-alpha', { cwd: path.join(TEMP_DIR, 'lib') });
}

// 5. Clone OpenZeppelin contracts
if (!fs.existsSync(path.join(TEMP_DIR, 'openzeppelin-contracts'))) {
  execSync('git clone https://github.com/OpenZeppelin/openzeppelin-contracts.git', { cwd: TEMP_DIR });
  execSync('git checkout v3.4.0', { cwd: path.join(TEMP_DIR, 'openzeppelin-contracts') });
}

// 6. Clone base64-sol
if (!fs.existsSync(path.join(TEMP_DIR, 'base64'))) {
  execSync('git clone https://github.com/Brechtpd/base64.git', { cwd: TEMP_DIR });
  execSync('git checkout v1.0.0', { cwd: path.join(TEMP_DIR, 'base64') });
}

// Create source files object
const sourceFiles = {};

// Function to read files recursively
function processDirectory(baseDir, targetPath, prefix) {
  const files = fs.readdirSync(targetPath);
  
  files.forEach(file => {
    const fullPath = path.join(targetPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(baseDir, fullPath, prefix);
    } else if (file.endsWith('.sol')) {
      // Create the import path as it would appear in import statements
      const relativePath = path.relative(baseDir, fullPath);
      const importPath = path.join(prefix, relativePath).replace(/\\/g, '/');
      
      // Read the file content
      const content = fs.readFileSync(fullPath, 'utf8');
      sourceFiles[importPath] = content;
      
      console.log(`Added: ${importPath}`);
    }
  });
}

// Process all repositories
console.log('Processing v3-core files...');
processDirectory(
  path.join(TEMP_DIR, 'v3-core'), 
  path.join(TEMP_DIR, 'v3-core', 'contracts'), 
  '@uniswap/v3-core/contracts'
);

console.log('Processing v3-periphery files...');
processDirectory(
  path.join(TEMP_DIR, 'v3-periphery'), 
  path.join(TEMP_DIR, 'v3-periphery', 'contracts'), 
  '@uniswap/v3-periphery/contracts'
);

console.log('Processing v2-core files...');
processDirectory(
  path.join(TEMP_DIR, 'v2-core'), 
  path.join(TEMP_DIR, 'v2-core', 'contracts'), 
  '@uniswap/v2-core/contracts'
);

console.log('Processing uniswap-lib files...');
processDirectory(
  path.join(TEMP_DIR, 'lib'), 
  path.join(TEMP_DIR, 'lib', 'contracts'), 
  '@uniswap/lib/contracts'
);

console.log('Processing OpenZeppelin files...');
processDirectory(
  path.join(TEMP_DIR, 'openzeppelin-contracts'), 
  path.join(TEMP_DIR, 'openzeppelin-contracts', 'contracts'), 
  '@openzeppelin/contracts'
);

// Process base64-sol (special case as it has a different structure)
console.log('Processing base64-sol files...');
const base64Content = fs.readFileSync(path.join(TEMP_DIR, 'base64', 'base64.sol'), 'utf8');
sourceFiles['base64-sol/base64.sol'] = base64Content;
console.log('Added: base64-sol/base64.sol');

// Create verification request
const verificationRequest = {
  address: CONTRACT_ADDRESS,
  compilerVersion: COMPILER_VERSION,
  contractName: CONTRACT_NAME,
  optimizationUsed: OPTIMIZATION_USED,
  runs: RUNS,
  evmVersion: EVM_VERSION,
  sourceFiles: sourceFiles
};

// Add constructor arguments if provided
if (CONSTRUCTOR_ARGS) {
  verificationRequest.constructorArguments = CONSTRUCTOR_ARGS;
}

// Add libraries if provided
if (Object.keys(LIBRARIES).length > 0) {
  verificationRequest.libraries = LIBRARIES;
}

// Write the verification request to a file
const outputFile = 'uniswap-verification-request.json';
fs.writeFileSync(outputFile, JSON.stringify(verificationRequest, null, 2));
console.log(`Verification request saved to ${outputFile}`);
```

This script clones all the necessary repositories and collects all the required source files with the correct paths for verification.

By following this approach, you should be able to successfully verify your Uniswap v3 contracts deployed on Studio.
