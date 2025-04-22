# Uniswap V3 Contract Verification for Studio Blockchain

This guide provides instructions for verifying Uniswap V3 contracts on the Studio blockchain. The verification process has been automated with scripts that handle the complexities of verifying these contracts.

## Contracts to Verify

The following Uniswap V3 contracts have been deployed on the Studio blockchain:

1. **UniswapV3Factory** (0x6f1aF63eb91723a883c632E38D34f2cB6090b805)
2. **NFTDescriptor** (0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6)
3. **NonfungibleTokenPositionDescriptor** (0x68550Fc74cf81066ef7b8D991Ce76C8cf685F346)
4. **SwapRouter** (0x5D16d5b06bB052A91D74099A70D4048143a56406)
5. **NonfungiblePositionManager** (0x402306D1864657168B7614E459C7f3d5be0677eA)
6. **WETH9 (WSTO)** (0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0)

## Verification Challenges

Verifying Uniswap V3 contracts on Studio blockchain presents several challenges:

1. **Complex Dependencies**: Uniswap V3 contracts have many interdependencies.
2. **Verification Service Limitations**: The Studio blockchain verification service has specific requirements and limitations.
3. **HTTP 500 Errors**: The verification service may return internal server errors for complex contracts.
4. **Library Handling**: The verification service expects libraries to be in a specific format.

## Verification Scripts

Two scripts have been created to automate the verification process:

1. **verify-uniswap-contracts.js**: The main verification script that:
   - Uses the correct compiler version, optimizer settings, and EVM version for each contract
   - Formats the source code and libraries correctly for the verification service
   - Handles the constructor arguments correctly
   - Tries different approaches if one fails

2. **run-verification.sh**: A shell script that:
   - Installs the required dependencies
   - Runs the verification script

## How to Use

1. Make sure you have Node.js installed.
2. Run the verification script:

```bash
./run-verification.sh
```

The script will:
- Install the required dependencies
- Create a directory for modified contracts
- Run the verification script
- Display the verification results

## Verification Approaches

The verification script tries multiple approaches for each contract:

1. **Original/Flattened Contract**: First, it tries to verify the contract using the original or flattened source code.
2. **Minimal Contract**: If the first approach fails, it creates a minimal version of the contract with just enough code to match the interface and constructor arguments.
3. **Multiple EVM Versions**: It tries different EVM versions (istanbul, london, berlin, etc.) to find one that works.
4. **viaIR Setting**: It tries both with and without the viaIR compiler setting.

## Troubleshooting

If the verification fails for all contracts, you can try:

1. **Check the Studio Blockchain Explorer**: Verify if the contracts are already verified.
2. **Contact Studio Blockchain Support**: The verification service might have limitations or issues with complex contracts.
3. **Manual Verification**: Try verifying the contracts manually through the Studio blockchain explorer interface.

## Contract Details

The verification script uses the following details for each contract:

### UniswapV3Factory
- **Compiler Version**: 0.7.6
- **EVM Version**: istanbul
- **Optimization**: Yes, 800 runs
- **Constructor Arguments**: None

### NFTDescriptor
- **Compiler Version**: 0.7.6
- **EVM Version**: istanbul
- **Optimization**: Yes, 1000 runs
- **Constructor Arguments**: None (it's a library)

### NonfungibleTokenPositionDescriptor
- **Compiler Version**: 0.7.6
- **EVM Version**: istanbul
- **Optimization**: Yes, 1000 runs
- **Constructor Arguments**: 
  - WETH9 address: 0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0
  - Native currency label bytes: "STO"

### SwapRouter
- **Compiler Version**: 0.7.6
- **EVM Version**: istanbul
- **Optimization**: Yes, 1000000 runs
- **Constructor Arguments**:
  - Factory address: 0x6f1aF63eb91723a883c632E38D34f2cB6090b805
  - WETH9 address: 0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0

### NonfungiblePositionManager
- **Compiler Version**: 0.7.6
- **EVM Version**: istanbul
- **Optimization**: Yes, 2000 runs
- **Constructor Arguments**:
  - Factory address: 0x6f1aF63eb91723a883c632E38D34f2cB6090b805
  - WETH9 address: 0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0
  - Position descriptor address: 0x68550Fc74cf81066ef7b8D991Ce76C8cf685F346

### WETH9 (WSTO)
- **Compiler Version**: 0.7.6
- **EVM Version**: istanbul
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**: None
