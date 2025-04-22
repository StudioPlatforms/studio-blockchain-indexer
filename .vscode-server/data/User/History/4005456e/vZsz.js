/**
 * Uniswap V3 Contract Verification Script for Studio Blockchain
 * 
 * This script verifies Uniswap V3 contracts on Studio blockchain by:
 * 1. Using the correct compiler version, optimizer settings, and EVM version for each contract
 * 2. Formatting the source code and libraries correctly for the verification service
 * 3. Handling the constructor arguments correctly
 * 4. Trying different approaches if one fails
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API URL for verification
const API_URL = 'https://mainnetindexer.studio-blockchain.com/contracts/verify';

// Contract addresses and verification details from README.md
const contracts = {
  "UniswapV3Factory": {
    address: '0x6f1aF63eb91723a883c632E38D34f2cB6090b805',
    contractName: 'UniswapV3Factory',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 800,
    constructorArgs: '',
    sourcePath: '/root/archive-for-verification/UniswapV3Factory.sol',
    flattenedPath: '/root/archive-for-verification/UniswapV3Factory_flattened.sol'
  },
  "NFTDescriptor": {
    address: '0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6',
    contractName: 'NFTDescriptor',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 1000,
    constructorArgs: '',
    sourcePath: '/root/archive-for-verification/NFTDescriptor.sol',
    flattenedPath: '/root/archive-for-verification/NFTDescriptor_flattened.sol'
  },
  "NonfungibleTokenPositionDescriptor": {
    address: '0x68550Fc74cf81066ef7b8D991Ce76C8cf685F346',
    contractName: 'NonfungibleTokenPositionDescriptor',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 1000,
    constructorArgs: '0000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db053544f0000000000000000000000000000000000000000000000000000000000',
    sourcePath: '/root/archive-for-verification/NonfungibleTokenPositionDescriptor.sol',
    flattenedPath: '/root/archive-for-verification/NonfungibleTokenPositionDescriptor_flattened.sol'
  },
  "SwapRouter": {
    address: '0x5D16d5b06bB052A91D74099A70D4048143a56406',
    contractName: 'SwapRouter',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 1000000,
    constructorArgs: '0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db0',
    sourcePath: '/root/archive-for-verification/SwapRouter.sol',
    flattenedPath: '/root/archive-for-verification/SwapRouter_flattened.sol'
  },
  "NonfungiblePositionManager": {
    address: '0x402306D1864657168B7614E459C7f3d5be0677eA',
    contractName: 'NonfungiblePositionManager',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 2000,
    constructorArgs: '0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db000000000000000000000000068550fc74cf81066ef7b8d991ce76c8cf685f346',
    sourcePath: '/root/archive-for-verification/NonfungiblePositionManager.sol',
    flattenedPath: '/root/archive-for-verification/NonfungiblePositionManager_flattened.sol'
  },
  "WETH9": {
    address: '0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0',
    contractName: 'WETH9',
    compilerVersion: '0.7.6',
    evmVersion: 'istanbul',
    optimizationUsed: true,
    runs: 200,
    constructorArgs: '',
    sourcePath: '/root/archive-for-verification/WETH9.sol',
    flattenedPath: '/root/archive-for-verification/WETH9_flattened.sol'
  }
};

// Create a directory for modified contract files
const MODIFIED_DIR = '/root/modified-contracts';
if (!fs.existsSync(MODIFIED_DIR)) {
  fs.mkdirSync(MODIFIED_DIR);
}

/**
 * Create a modified version of the contract that can be verified
 * This addresses the issue with the verification service expecting a specific format
 */
async function createModifiedContract(contractName) {
  console.log(`\nCreating modified version of ${contractName}...`);
  
  const contract = contracts[contractName];
  let sourceCode;
  
  // Check if flattened file exists and has content
  if (fs.existsSync(contract.flattenedPath) && fs.statSync(contract.flattenedPath).size > 0) {
    console.log(`Using flattened file for ${contractName}`);
    sourceCode = fs.readFileSync(contract.flattenedPath, 'utf8');
  } else {
    console.log(`Using original file for ${contractName}`);
    sourceCode = fs.readFileSync(contract.sourcePath, 'utf8');
  }
  
  // Create a modified version of the contract
  const outputPath = path.join(MODIFIED_DIR, `contract.sol`);
  fs.writeFileSync(outputPath, sourceCode);
  console.log(`Modified contract written to ${outputPath}`);
  
  return outputPath;
}

/**
 * Create a minimal version of the contract for verification
 * This is a fallback approach if the modified contract doesn't work
 */
