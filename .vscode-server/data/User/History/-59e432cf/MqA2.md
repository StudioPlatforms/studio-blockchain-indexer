# Studio Blockchain Mainnet Indexer

This repository contains the Studio Blockchain Mainnet Indexer, which is responsible for indexing and providing API access to blockchain data. It also includes tools for contract verification, including a recent enhancement to support contract imports.

## Directory Structure

- `/root/mainnet-indexer`: The main indexer codebase
  - `/src`: Source code for the indexer
    - `/services`: Services for different aspects of the indexer
      - `/api`: API services for different endpoints
      - `/blockchain`: Blockchain interaction services
      - `/database`: Database services
      - `/indexer`: Indexing services
      - `/verification`: Contract verification services
    - `/utils`: Utility functions
    - `/config`: Configuration files
- `/root/archive-for-verification`: Uniswap V3 contract files for verification
- `/root/modified-contracts`: Modified contract files for verification
- `/root/uniswap-imports`: Directory for Uniswap import files

## Scripts

- `run-verification.sh`: Run the original verification script
- `apply-verification-fix.sh`: Apply the verification fix to the indexer
- `run-verification-with-imports.sh`: Run the verification with import support
- `verify-uniswap-contracts.js`: Original verification script
- `verify-uniswap-with-imports.js`: Verification script with import support

## Documentation

- `verification-guide-updated.md`: Guide for using the verification system with import support
- `verification-fix-summary.md`: Summary of the verification fix
- `studio-verification-urls.md`: URLs for the Studio blockchain verification service
- `hardhat-contract-verification-guide.md`: Guide for verifying contracts with Hardhat
- `quick-verification-guide.md`: Quick guide for contract verification

## Contract Verification

The contract verification system has been enhanced to support contract imports, which is essential for verifying complex contracts like Uniswap V3 that rely on multiple imported files. The key improvements include:

1. **Import Handler**: A new component that resolves import paths and provides file content to the Solidity compiler.
2. **Import Mappings**: The ability to provide mappings from import paths to file content in verification requests.
3. **Enhanced API**: The verification API now accepts import mappings as part of the verification request.

### Using the Verification System

1. Apply the verification fix:
   ```bash
   ./apply-verification-fix.sh
   ```

2. Run the verification with import support:
   ```bash
   ./run-verification-with-imports.sh
   ```

3. Or manually verify contracts by providing import mappings in the verification request.

For more details, see the [Verification Guide](verification-guide-updated.md) and the [Verification Fix Summary](verification-fix-summary.md).

## Uniswap V3 Contracts

The Uniswap V3 contracts deployed on the Studio blockchain are:

