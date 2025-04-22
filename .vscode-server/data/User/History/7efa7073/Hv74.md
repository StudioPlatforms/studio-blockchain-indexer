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