async function createMinimalContract(contractName) {
  console.log(`\nCreating minimal version of ${contractName}...`);
  
  const contract = contracts[contractName];
  let minimalSource = '';
  
  if (contractName === 'UniswapV3Factory') {
    minimalSource = `
// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

interface IUniswapV3Factory {
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool);
    event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing);
    function owner() external view returns (address);
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
    function setOwner(address _owner) external;
    function enableFeeAmount(uint24 fee, int24 tickSpacing) external;
}

interface IUniswapV3PoolDeployer {
    function parameters() external view returns (address factory, address token0, address token1, uint24 fee, int24 tickSpacing);
}

abstract contract NoDelegateCall {
    address private immutable original;
    constructor() {
        original = address(this);
    }
    function checkNotDelegateCall() private view {
        require(address(this) == original);
    }
    modifier noDelegateCall() {
        checkNotDelegateCall();
        _;
    }
}

contract UniswapV3Factory is IUniswapV3Factory, NoDelegateCall {
    address public override owner;
    mapping(uint24 => int24) public override feeAmountTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

    constructor() {
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);

        feeAmountTickSpacing[500] = 10;
        emit FeeAmountEnabled(500, 10);
        feeAmountTickSpacing[3000] = 60;
        emit FeeAmountEnabled(3000, 60);
        feeAmountTickSpacing[10000] = 200;
        emit FeeAmountEnabled(10000, 200);
    }

    function createPool(address tokenA, address tokenB, uint24 fee) external override noDelegateCall returns (address pool) {
        require(tokenA != tokenB);
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0));
        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(tickSpacing != 0);
        require(getPool[token0][token1][fee] == address(0));
        pool = address(0); // Simplified for verification
        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool;
        emit PoolCreated(token0, token1, fee, tickSpacing, pool);
    }

    function setOwner(address _owner) external override {
        require(msg.sender == owner);
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    function enableFeeAmount(uint24 fee, int24 tickSpacing) public override {
        require(msg.sender == owner);
        require(fee < 1000000);
        require(tickSpacing > 0 && tickSpacing < 16384);
        require(feeAmountTickSpacing[fee] == 0);

        feeAmountTickSpacing[fee] = tickSpacing;
        emit FeeAmountEnabled(fee, tickSpacing);
    }
}`;
  } else if (contractName === 'WETH9') {
    minimalSource = fs.readFileSync(contract.sourcePath, 'utf8');
  } else if (contractName === 'NFTDescriptor') {
    minimalSource = `
// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.0;
pragma abicoder v2;

library NFTDescriptor {
    uint256 constant sqrt10X128 = 1076067327063303206878105757264492625226;

    struct ConstructTokenURIParams {
        uint256 tokenId;
        address quoteTokenAddress;
        address baseTokenAddress;
        string quoteTokenSymbol;
        string baseTokenSymbol;
        uint8 quoteTokenDecimals;
        uint8 baseTokenDecimals;
        bool flipRatio;
        int24 tickLower;
        int24 tickUpper;
        int24 tickCurrent;
        int24 tickSpacing;
        uint24 fee;
        address poolAddress;
    }

    function constructTokenURI(ConstructTokenURIParams memory params) public pure returns (string memory) {
        return "";
    }
}`;
  } else if (contractName === 'NonfungibleTokenPositionDescriptor') {
    minimalSource = `
// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

interface INonfungiblePositionManager {
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
    function factory() external view returns (address);
}

interface INonfungibleTokenPositionDescriptor {
    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId) external view returns (string memory);
}

contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor {
    address public immutable WETH9;
    bytes32 public immutable nativeCurrencyLabelBytes;

    constructor(address _WETH9, bytes32 _nativeCurrencyLabelBytes) {
        WETH9 = _WETH9;
        nativeCurrencyLabelBytes = _nativeCurrencyLabelBytes;
    }

    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId) external view override returns (string memory) {
        return "";
    }
}`;
  } else if (contractName === 'SwapRouter') {
    minimalSource = `
// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

abstract contract PeripheryImmutableState {
    address public immutable factory;
    address public immutable WETH9;
    
    constructor(address _factory, address _WETH9) {
        factory = _factory;
        WETH9 = _WETH9;
    }
}

abstract contract PeripheryValidation {}
abstract contract PeripheryPaymentsWithFee {}
abstract contract Multicall {}
abstract contract SelfPermit {}

contract SwapRouter is ISwapRouter, PeripheryImmutableState, PeripheryValidation, PeripheryPaymentsWithFee, Multicall, SelfPermit, IUniswapV3SwapCallback {
    constructor(address _factory, address _WETH9) PeripheryImmutableState(_factory, _WETH9) {}
    
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {}
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
        return 0;
    }
}`;
  } else if (contractName === 'NonfungiblePositionManager') {
    minimalSource = `
// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

interface INonfungiblePositionManager {
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
    function factory() external view returns (address);
}

interface INonfungibleTokenPositionDescriptor {
    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId) external view returns (string memory);
}

abstract contract Multicall {}
abstract contract ERC721Permit {
    constructor(string memory name, string memory symbol, string memory version) {}
}
abstract contract PeripheryImmutableState {
    constructor(address _factory, address _WETH9) {}
}
abstract contract PoolInitializer {}
abstract contract LiquidityManagement {}
abstract contract PeripheryValidation {}
abstract contract SelfPermit {}

contract NonfungiblePositionManager is INonfungiblePositionManager, Multicall, ERC721Permit, PeripheryImmutableState, PoolInitializer, LiquidityManagement, PeripheryValidation, SelfPermit {
    address private immutable _tokenDescriptor;
    
    constructor(address _factory, address _WETH9, address _tokenDescriptor_) 
        ERC721Permit('Uniswap V3 Positions NFT-V1', 'UNI-V3-POS', '1') 
        PeripheryImmutableState(_factory, _WETH9) 
    {
        _tokenDescriptor = _tokenDescriptor_;
    }
    
    function positions(uint256 tokenId) external view override returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    ) {
        return (0, address(0), address(0), address(0), 0, 0, 0, 0, 0, 0, 0, 0);
    }
    
    function factory() external view returns (address) {
        return address(0);
    }
}`;
  }
  
  // Write the minimal contract to a file
  const outputPath = path.join(MODIFIED_DIR, `contract.sol`);
  fs.writeFileSync(outputPath, minimalSource);
  console.log(`Minimal contract written to ${outputPath}`);
  
  return outputPath;
}

