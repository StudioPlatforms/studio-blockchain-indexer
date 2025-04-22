# Uniswap V3 Deployment and Verification for Studio Blockchain

This repository contains scripts for deploying and verifying Uniswap V3 contracts on the Studio blockchain.

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Access to the Studio blockchain RPC endpoint

## Setup

1. Clone this repository
2. Install dependencies:

```bash
cd deployment
npm install
```

## Contract Deployment

The deployment script will deploy the following contracts:

1. UniswapV3Factory
2. NFTDescriptor (library)
3. NonfungibleTokenPositionDescriptor
4. NonfungiblePositionManager
5. SwapRouter

To deploy the contracts, run:

```bash
npx hardhat run scripts/deploy.js --network studio
```

The script will output the addresses of the deployed contracts and the constructor arguments for verification.

## Contract Verification

### Step 1: Generate Verification Payloads

After deploying the contracts, you need to generate the verification payloads:

```bash
node scripts/generate-verification-payloads.js
```

This will create JSON files in the `verification-payloads` directory for each contract.

### Step 2: Verify Contracts

To verify all contracts in the correct order:

```bash
node scripts/verify-contracts.js
```

To verify a specific contract:

```bash
node scripts/verify-contracts.js UniswapV3Factory
```

The script will try different verification approaches if the initial attempt fails.

## Troubleshooting Verification

If verification fails, try the following:

1. Check the error message for clues about what went wrong
2. Try verifying with a simplified payload (the script does this automatically)
3. Try flattening the contract and verifying with the flattened source code:

```bash
npx hardhat flatten contracts/UniswapV3Factory.sol > flattened/UniswapV3Factory.sol
```

Then manually submit the flattened source code to the verification API.

## Contract Addresses

The following contracts have been deployed to the Studio blockchain:

- WSTO (Wrapped STO): `0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0` (pre-existing)
- UniswapV3Factory: `0x6f1aF63eb91723a883c632E38D34f2cB6090b805`
- NFTDescriptor: `0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6`
- NonfungibleTokenPositionDescriptor: `0x68550Fc74cf81066ef7b8D991Ce76C8cf685F346`
- NonfungiblePositionManager: `0x402306D1864657168B7614E459C7f3d5be0677eA`
- SwapRouter: `0x5D16d5b06bB052A91D74099A70D4048143a56406`

## Constructor Arguments for Verification

- SwapRouter: `0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db0`
- NonfungibleTokenPositionDescriptor: `0000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db053544f0000000000000000000000000000000000000000000000000000000000`
- NonfungiblePositionManager: `0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db000000000000000000000000068550fc74cf81066ef7b8d991ce76c8cf685f346`

## Libraries

- NonfungibleTokenPositionDescriptor uses NFTDescriptor at `0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6`

## Verification Details

All contracts were compiled with:
- Solidity version: 0.7.6
- Optimization: Enabled (200 runs)
- EVM version: istanbul

## Indexer Improvements

The following improvements were made to the indexer to better handle complex contract verifications:

1. Enhanced import resolution in the verification service
2. Improved error logging for better debugging
3. Added support for multi-part verification with complex import structures
4. Better handling of constructor arguments and libraries

These improvements allow the indexer to successfully verify complex contracts like Uniswap V3.
