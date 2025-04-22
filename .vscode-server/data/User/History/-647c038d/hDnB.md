# Studio Blockchain Mainnet Indexer Final Summary

This document provides a comprehensive summary of the Studio Blockchain Mainnet Indexer, with a focus on contract verification.

## Overview

The Studio Blockchain Mainnet Indexer is a service that indexes the Studio Blockchain and provides API endpoints for the explorer frontend. It allows users to explore blocks, transactions, contracts, and tokens on the blockchain, as well as verify and interact with smart contracts.

## Architecture

The mainnet-indexer consists of several key components:

1. **Blockchain Service**: Interacts with the blockchain node to get information about blocks, transactions, contracts, and tokens.
2. **Database Service**: Stores indexed data in a PostgreSQL database.
3. **API Service**: Provides RESTful API endpoints for the explorer frontend.
4. **Indexer Service**: Processes blocks and transactions to extract and store relevant data.
5. **Verification Service**: Verifies smart contracts by compiling source code and comparing bytecode.

## Database Schema

The mainnet-indexer uses a PostgreSQL database to store blockchain data. The database schema includes tables for blocks, transactions, accounts, contracts, tokens, and NFTs. The contract verification data is stored in the `contracts` table, which includes columns for the source code, ABI, compiler version, and other compilation settings.

## Contract Verification

Contract verification is a key feature of the mainnet-indexer. It allows users to verify that a deployed smart contract's bytecode matches the source code that was used to compile it. This enables users to view and interact with the source code of a contract, rather than just the bytecode.

### Verification Process

The verification process works as follows:

1. The user submits a verification request with the contract address, source code, compiler version, and other compilation settings.
2. The system checks if the address is a valid contract on the blockchain.
3. The system validates the constructor arguments.
4. The system compiles the source code with the specified settings.
5. The system compares the compiled bytecode with the on-chain bytecode.
6. If the bytecodes match, the contract is marked as verified, and the source code, ABI, and compilation settings are stored in the database.

### Verification Service

The verification service is implemented in `src/services/verification/index.ts`. It provides the following functionality:

- Loading and caching Solidity compiler versions
- Compiling Solidity source code with specified settings
- Comparing compiled bytecode with on-chain bytecode
- Handling constructor arguments and libraries
- Extracting and validating metadata hashes
- Validating constructor arguments

### API Endpoints

The contract verification API is implemented in `src/services/api/contracts.ts`. It provides the following endpoints:

- `POST /contracts/verify`: Submit a contract for verification
- `GET /contracts/:address/verified`: Check if a contract is verified
- `GET /contracts/:address/abi`: Get the ABI of a verified contract
- `GET /contracts/:address/source`: Get the source code of a verified contract
- `POST /contracts/:address/interact`: Interact with a verified contract

## EVM Version Support

The verification service supports specifying the EVM version to use for compilation. The EVM version is stored in the database and used when compiling the contract. If not specified, the default EVM version is "cancun".

The service also includes logic to determine the appropriate EVM version based on the compiler version, ensuring that the EVM version is compatible with the compiler version.

## Error Handling

The verification service provides detailed error messages for various failure scenarios:

- Missing required parameters
- Invalid contract address
- Contract not found in the database
- Invalid constructor arguments
- Compilation errors
- Bytecode mismatch
- Method not found in the ABI

## Conclusion

The Studio Blockchain Mainnet Indexer is a comprehensive service that indexes the Studio Blockchain and provides API endpoints for the explorer frontend. It allows users to explore blocks, transactions, contracts, and tokens on the blockchain, as well as verify and interact with smart contracts.

The contract verification process is a key feature of the mainnet-indexer, enabling users to verify that a deployed smart contract's bytecode matches the source code that was used to compile it. This allows users to view and interact with the source code of a contract, rather than just the bytecode.
