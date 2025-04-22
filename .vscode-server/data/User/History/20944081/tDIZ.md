# Large Contract Verification Support

This document describes the enhancements made to the Studio Blockchain Indexer to support verification of large, complex contracts like Uniswap v3.

## Changes Made

1. **Increased Source Code Size Limit**
   - Increased the maximum source code size from 1MB to 10MB
   - Modified in `src/services/verification/index.ts`

2. **Enhanced Import Handler**
   - Added support for npm module imports (like @uniswap/ and @openzeppelin/)
   - Added support for standard libraries
   - Improved path normalization
   - Added automatic initialization of common libraries
   - Modified in `src/services/verification/import-handler.ts`

3. **Improved API Endpoint**
   - Added support for multi-part verification
   - Added special handling for Uniswap contracts
   - Improved error handling
   - Modified in `src/services/api/contracts-verification.ts`

## Using Multi-Part Verification

For large contracts like Uniswap v3, you can now use multi-part verification:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "compilerVersion": "0.7.6",
  "contractName": "UniswapV3Factory",
  "optimizationUsed": true,
  "runs": 1000,
  "evmVersion": "istanbul",
  "isMultiPart": true,
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity =0.7.6;\n...",
    "interfaces/IUniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.7.5;\n...",
    "interfaces/IUniswapV3Pool.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.7.5;\n..."
  }
}
```

## Special Handling for Uniswap Contracts

The system now automatically detects Uniswap contracts and:

1. Installs Uniswap dependencies if needed
2. Sets up special import handling for Uniswap libraries
3. Uses appropriate EVM version for Uniswap contracts

## Verifying Uniswap v3 Core Contracts

To verify Uniswap v3 core contracts:

1. Use compiler version 0.7.6
2. Use EVM version "istanbul"
3. Enable optimization with 1000 runs
4. Use multi-part verification with all source files

Example for UniswapV3Factory:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "compilerVersion": "0.7.6",
  "contractName": "UniswapV3Factory",
  "optimizationUsed": true,
  "runs": 1000,
  "evmVersion": "istanbul",
  "isMultiPart": true,
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity =0.7.6;\n...",
    "interfaces/IUniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.7.5;\n...",
    "interfaces/IUniswapV3Pool.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.7.5;\n...",
    "libraries/FullMath.sol": "// SPDX-License-Identifier: MIT\npragma solidity >=0.4.0;\n...",
    "libraries/TickMath.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.5.0;\n..."
  }
}
```

## Verifying Uniswap v3 Periphery Contracts

To verify Uniswap v3 periphery contracts:

1. Use compiler version 0.7.6
2. Use EVM version "istanbul"
3. Enable optimization with 1000 runs
4. Use multi-part verification with all source files
5. Include library addresses if needed

Example for SwapRouter:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "compilerVersion": "0.7.6",
  "contractName": "SwapRouter",
  "optimizationUsed": true,
  "runs": 1000,
  "evmVersion": "istanbul",
  "isMultiPart": true,
  "sourceFiles": {
    "SwapRouter.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity =0.7.6;\n...",
    "interfaces/ISwapRouter.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.7.5;\n...",
    "libraries/Path.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity >=0.6.0;\n..."
  }
}
```

## Troubleshooting

If you encounter issues verifying large contracts:

1. **Check the logs**: Look for specific error messages in the logs
2. **Try flattening**: If multi-part verification fails, try flattening the contract
3. **Verify dependencies**: Make sure all dependencies are correctly installed
4. **Check EVM version**: Use the correct EVM version for the contract
5. **Check compiler version**: Use the exact compiler version used for deployment

## Future Improvements

Potential future improvements include:

1. **Streaming verification**: Process large contracts in chunks
2. **Automatic flattening**: Automatically flatten contracts if needed
3. **Dependency resolution**: Automatically resolve and install dependencies
4. **Memory optimization**: Optimize memory usage during compilation
