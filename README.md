# Studio Blockchain Indexer 

https://studio-scan.com

A comprehensive indexing service for the Studio Blockchain that provides API endpoints for blockchain explorers, wallets, and dApps.

## Overview

The Studio Blockchain Indexer continuously processes blocks and transactions from the Studio Blockchain, storing them in a PostgreSQL database for efficient querying. It provides a rich set of REST API endpoints that enable developers to access blockchain data, token information, NFT metadata, and smart contract details.

## Features

- **Real-time Blockchain Indexing**: Continuously indexes blocks, transactions, and events
- **Token Support**: Tracks ERC-20, ERC-721, and ERC-1155 tokens
- **NFT Metadata**: Retrieves and stores NFT metadata and ownership information
- **Smart Contract Verification**: Verifies and stores smart contract source code and ABIs
- **Transaction Decoding**: Decodes transaction input data for verified contracts
- **Comprehensive API**: Provides REST endpoints for all indexed data
- **Monitoring**: Includes enhanced monitoring for system health and security

## Setup Instructions

### Prerequisites

- Docker and Docker Compose (for Docker deployment)
- Node.js 20.x and PostgreSQL 15.x (for manual deployment)
- Git

### Docker Deployment (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/StudioPlatforms/studio-blockchain-indexer.git
   cd studio-blockchain-indexer
   ```

2. Configure environment variables (optional):
   - The default configuration in `docker-compose.yml` works out of the box
   - Modify environment variables in `docker-compose.yml` if needed

3. Start the services:
   ```bash
   docker-compose up -d
   ```

4. Monitor the logs:
   ```bash
   docker-compose logs -f
   ```

### Manual Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/StudioPlatforms/studio-blockchain-indexer.git
   cd studio-blockchain-indexer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a PostgreSQL database:
   ```bash
   createdb studio_indexer
   ```

4. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Build the application:
   ```bash
   npm run build
   ```

6. Start the indexer:
   ```bash
   npm start
   ```

## API Endpoints

The indexer provides a comprehensive set of API endpoints for accessing blockchain data. All endpoints are relative to the base URL (default: `http://localhost:3000`).

### Core Endpoints

#### Health Check
- `GET /health` - Check the health status of the indexer

#### Blocks
- `GET /blocks` - Get latest blocks
- `GET /blocks/:number` - Get block by number
- `GET /blocks/hash/:hash` - Get block by hash

#### Transactions
- `GET /transactions` - Get latest transactions
- `GET /transactions/:hash` - Get transaction by hash
- `GET /transactions/:hash/receipt` - Get transaction receipt
- `GET /transactions/:hash/decoded` - Get decoded transaction data
- `GET /transactions/pending` - Get pending transactions
- `GET /address/:address/transactions` - Get transactions by address

#### Search
- `GET /search?q=<query>` - Search for blocks, transactions, or addresses

### Token Endpoints

#### Account Balances
- `GET /account/:address/balances` - Get native and token balances for an account
- `GET /address/:address/tokens` - Get tokens owned by an address
- `GET /address/:address/token-transfers` - Get token transfers for an address

#### Token Information
- `GET /tokens/:tokenAddress` - Get token information
- `GET /tokens/:tokenAddress/holders` - Get token holders
- `GET /tokens/:tokenAddress/transfers` - Get token transfers

### NFT Endpoints

- `GET /address/:address/nfts` - Get NFTs owned by an address
- `GET /nfts/:tokenAddress/:tokenId` - Get NFT metadata
- `GET /address/:address/nft-transfers` - Get NFT transfers for an address
- `GET /nfts/:tokenAddress` - Get NFT collection information
- `GET /nfts` - Get list of NFT collections

### Contract Verification Endpoints

- `POST /contracts/verify` - Verify a single-file contract
- `POST /contracts/verify-multi` - Verify a multi-file contract
- `GET /contracts/:address/verified` - Check if a contract is verified
- `GET /contracts/:address/abi` - Get contract ABI
- `GET /contracts/:address/source` - Get contract source code
- `GET /contracts/:address/verification` - Get contract verification details
- `POST /contracts/:address/interact` - Interact with a contract
- `GET /contracts/verified` - Get list of verified contracts

### Statistics Endpoints

- `GET /stats/tps` - Get transactions per second
- `GET /stats/holders` - Get total STO holders
- `GET /stats/validators/payout` - Get validators payout
- `GET /stats/contracts/count` - Get total contracts count
- `GET /stats/contracts/erc20/count` - Get ERC20 contracts count
- `GET /stats/contracts/nft/count` - Get NFT contracts count

## Contract Verification System

The Studio Blockchain Indexer includes a powerful contract verification system that supports both single-file and multi-file contracts. This system allows developers to verify their smart contracts and make them available for exploration through the API.

### Verification Process

1. **Bytecode Comparison**: The system compiles the provided source code and compares the resulting bytecode with the on-chain bytecode.
2. **Metadata Extraction**: The system extracts metadata from the bytecode to provide additional information about the contract.
3. **Storage**: Upon successful verification, the source code, ABI, and other metadata are stored in the database.

