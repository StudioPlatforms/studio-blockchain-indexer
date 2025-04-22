# Large Contract Verification Support

This document describes the enhancements made to the Studio Blockchain Indexer to support verification of large, complex contracts like Uniswap v3.

## Changes Made

1. **Increased Source Code Size Limit**
   - Increased the maximum source code size from 1MB to 10MB
   - Modified in `src/services/verification/index.ts`

2. **Enhanced Import Handler**
   - Improved path normalization for better import resolution
   - Added support for handling relative imports
   - Modified in `src/services/verification/import-handler.ts`

3. **Improved API Endpoint**
   - Added support for multi-part verification
   - Added special logging for complex contracts
   - Improved error handling with detailed error messages
   - Added support for verifying contracts not yet in the database
   - Modified in `src/services/api/contracts-verification.ts`

4. **Auto-Adding Contracts**
   - The system now automatically adds contracts to the database if they exist on the blockchain but not in the database
   - This allows verification of any valid contract without requiring it to be indexed first
   - Modified in `src/services/api/contracts-verification.ts`

## Using Multi-Part Verification

For large contracts like Uniswap v3, you can now use multi-part verification by submitting all source files in a single request:

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

The system will:
1. Use the file with the contract name as the main source file
2. Add all other files as import mappings
3. Compile the contract with all dependencies included

## How Multi-Part Verification Works

When you submit a multi-part verification request:

1. The system identifies the main contract file (the one containing the contract you're verifying)
2. All other files are registered as import mappings
3. When the compiler encounters an import statement, it looks up the file in the import mappings
4. This allows complex contracts with multiple dependencies to be verified in a single request

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
  },
  "libraries": {
    "TickMath": "0x1234567890123456789012345678901234567890"
  }
}
```

## Troubleshooting

If you encounter issues verifying large contracts:

1. **Check the error details**: The API now returns detailed error messages to help diagnose issues
2. **Try flattening**: If multi-part verification fails, try flattening the contract
3. **Verify import paths**: Make sure all import paths in your source code match the keys in your sourceFiles object
4. **Check EVM version**: Use the correct EVM version for the contract
5. **Check compiler version**: Use the exact compiler version used for deployment
6. **Check optimization settings**: Use the same optimization settings as during deployment
7. **Memory issues**: For very large contracts, the server might run out of memory. Try breaking the contract into smaller parts or use a flattened version.

## Specific Guidance for Uniswap v3 Contracts

Uniswap v3 contracts are particularly challenging to verify due to their complexity and size. Here are specific recommendations for verifying these contracts:

### UniswapV3Factory (v3-core)

1. **Compiler Version**: 0.7.6
2. **EVM Version**: istanbul
3. **Optimization**: Enabled with 1000 runs
4. **Required Files**:
   - UniswapV3Factory.sol (main file)
   - interfaces/IUniswapV3Factory.sol
   - interfaces/IUniswapV3Pool.sol
   - UniswapV3Pool.sol (referenced by the factory)

Example verification request:
```json
{
  "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "compilerVersion": "0.7.6",
  "contractName": "UniswapV3Factory",
  "optimizationUsed": true,
  "runs": 1000,
  "evmVersion": "istanbul",
  "isMultiPart": true,
  "sourceFiles": {
    "UniswapV3Factory.sol": "// SPDX-License-Identifier: GPL-2.0-or-later\npragma solidity =0.7.6;\n...",
    "interfaces/IUniswapV3Factory.sol": "...",
    "interfaces/IUniswapV3Pool.sol": "...",
    "UniswapV3Pool.sol": "..."
  }
}
```

### UniswapV3Pool (v3-core)

1. **Compiler Version**: 0.7.6
2. **EVM Version**: istanbul
3. **Optimization**: Enabled with 1000 runs
4. **Required Files**:
   - UniswapV3Pool.sol (main file)
   - interfaces/IUniswapV3Pool.sol
   - interfaces/callback/IUniswapV3SwapCallback.sol
   - interfaces/callback/IUniswapV3MintCallback.sol
   - interfaces/callback/IUniswapV3FlashCallback.sol
   - libraries/LowGasSafeMath.sol
   - libraries/SafeCast.sol
   - libraries/Tick.sol
   - libraries/TickBitmap.sol
   - libraries/Position.sol
   - libraries/Oracle.sol
   - libraries/FullMath.sol
   - libraries/FixedPoint96.sol
   - libraries/FixedPoint128.sol
   - libraries/SqrtPriceMath.sol
   - libraries/SwapMath.sol
   - libraries/UnsafeMath.sol

### NonfungiblePositionManager (v3-periphery)

1. **Compiler Version**: 0.7.6
2. **EVM Version**: istanbul
3. **Optimization**: Enabled with 1000 runs
4. **Required Files**:
   - NonfungiblePositionManager.sol (main file)
   - interfaces/INonfungiblePositionManager.sol
   - libraries/PositionValue.sol
   - libraries/PoolAddress.sol
   - base/LiquidityManagement.sol
   - base/PeripheryImmutableState.sol
   - base/Multicall.sol
   - base/ERC721Permit.sol
   - base/PeripheryValidation.sol
   - base/SelfPermit.sol
   - libraries/TransferHelper.sol
   - interfaces/external/IERC721Metadata.sol
   - interfaces/IUniswapV3Factory.sol (from v3-core)
   - interfaces/IUniswapV3Pool.sol (from v3-core)

### Common Issues with Uniswap v3 Verification

1. **Missing Dependencies**: Ensure all required files are included in the sourceFiles object
2. **Import Path Mismatches**: Make sure the import paths in your source code match the keys in your sourceFiles object
3. **Compiler Version**: Use exactly 0.7.6, not 0.7.5 or 0.7.7
4. **EVM Version**: Use "istanbul" for Uniswap v3 contracts
5. **Optimization Settings**: Use optimization with 1000 runs
6. **Library Addresses**: For some periphery contracts, you may need to provide the addresses of deployed libraries

## Future Improvements

Potential future improvements include:

1. **Streaming verification**: Process large contracts in chunks
2. **Automatic flattening**: Automatically flatten contracts if needed
3. **Import path resolution**: Better handling of complex import paths
4. **Memory optimization**: Optimize memory usage during compilation
5. **Specific templates**: Pre-configured templates for common contract types like Uniswap v3
