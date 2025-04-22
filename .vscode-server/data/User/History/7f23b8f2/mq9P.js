const axios = require('axios');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';
const COMPILER_VERSION = '0.7.6';
const CONTRACT_NAME = 'UniswapV3Factory';
const OPTIMIZATION_USED = true;
const RUNS = 800;
const EVM_VERSION = 'istanbul';

// Read the flattened source code
const SOURCE_CODE = fs.readFileSync('/root/uniswap-v3-contracts/archive-for-verification/manual-verification/UniswapV3Factory/UniswapV3Factory.sol', 'utf8');

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
