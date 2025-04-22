# Studio Blockchain Mainnet Indexer Analysis

This repository contains an analysis of the Studio Blockchain Mainnet Indexer, with a focus on contract verification.

## Overview

The Studio Blockchain Mainnet Indexer is a service that indexes the Studio Blockchain and provides API endpoints for the explorer frontend. It allows users to explore blocks, transactions, contracts, and tokens on the blockchain, as well as verify and interact with smart contracts.

## Documents

This repository contains the following documents:

1. **[mainnet-indexer-summary.md](mainnet-indexer-summary.md)**: A summary of the Studio Blockchain Mainnet Indexer, including its architecture, components, and functionality.

2. **[mainnet-indexer-database-schema.md](mainnet-indexer-database-schema.md)**: A detailed description of the database schema used by the Studio Blockchain Mainnet Indexer, with a focus on the tables and columns used for contract verification.

3. **[contract-verification-process.md](contract-verification-process.md)**: A detailed explanation of the contract verification process in the Studio Blockchain Mainnet Indexer, including the verification service, API endpoints, and error handling.

4. **[mainnet-indexer-final-summary.md](mainnet-indexer-final-summary.md)**: A comprehensive summary of the Studio Blockchain Mainnet Indexer, with a focus on contract verification.

5. **[uniswap-verification-recommendations.md](uniswap-verification-recommendations.md)**: Recommendations for verifying the UniswapV3Factory contract on the Studio Blockchain Mainnet Indexer.

## Scripts

This repository also contains the following scripts:

1. **[analyze-indexer.js](analyze-indexer.js)**: A script that analyzes the structure of the mainnet-indexer and identifies files related to contract verification.

2. **[analyze-database-schema.js](analyze-database-schema.js)**: A script that analyzes the database schema of the mainnet-indexer and identifies tables and columns related to contract verification.

3. **[verify-uniswap/get-bytecode.js](verify-uniswap/get-bytecode.js)**: A script that attempts to get the bytecode of the UniswapV3Factory contract using ethers.js.

4. **[verify-uniswap/get-bytecode-api.js](verify-uniswap/get-bytecode-api.js)**: A script that attempts to get the bytecode of the UniswapV3Factory contract using the mainnet-indexer API.

5. **[verify-uniswap/verify-direct.js](verify-uniswap/verify-direct.js)**: A script that attempts to verify the UniswapV3Factory contract using the mainnet-indexer API.

## Conclusion

The Studio Blockchain Mainnet Indexer is a comprehensive service that indexes the Studio Blockchain and provides API endpoints for the explorer frontend. It allows users to explore blocks, transactions, contracts, and tokens on the blockchain, as well as verify and interact with smart contracts.

The contract verification process is a key feature of the mainnet-indexer, enabling users to verify that a deployed smart contract's bytecode matches the source code that was used to compile it. This allows users to view and interact with the source code of a contract, rather than just the bytecode.

Our attempt to verify the UniswapV3Factory contract failed because the compiled bytecode did not match the on-chain bytecode. To successfully verify the contract, we need to use the exact source code, compiler version, optimization settings, EVM version, constructor arguments, and libraries that were used to deploy the contract.