### Single-File Contract Verification

To verify a single-file contract, use the `/contracts/verify` endpoint:

```javascript
// Example: Verifying a single-file contract
const response = await fetch('http://localhost:3000/contracts/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    address: '0x1234567890123456789012345678901234567890',
    sourceCode: 'pragma solidity ^0.8.0; contract MyContract { ... }',
    compilerVersion: '0.8.0',
    contractName: 'MyContract',
    optimizationUsed: true,
    runs: 200,
    constructorArguments: '', // Optional: hex-encoded constructor arguments without 0x prefix
    libraries: {}, // Optional: mapping of library names to addresses
    evmVersion: 'cancun' // Optional: EVM version (default: 'cancun')
  })
});

const result = await response.json();
```

### Multi-File Contract Verification

For contracts that span multiple files or use imports, use the `/contracts/verify-multi` endpoint:

```javascript
// Example: Verifying a multi-file contract
const response = await fetch('http://localhost:3000/contracts/verify-multi', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    address: '0x1234567890123456789012345678901234567890',
    sourceFiles: {
      'MyContract.sol': 'pragma solidity ^0.8.0; import "./Interfaces.sol"; contract MyContract { ... }',
      'Interfaces.sol': 'pragma solidity ^0.8.0; interface IMyInterface { ... }',
      'Libraries/Math.sol': 'pragma solidity ^0.8.0; library Math { ... }'
    },
    compilerVersion: '0.8.0',
    contractName: 'MyContract',
    optimizationUsed: true,
    runs: 200,
    constructorArguments: '', // Optional: hex-encoded constructor arguments without 0x prefix
    libraries: {
      'Math': '0x1234567890123456789012345678901234567890'
    }, // Optional: mapping of library names to addresses
    evmVersion: 'cancun' // Optional: EVM version (default: 'cancun')
  })
});

const result = await response.json();
```

### Handling Imports

The verification system supports several ways to handle imports:

1. **Multi-File Verification**: Include all imported files in the `sourceFiles` object.
2. **Import Mappings**: For standard libraries, you can provide import mappings:

```javascript
// Example: Using import mappings
const response = await fetch('http://localhost:3000/contracts/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // ... other verification parameters
    importMappings: {
      '@openzeppelin/contracts/': 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.4.0/',
      '@uniswap/v3-core/': 'https://github.com/Uniswap/v3-core/blob/main/'
    }
  })
});
```

### Verification Response

A successful verification response includes:

```json
{
  "success": true,
  "message": "Contract verified successfully",
  "address": "0x1234567890123456789012345678901234567890",
  "abi": [...],
  "metadata": "...",
  "metadataHash": "0xa165627a7a72305820..."
}
```

For multi-file contracts, the response also includes the main file:

```json
{
  "success": true,
  "message": "Contract verified successfully",
  "address": "0x1234567890123456789012345678901234567890",
  "abi": [...],
  "metadata": "...",
  "metadataHash": "0xa165627a7a72305820...",
  "mainFile": "MyContract.sol"
}
```

### Verification Errors

Common verification errors include:

1. **Compiler Version Mismatch**: The compiler version used for verification doesn't match the one used for deployment.
2. **Optimization Settings Mismatch**: The optimization settings (enabled/disabled, runs) don't match.
3. **Missing Imports**: Not all imported files are included in the `sourceFiles` object.
4. **Constructor Arguments Mismatch**: The provided constructor arguments don't match the ones used during deployment.
5. **Library Addresses Mismatch**: The provided library addresses don't match the ones used during deployment.

### Getting Verification Details

To get verification details for a contract:

```javascript
// Example: Getting verification details
const response = await fetch('http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/verification');
const verificationDetails = await response.json();
```

The response includes:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "contractName": "MyContract",
  "compilerVersion": "0.8.0",
  "license": "MIT",
  "optimizationUsed": true,
  "runs": 200,
  "evmVersion": "cancun",
  "constructorArguments": "",
  "libraries": {},
  "verifiedAt": "2025-04-22T14:30:00Z",
  "metadataHash": "0xa165627a7a72305820...",
  "isMultiFile": true,
  "sourceFiles": {
    "MyContract.sol": "...",
    "Interfaces.sol": "..."
  },
  "ownerAddress": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
  "creatorAddress": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
  "creationInfo": {
    "creator": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "blockNumber": "22166",
    "timestamp": 1742059631,
    "transactionHash": "0x3531c58c08bc1b4f0d94bf6ae2942f459f8918e1ccfd298b5d5f59b387ec913f"
  }
}
```

## Environment Variables

The following environment variables can be configured:

### Database Configuration
- `DB_HOST` - PostgreSQL host (default: `localhost`)
- `DB_PORT` - PostgreSQL port (default: `5432`)
- `DB_NAME` - PostgreSQL database name (default: `studio_indexer`)
- `DB_USER` - PostgreSQL username (default: `postgres`)
- `DB_PASSWORD` - PostgreSQL password (default: `postgres`)

### Blockchain Configuration
- `RPC_URL` - Studio Blockchain RPC URL (default: `https://mainnet.studio-blockchain.com`)
- `CHAIN_ID` - Studio Blockchain chain ID (default: `240241`)

