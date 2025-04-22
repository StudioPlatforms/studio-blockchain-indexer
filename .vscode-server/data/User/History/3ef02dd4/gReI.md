# New API Endpoints

This document describes the new API endpoints that have been added to the Studio Blockchain Indexer.

## Overview

The following new endpoints have been added:

1. **Statistics Endpoints**
   - `/stats/tps` - Get the current transactions per second (TPS) of the network
   - `/stats/holders` - Get the total number of addresses that hold STO tokens
   - `/stats/validators/payout` - Get the total amount of STO paid to all validators since the beginning
   - `/stats/contracts/count` - Get the total number of deployed smart contracts
   - `/stats/contracts/erc20/count` - Get the total number of ERC20 contracts
   - `/stats/contracts/nft/count` - Get the total number of NFT contracts (ERC721 and ERC1155)

2. **Contract Verification Endpoints**
   - `/contracts/verify` (POST) - Submit contract source code for verification
   - `/contracts/{address}/abi` (GET) - Retrieve the ABI of a verified contract
   - `/contracts/{address}/source` (GET) - Retrieve the source code of a verified contract
   - `/contracts/{address}/interact` (POST) - Interact with a verified contract's functions

## Implementation Details

### New Files

- `src/services/api/stats.ts` - Implements the statistics endpoints
- `migrations/009_contract_verification.sql` - Adds the necessary database schema changes for contract verification
- `API_ENDPOINTS.md` - Documents all the API endpoints
- `apply-migration.sh` - Script to apply the new migration

### Modified Files

- `src/services/api/index.ts` - Updated to register the new StatsApiService
- `src/services/api/contracts.ts` - Added contract verification endpoints

## Database Schema Changes

The following columns have been added to the `contracts` table:

- `verified` (BOOLEAN) - Whether the contract has been verified
- `source_code` (TEXT) - The source code of the contract
- `abi` (JSONB) - The ABI of the contract
- `compiler_version` (TEXT) - The compiler version used to compile the contract
- `optimization_used` (BOOLEAN) - Whether optimization was used when compiling the contract
- `runs` (INTEGER) - The number of optimization runs
- `constructor_arguments` (TEXT) - The constructor arguments used to deploy the contract
- `libraries` (JSONB) - The libraries used by the contract
- `verified_at` (TIMESTAMP) - When the contract was verified

## How to Apply the Changes

1. Copy the migration file to the PostgreSQL container:
   ```bash
   docker cp /root/mainnet-indexer/migrations/009_contract_verification.sql mainnet-indexer_postgres_1:/docker-entrypoint-initdb.d/migrations/
   ```

2. Run the migration script:
   ```bash
   ./apply-migration.sh
   ```

3. Rebuild and restart the indexer:
   ```bash
   cd /root/mainnet-indexer
   docker-compose build indexer
   docker-compose up -d indexer
   ```

## Testing the New Endpoints

You can test the new endpoints using curl:

```bash
# Get the current TPS
curl -s "http://localhost:3000/stats/tps" | jq

# Get the total number of STO holders
curl -s "http://localhost:3000/stats/holders" | jq

# Get the total amount of STO paid to validators
curl -s "http://localhost:3000/stats/validators/payout" | jq

# Get the total number of contracts
curl -s "http://localhost:3000/stats/contracts/count" | jq

# Get the total number of ERC20 contracts
curl -s "http://localhost:3000/stats/contracts/erc20/count" | jq

# Get the total number of NFT contracts
curl -s "http://localhost:3000/stats/contracts/nft/count" | jq

# Verify a contract
curl -s -X POST "http://localhost:3000/contracts/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890123456789012345678901234567890",
    "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }",
    "compilerVersion": "0.8.0",
    "optimizationUsed": true,
    "runs": 200,
    "constructorArguments": "0x...",
    "contractName": "MyContract",
    "libraries": {
      "MyLibrary": "0x1234567890123456789012345678901234567890"
    }
  }' | jq

# Get the ABI of a verified contract
curl -s "http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/abi" | jq

# Get the source code of a verified contract
curl -s "http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/source" | jq

# Interact with a verified contract
curl -s -X POST "http://localhost:3000/contracts/0x1234567890123456789012345678901234567890/interact" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "balanceOf",
    "params": ["0x1234567890123456789012345678901234567890"],
    "value": "0"
  }' | jq
```

## Notes

- The contract verification endpoints require the contract to be deployed on the blockchain.
- The contract verification process is a placeholder implementation. In a real-world scenario, you would need to integrate with a Solidity compiler to verify the contract.
- The statistics endpoints provide approximate values based on the available data in the database.