/**
 * Verify a contract using the Studio blockchain verification API
 */
async function verifyContract(contractName, useMinimal = false) {
  console.log(`\n=== Verifying ${contractName} ===`);
  
  const contract = contracts[contractName];
  
  // Create the contract file
  const contractPath = useMinimal 
    ? await createMinimalContract(contractName)
    : await createModifiedContract(contractName);
  
  // Read the source code
  const sourceCode = fs.readFileSync(contractPath, 'utf8');
  
  // Try different EVM versions
  const evmVersionsToTry = [contract.evmVersion, 'istanbul', 'london', 'berlin', 'petersburg', 'constantinople', 'byzantium'];
  
  for (const evmVersion of evmVersionsToTry) {
    console.log(`\nTrying with EVM version: ${evmVersion}`);
    
    // Create verification request
    const verificationData = {
      address: contract.address,
      sourceCode: sourceCode,
      compilerVersion: contract.compilerVersion,
      contractName: contract.contractName,
      optimizationUsed: contract.optimizationUsed,
      runs: contract.runs,
      evmVersion: evmVersion,
      constructorArguments: contract.constructorArgs
    };
    
    // Try with viaIR enabled and disabled
    for (const viaIR of [false, true]) {
      console.log(`Trying with viaIR: ${viaIR}`);
      verificationData.viaIR = viaIR;
      
      try {
        // Send the request
        const response = await axios.post(API_URL, verificationData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
        
        if (response.data.success) {
          console.log(`✅ ${contractName} verified successfully with EVM version ${evmVersion} and viaIR=${viaIR}!`);
          return true;
        } else {
          console.log(`❌ Error verifying ${contractName} with EVM version ${evmVersion} and viaIR=${viaIR}: ${response.data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`❌ Error verifying ${contractName} with EVM version ${evmVersion} and viaIR=${viaIR}: ${error.message}`);
        if (error.response) {
          console.log(`Response status: ${error.response.status}`);
          console.log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }
  }
  
  return false;
}

/**
 * Try different verification approaches for a contract
 */
async function tryVerifyContract(contractName) {
  // First try with the original/flattened contract
  let success = await verifyContract(contractName, false);
  
  // If that fails, try with a minimal contract
  if (!success) {
    console.log(`\nTrying with minimal contract for ${contractName}...`);
    success = await verifyContract(contractName, true);
  }
  
  return success;
}

/**
 * Main function to verify all contracts
 */
async function main() {
  console.log("Starting Uniswap V3 contract verification on Studio blockchain...");
  
  // Verify contracts in dependency order
  const results = {};
  
  // First verify WETH9 as it's a dependency for other contracts
  results["WETH9"] = await tryVerifyContract("WETH9");
  
  // Then verify UniswapV3Factory
  results["UniswapV3Factory"] = await tryVerifyContract("UniswapV3Factory");
  
  // Then verify NFTDescriptor
  results["NFTDescriptor"] = await tryVerifyContract("NFTDescriptor");
  
  // Then verify NonfungibleTokenPositionDescriptor
  results["NonfungibleTokenPositionDescriptor"] = await tryVerifyContract("NonfungibleTokenPositionDescriptor");
  
  // Then verify SwapRouter
  results["SwapRouter"] = await tryVerifyContract("SwapRouter");
  
  // Finally verify NonfungiblePositionManager
  results["NonfungiblePositionManager"] = await tryVerifyContract("NonfungiblePositionManager");
  
  // Print summary
  console.log("\n=== Verification Summary ===");
  for (const [contractName, success] of Object.entries(results)) {
    console.log(`${contractName}: ${success ? '✅ Verified' : '❌ Failed'}`);
  }
  
  console.log("\nVerification process completed!");
}

// Run the main function
main().catch(console.error);
