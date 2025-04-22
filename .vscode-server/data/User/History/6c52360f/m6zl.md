# Contract Verification System

This document describes the contract verification system implemented in the Studio Blockchain Indexer.

## Overview

The contract verification system allows users to verify smart contracts by submitting the source code, compiler version, and other compilation settings. The system compiles the source code and compares the resulting bytecode with the on-chain bytecode to verify that the source code matches the deployed contract.

## Components

The contract verification system consists of the following components:

1. **Verification Service**: A service that handles the compilation and verification of contracts.
2. **API Endpoints**: Endpoints for submitting verification requests and retrieving verification data.
3. **Database**: Storage for verification data, including source code, ABI, and compilation settings.

## Verification Service

The verification service is implemented in `src/services/verification/index.ts`. It provides the following functionality:

- Loading and caching Solidity compiler versions
- Compiling Solidity source code with specified settings
- Comparing compiled bytecode with on-chain bytecode
- Handling constructor arguments and libraries

## API Endpoints

The contract verification API is implemented in `src/services/api/contracts.ts`. It provides the following endpoints:

- `POST /contracts/verify`: Submit a contract for verification
- `GET /contracts/:address/abi`: Get the ABI of a verified contract
- `GET /contracts/:address/source`: Get the source code of a verified contract
- `POST /contracts/:address/interact`: Interact with a verified contract

## Verification Process

The verification process works as follows:

1. The user submits a verification request with the contract address, source code, compiler version, and other compilation settings.
2. The system checks if the address is a valid contract on the blockchain.
3. The system compiles the source code with the specified settings.
4. The system compares the compiled bytecode with the on-chain bytecode.
5. If the bytecodes match, the contract is marked as verified, and the source code, ABI, and compilation settings are stored in the database.

## EVM Version Support

The system supports specifying the EVM version to use for compilation. The EVM version is stored in the database and used when compiling the contract. If not specified, the default EVM version is "cancun".

## Usage

### Verifying a Contract

To verify a contract, send a POST request to `/contracts/verify` with the following parameters:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }",
  "compilerVersion": "0.8.0",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "0x...",
  "contractName": "MyContract",
  "libraries": {
    "MyLibrary": "0x1234567890123456789012345678901234567890"
  },
  "evmVersion": "cancun"
}
```

### Getting Contract ABI

To get the ABI of a verified contract, send a GET request to `/contracts/:address/abi`.

### Getting Contract Source Code

To get the source code of a verified contract, send a GET request to `/contracts/:address/source`.

### Interacting with a Contract

To interact with a verified contract, send a POST request to `/contracts/:address/interact` with the following parameters:

```json
{
  "method": "balanceOf",
  "params": ["0x1234567890123456789012345678901234567890"]
}
```

## Error Handling

The system provides detailed error messages for various failure scenarios:

- Missing required parameters
- Invalid contract address
- Contract not found in the database
- Compilation errors
- Bytecode mismatch
- Method not found in the ABI

## Production Considerations

For a production environment, consider the following:

1. **Compiler Caching**: Cache compiled contracts to improve performance.
2. **Rate Limiting**: Implement rate limiting to prevent abuse.
3. **Security**: Validate and sanitize user input to prevent security vulnerabilities.
4. **Monitoring**: Monitor the system for errors and performance issues.
5. **Scaling**: Consider scaling the system horizontally to handle increased load.
