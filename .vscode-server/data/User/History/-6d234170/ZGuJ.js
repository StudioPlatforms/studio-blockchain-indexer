const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';
const SOURCE_CODE_PATH = '/root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/UniswapV3Factory.sol';
const COMPILER_VERSION = '0.7.6';
const CONTRACT_NAME = 'UniswapV3Factory';
const OPTIMIZATION_USED = true;
const RUNS = 800;
const EVM_VERSION = 'istanbul';

// Read the source code
const SOURCE_CODE = fs.readFileSync(SOURCE_CODE_PATH, 'utf8');

// Create import mappings for common Uniswap paths
const IMPORT_MAPPINGS = {
    // Map relative imports to absolute paths
    '../v3-core/contracts/interfaces/IUniswapV3Factory.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/IUniswapV3Factory.sol',
    '../v3-core/contracts/interfaces/IUniswapV3PoolDeployer.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/IUniswapV3PoolDeployer.sol',
    '../v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/pool/IUniswapV3PoolImmutables.sol',
    '../v3-core/contracts/interfaces/pool/IUniswapV3PoolState.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/pool/IUniswapV3PoolState.sol',
    '../v3-core/contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol',
    '../v3-core/contracts/interfaces/pool/IUniswapV3PoolActions.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/pool/IUniswapV3PoolActions.sol',
    '../v3-core/contracts/interfaces/pool/IUniswapV3PoolOwnerActions.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/pool/IUniswapV3PoolOwnerActions.sol',
    '../v3-core/contracts/interfaces/pool/IUniswapV3PoolEvents.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/pool/IUniswapV3PoolEvents.sol',
    '../v3-core/contracts/interfaces/IUniswapV3Pool.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/IUniswapV3Pool.sol',
    '../v3-core/contracts/NoDelegateCall.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/NoDelegateCall.sol',
    '../v3-core/contracts/libraries/LowGasSafeMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/LowGasSafeMath.sol',
    '../v3-core/contracts/libraries/SafeCast.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/SafeCast.sol',
    '../v3-core/contracts/libraries/TickMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/TickMath.sol',
    '../v3-core/contracts/libraries/LiquidityMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/LiquidityMath.sol',
    '../v3-core/contracts/libraries/Tick.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/Tick.sol',
    '../v3-core/contracts/libraries/BitMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/BitMath.sol',
    '../v3-core/contracts/libraries/TickBitmap.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/TickBitmap.sol',
    '../v3-core/contracts/libraries/FullMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/FullMath.sol',
    '../v3-core/contracts/libraries/FixedPoint128.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/FixedPoint128.sol',
    '../v3-core/contracts/libraries/Position.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/Position.sol',
    '../v3-core/contracts/libraries/Oracle.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/Oracle.sol',
    '../v3-core/contracts/interfaces/IERC20Minimal.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/IERC20Minimal.sol',
    '../v3-core/contracts/libraries/TransferHelper.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/TransferHelper.sol',
    '../v3-core/contracts/libraries/UnsafeMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/UnsafeMath.sol',
    '../v3-core/contracts/libraries/FixedPoint96.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/FixedPoint96.sol',
    '../v3-core/contracts/libraries/SqrtPriceMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/SqrtPriceMath.sol',
    '../v3-core/contracts/libraries/SwapMath.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/libraries/SwapMath.sol',
    '../v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/callback/IUniswapV3MintCallback.sol',
    '../v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/callback/IUniswapV3SwapCallback.sol',
    '../v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/interfaces/callback/IUniswapV3FlashCallback.sol',
    '../v3-core/contracts/UniswapV3Pool.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/UniswapV3Pool.sol',
    '../v3-core/contracts/UniswapV3PoolDeployer.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/UniswapV3PoolDeployer.sol',
    '../v3-core/contracts/UniswapV3Factory.sol': '/root/uniswap-v3-contracts/archive-for-verification/v3-core-contracts/UniswapV3Factory.sol'
};

// Function to check if the contract exists in the database
async function checkContractExists() {
    try {
        const response = await axios.get(`${API_URL}/contracts/${CONTRACT_ADDRESS}`);
        return response.status === 200;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.error('Contract not found in database. Make sure it has been indexed.');
            return false;
        }
        console.error('Error checking if contract exists:', error.message);
        return false;
    }
}

// Function to get the contract bytecode from the blockchain
async function getContractBytecode() {
    try {
        const response = await axios.get(`${API_URL}/blockchain/code/${CONTRACT_ADDRESS}`);
        return response.data.code;
    } catch (error) {
        console.error('Error getting contract bytecode:', error.message);
        return null;
    }
}

// Function to verify the contract
async function verifyContract() {
    try {
        console.log('Verifying UniswapV3Factory contract...');
        
        // Check if the contract exists in the database
        const contractExists = await checkContractExists();
        if (!contractExists) {
            console.error('Contract not found in database. Make sure it has been indexed.');
            return;
        }
        
        // Get the contract bytecode
        const bytecode = await getContractBytecode();
        if (!bytecode) {
            console.error('Failed to get contract bytecode.');
            return;
        }
        
        // Prepare the verification request
        const verificationData = {
            address: CONTRACT_ADDRESS,
            sourceCode: SOURCE_CODE,
            compilerVersion: COMPILER_VERSION,
            contractName: CONTRACT_NAME,
            optimizationUsed: OPTIMIZATION_USED,
            runs: RUNS,
            evmVersion: EVM_VERSION,
            importMappings: IMPORT_MAPPINGS
        };
        
        // Send the verification request
        const response = await axios.post(`${API_URL}/contracts/verify`, verificationData);
        
        console.log('Verification result:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error verifying contract:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        console.error('Error config:', error.config);
        throw error;
    }
}

// Execute the verification
verifyContract().catch(console.error);
