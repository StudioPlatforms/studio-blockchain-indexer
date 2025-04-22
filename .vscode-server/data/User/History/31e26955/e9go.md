# Contract Verification Details Endpoint

This document describes the new contract verification details endpoint that has been added to the Studio Blockchain Indexer.

## Overview

A new API endpoint has been added to provide comprehensive verification details for verified contracts:

- **Endpoint**: `/contracts/{address}/verification`
- **Method**: GET
- **Description**: Retrieve detailed verification information for a verified contract.

This endpoint returns all the verification details for a contract, including:

- Contract name
- Compiler version
- License (extracted from source code)
- Optimization settings (whether optimization was used and number of runs)
- EVM version
- Constructor arguments
- Libraries used
- Verification timestamp
- Metadata hash (extracted from bytecode)
- Creation information (creator, block number, timestamp, transaction hash)

## Implementation Details

### New Files

- `src/services/api/contracts-verification.ts` - Implements the contract verification details endpoint
- `test-contract-verification-details.js` - Script to test the new endpoint
