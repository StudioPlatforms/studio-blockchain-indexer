const axios = require('axios');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';
const SOURCE_CODE = fs.readFileSync('/root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/UniswapV3Factory.sol', 'utf8');
const COMPILER_VERSION = '0.7.6';
const CONTRACT_NAME = 'UniswapV3Factory';
const OPTIMIZATION_USED = true;
const RUNS = 800;
const EVM_VERSION = 'istanbul';

async function verifyContract() {
    try {
        console.log('Verifying UniswapV3Factory contract...');
        
        const response = await axios.post(`${API_URL}/contracts/verify`, {
            address: CONTRACT_ADDRESS,
            sourceCode: SOURCE_CODE,
            compilerVersion: COMPILER_VERSION,
            contractName: CONTRACT_NAME,
            optimizationUsed: OPTIMIZATION_USED,
            runs: RUNS,
            evmVersion: EVM_VERSION
        });
        
        console.log('Verification result:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        console.error('Error verifying contract:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

verifyContract().catch(console.error);