### Server Configuration
- `PORT` - API server port (default: `3000`)
- `HOST` - API server host (default: `0.0.0.0`)

### Indexer Configuration
- `START_BLOCK` - Block to start indexing from (default: `0`)
- `BATCH_SIZE` - Number of blocks to process in a batch (default: `10`)
- `CONFIRMATIONS` - Number of confirmations to wait before processing a block (default: `12`)

### Logging
- `LOG_LEVEL` - Logging level (default: `info`)

## Development

### Project Structure

- `src/` - Source code
  - `services/` - Core services
    - `api/` - API endpoints
    - `blockchain/` - Blockchain interaction
    - `database/` - Database operations
    - `indexer.ts` - Indexer service
    - `verification/` - Contract verification
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
  - `config.ts` - Configuration
  - `index.ts` - Entry point
- `migrations/` - Database migrations
- `scripts/` - Utility scripts
- `docker-compose.yml` - Docker Compose configuration
- `Dockerfile` - Docker build configuration

### Running in Development Mode

```bash
npm run dev
```

This will start the indexer in development mode with hot reloading.

## Maintenance

### Resetting the Indexer

If you need to reset the indexer and start from scratch:

```bash
# For Docker deployment
docker-compose down -v
docker-compose up -d

# For manual deployment
npm run migrate down
npm run migrate up
```

### Monitoring

The indexer includes an enhanced monitoring service that checks the health of the system and provides alerts for any issues. You can view the logs at:

```bash
# For Docker deployment
docker-compose logs -f enhanced-monitor

# For manual deployment
tail -f logs/enhanced-monitor.log
```

## Building on the Indexer

The Studio Blockchain Indexer provides a solid foundation for building blockchain explorers, wallets, and dApps. Here are some ways to build on top of it:

### Frontend Integration

You can build a frontend application that consumes the API endpoints provided by the indexer. Here's an example of fetching the latest blocks:

```javascript
// Example: Fetching the latest blocks
async function getLatestBlocks() {
  const response = await fetch('http://localhost:3000/blocks?limit=10');
  const blocks = await response.json();
  
  // Process blocks
  blocks.forEach(block => {
    console.log(`Block ${block.number}: ${block.hash}`);
    console.log(`Transactions: ${block.transactions.length}`);
    console.log(`Timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
  });
}
```

### Transaction Decoding

For verified contracts, you can decode transaction input data:

```javascript
// Example: Decoding transaction input data
async function decodeTransaction(txHash) {
  const response = await fetch(`http://localhost:3000/transactions/${txHash}/decoded`);
  const decodedTx = await response.json();
  
  if (decodedTx.decoded) {
    console.log(`Function: ${decodedTx.decoded.functionName}`);
    console.log(`Signature: ${decodedTx.decoded.functionSignature}`);
    console.log('Parameters:');
    decodedTx.decoded.params.forEach(param => {
      console.log(`  ${param.name} (${param.type}): ${param.value}`);
    });
  } else {
    console.log('Contract is not verified or transaction is not a contract interaction');
  }
}
```

### Token Balance Tracking

Track token balances for an address:

```javascript
// Example: Tracking token balances
async function getTokenBalances(address) {
  const response = await fetch(`http://localhost:3000/account/${address}/balances`);
  const balances = await response.json();
  
  console.log(`Native Balance: ${balances.native} STO`);
  console.log('Token Balances:');
  balances.tokens.forEach(token => {
    console.log(`  ${token.name} (${token.symbol}): ${token.balance}`);
  });
}
```

### NFT Ownership

Track NFT ownership for an address:

```javascript
// Example: Tracking NFT ownership
async function getNFTs(address) {
  const response = await fetch(`http://localhost:3000/address/${address}/nfts`);
  const nfts = await response.json();
  
  console.log(`NFTs owned by ${address}:`);
  nfts.forEach(nft => {
    console.log(`  Collection: ${nft.collectionName} (${nft.collectionAddress})`);
    console.log(`  Token ID: ${nft.tokenId}`);
    console.log(`  Name: ${nft.metadata.name}`);
    console.log(`  Image: ${nft.metadata.image}`);
  });
}
```

### Custom Indexing

If you need to index additional data or create custom endpoints, you can extend the indexer by adding new services and API endpoints. The modular architecture makes it easy to add new functionality.

### Webhooks and Notifications

You can implement webhooks and notifications by subscribing to specific events or addresses and triggering actions when new data is indexed.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
Contact: office@studio-blockchain.com
Lead developer: laurent@studio-blockchain.com
