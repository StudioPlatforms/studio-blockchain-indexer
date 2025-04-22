const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';
const COMPILER_VERSION = '0.7.6';
const CONTRACT_NAME = 'UniswapV3Factory';
const OPTIMIZATION_USED = true;
const RUNS = 800;
const EVM_VERSION = 'istanbul';

// Simplified source code for UniswapV3Factory
const SOURCE_CODE = `// SPDX-License-Identifier: GPL-2.0-or-later
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

contract UniswapV3PoolDeployer is IUniswapV3PoolDeployer {
    struct Parameters {
        address factory;
        address token0;
        address token1;
        uint24 fee;
        int24 tickSpacing;
    }
    
    Parameters public override parameters;
    
    function deploy(address factory, address token0, address token1, uint24 fee, int24 tickSpacing) internal returns (address pool) {
        parameters = Parameters({factory: factory, token0: token0, token1: token1, fee: fee, tickSpacing: tickSpacing});
        pool = address(new UniswapV3Pool{salt: keccak256(abi.encode(token0, token1, fee))}());
        delete parameters;
    }
}

contract NoDelegateCall {
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

contract UniswapV3Pool {
    constructor() {}
}

contract UniswapV3Factory is IUniswapV3Factory, UniswapV3PoolDeployer, NoDelegateCall {
    address public override owner;
    mapping(uint24 => int24) public override feeAmountTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;
    
    constructor() {
        owner = msg.sender;
        feeAmountTickSpacing[500] = 10;
        feeAmountTickSpacing[3000] = 60;
        feeAmountTickSpacing[10000] = 200;
        
        emit FeeAmountEnabled(500, 10);
        emit FeeAmountEnabled(3000, 60);
        emit FeeAmountEnabled(10000, 200);
    }
    
    function createPool(address tokenA, address tokenB, uint24 fee) external override noDelegateCall returns (address pool) {
        require(tokenA != tokenB);
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0));
        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(tickSpacing != 0);
        require(getPool[token0][token1][fee] == address(0));
        pool = deploy(address(this), token0, token1, fee, tickSpacing);
        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool;
        emit PoolCreated(token0, token1, fee, tickSpacing, pool);
    }
    
    function setOwner(address _owner) external override {
        require(msg.sender == owner);
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }
    
    function enableFeeAmount(uint24 fee, int24 tickSpacing) external override {
        require(msg.sender == owner);
        require(fee < 1000000);
        require(tickSpacing > 0 && tickSpacing < 16384);
        require(feeAmountTickSpacing[fee] == 0);
        
        feeAmountTickSpacing[fee] = tickSpacing;
        emit FeeAmountEnabled(fee, tickSpacing);
    }
}`;

// Function to verify the contract
async function verifyContract() {
    try {
        console.log(`Verifying UniswapV3Factory contract at ${CONTRACT_ADDRESS}...`);
        
        // Prepare the verification request
        const verificationData = {
            address: CONTRACT_ADDRESS,
            sourceCode: SOURCE_CODE,
            compilerVersion: COMPILER_VERSION,
            contractName: CONTRACT_NAME,
            optimizationUsed: OPTIMIZATION_USED,
            runs: RUNS,
            evmVersion: EVM_VERSION
        };
        
        // Send the verification request
        const response = await axios.post(`${API_URL}/contracts/verify`, verificationData);
        
        if (response.data.success) {
            console.log(`✅ Contract verified successfully!`);
        } else {
            console.error(`❌ Verification failed: ${response.data.error || 'Unknown error'}`);
        }
        
        return response.data;
    } catch (error) {
        if (error.response && error.response.data) {
            console.error(`❌ Verification failed: ${error.response.data.error || 'Unknown error'}`);
        } else {
            console.error(`❌ Error: ${error.message}`);
        }
        throw error;
    }
}

// Execute the verification
verifyContract().catch(() => {
    process.exit(1);
});
