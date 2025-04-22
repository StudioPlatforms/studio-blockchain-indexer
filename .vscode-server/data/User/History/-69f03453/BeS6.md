# UniswapV3Factory Contract Verification Recommendations

This document provides recommendations for verifying the UniswapV3Factory contract on the Studio Blockchain Mainnet Indexer.

## Overview

We attempted to verify the UniswapV3Factory contract at address `0x6f1aF63eb91723a883c632E38D34f2cB6090b805` using a simplified version of the contract, but the verification failed with the error "Bytecode verification failed. The compiled bytecode does not match the on-chain bytecode."

## Analysis

Based on our analysis of the mainnet-indexer codebase, we understand that the contract verification process works as follows:

1. The user submits a verification request with the contract address, source code, compiler version, and other compilation settings.
2. The system checks if the address is a valid contract on the blockchain.
3. The system validates the constructor arguments.
4. The system compiles the source code with the specified settings.
5. The system compares the compiled bytecode with the on-chain bytecode.
6. If the bytecodes match, the contract is marked as verified, and the source code, ABI, and compilation settings are stored in the database.

Our verification attempt failed at step 5, indicating that the compiled bytecode did not match the on-chain bytecode. This could be due to several reasons:

1. The source code we used is not the exact source code that was used to deploy the contract.
2. The compiler version we specified is not the exact compiler version that was used to deploy the contract.
3. The optimization settings we specified are not the exact optimization settings that were used to deploy the contract.
4. The EVM version we specified is not the exact EVM version that was used to deploy the contract.
5. The constructor arguments we provided are not the exact constructor arguments that were used to deploy the contract.
6. The libraries we specified are not the exact libraries that were used to deploy the contract.

## Recommendations

To successfully verify the UniswapV3Factory contract, we recommend the following steps:

1. **Use the Original Source Code**: Obtain the exact source code that was used to deploy the contract. This should include all dependencies and imports.

2. **Use the Original Compiler Version**: Determine the exact compiler version that was used to deploy the contract. This can often be found in the project's `package.json` or `hardhat.config.js` file.

3. **Use the Original Optimization Settings**: Determine the exact optimization settings that were used to deploy the contract. This can often be found in the project's `hardhat.config.js` file.

4. **Use the Original EVM Version**: Determine the exact EVM version that was used to deploy the contract. This can often be found in the project's `hardhat.config.js` file.

5. **Use the Original Constructor Arguments**: Determine the exact constructor arguments that were used to deploy the contract. This can often be found in the deployment script or transaction data.

6. **Use the Original Libraries**: Determine the exact libraries that were used by the contract. This can often be found in the deployment script or transaction data.

7. **Flatten the Source Code**: If the contract uses imports, flatten the source code to include all dependencies in a single file. This can be done using tools like `hardhat-flattener` or `truffle-flattener`.

8. **Submit the Verification Request**: Submit the verification request with the exact source code, compiler version, optimization settings, EVM version, constructor arguments, and libraries that were used to deploy the contract.

## Specific Recommendations for UniswapV3Factory

Based on our analysis of the Uniswap v3-core repository, we recommend the following specific settings for verifying the UniswapV3Factory contract:

1. **Source Code**: Use the flattened source code of the UniswapV3Factory contract, including all dependencies.

2. **Compiler Version**: Use Solidity version 0.7.6, as specified in the `hardhat.config.ts` file.

3. **Optimization Settings**: Enable optimization with 800 runs, as specified in the `hardhat.config.ts` file.

4. **EVM Version**: Use EVM version "berlin", as specified in the `hardhat.config.ts` file.

5. **Constructor Arguments**: The UniswapV3Factory contract does not have constructor arguments, so this should be an empty string.

6. **Libraries**: The UniswapV3Factory contract does not use external libraries, so this should be an empty object.

## Conclusion

Verifying the UniswapV3Factory contract requires using the exact source code, compiler version, optimization settings, EVM version, constructor arguments, and libraries that were used to deploy the contract. By following the recommendations in this document, you should be able to successfully verify the contract on the Studio Blockchain Mainnet Indexer.
