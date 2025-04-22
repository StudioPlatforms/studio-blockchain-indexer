# Studio Blockchain Mainnet Indexer Summary

This document provides a summary of how the Studio Blockchain Mainnet Indexer works, based on an analysis of the codebase.

## Overview

The Studio Blockchain Mainnet Indexer is a service that indexes the Studio Blockchain and provides API endpoints for the explorer frontend. It allows users to explore blocks, transactions, contracts, and tokens on the blockchain.

## Architecture

The mainnet-indexer consists of several key components:

1. **Blockchain Service**: Interacts with the blockchain node to get information about blocks, transactions, contracts, and tokens.
2. **Database Service**: Stores indexed data in a PostgreSQL database.
3. **API Service**: Provides RESTful API endpoints for the explorer frontend.
4. **Indexer Service**: Processes blocks and transactions to extract and store relevant data.
5. **Verification Service**: Verifies smart contracts by compiling source code and comparing bytecode.

## Blockchain Service

The blockchain service (`src/services/blockchain`) is responsible for interacting with the blockchain node. It provides methods to:

- Get block information
- Get transaction information
- Get contract information
- Get token information
- Check if an address is a contract
- Get contract bytecode
- Call contract methods

The blockchain service uses ethers.js to interact with the blockchain node via JSON-RPC.

## Database Service

The database service (`src/services/database`) is responsible for storing indexed data in a PostgreSQL database. It provides methods to:

- Store block information
- Store transaction information
- Store contract information
- Store token information
- Store contract verification data
- Query indexed data

## API Service

The API service (`src/services/api`) provides RESTful API endpoints for the explorer frontend. It includes endpoints for:

- Blocks
- Transactions
- Contracts
- Tokens
- NFTs
- Contract verification
- Statistics

## Indexer Service

The indexer service (`src/services/indexer.ts`) processes blocks and transactions to extract and store relevant data. It:

- Fetches new blocks from the blockchain
- Processes transactions in each block
- Detects contract deployments
- Detects token transfers
- Updates token balances
- Stores indexed data in the database

## Verification Service

The verification service (`src/services/verification`) verifies smart contracts by compiling source code and comparing bytecode. It:

- Loads and caches Solidity compiler versions
- Compiles Solidity source code with specified settings
- Compares compiled bytecode with on-chain bytecode
- Handles constructor arguments and libraries
- Extracts and validates metadata hashes

## Contract Verification Process

The contract verification process works as follows:

1. The user submits a verification request with the contract address, source code, compiler version, and other compilation settings.
2. The system checks if the address is a valid contract on the blockchain.
3. The system validates the constructor arguments.
4. The system compiles the source code with the specified settings.
5. The system compares the compiled bytecode with the on-chain bytecode.
6. If the bytecodes match, the contract is marked as verified, and the source code, ABI, and compilation settings are stored in the database.

## API Endpoints

The API provides various endpoints for interacting with the blockchain, including:

- `/blocks`: Get block information
- `/transactions`: Get transaction information
- `/contracts`: Get contract information
- `/tokens`: Get token information
- `/nfts`: Get NFT information
- `/contracts/verify`: Verify a contract
- `/contracts/:address/abi`: Get the ABI of a verified contract
- `/contracts/:address/source`: Get the source code of a verified contract
- `/contracts/:address/interact`: Interact with a verified contract

## Conclusion

The Studio Blockchain Mainnet Indexer is a comprehensive service that indexes the Studio Blockchain and provides API endpoints for the explorer frontend. It allows users to explore blocks, transactions, contracts, and tokens on the blockchain, as well as verify and interact with smart contracts.
