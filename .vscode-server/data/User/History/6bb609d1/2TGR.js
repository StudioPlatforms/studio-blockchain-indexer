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

// Function to verify the contract
async function verifyContract() {
    try {
        console.log(`Verifying UniswapV3Factory contract at ${CONTRACT_ADDRESS}...`);
        
        // Read the source code from the manual-verification folder
        const sourceCode = fs.readFileSync('/root/archive-for-verification/manual-verification/UniswapV3Factory/UniswapV3Factory.sol', 'utf8');
        
        // Extract the first SPDX license identifier
        const spdxMatch = sourceCode.match(/\/\/ SPDX-License-Identifier: [^\n]*/);
        const firstSpdx = spdxMatch ? spdxMatch[0] : '// SPDX-License-Identifier: GPL-2.0-or-later AND BUSL-1.1';

        // Extract the first pragma statement
        const pragmaMatch = sourceCode.match(/pragma solidity [^;]*;/);
        const firstPragma = pragmaMatch ? pragmaMatch[0] : 'pragma solidity =0.7.6;';

        // Remove all SPDX license identifiers and pragma statements
        let fixedCode = sourceCode.replace(/\/\/ SPDX-License-Identifier: [^\n]*/g, '');
        fixedCode = fixedCode.replace(/pragma solidity [^;]*;/g, '');

        // Add the first SPDX license identifier and pragma statement at the top
        fixedCode = `${firstSpdx}\n${firstPragma}\n\n${fixedCode}`;
        
        // Create a standard-json-input for the compiler
        const input = {
            language: 'Solidity',
            sources: {
                'UniswapV3Factory.sol': {
                    content: fixedCode
                }
            },
            settings: {
                optimizer: {
                    enabled: OPTIMIZATION_USED,
                    runs: RUNS
                },
                evmVersion: EVM_VERSION,
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
                    }
                }
            }
        };
        
        // Prepare the verification request
        const verificationData = {
            address: CONTRACT_ADDRESS,
            sourceCode: JSON.stringify(input),
            compilerVersion: COMPILER_VERSION,
            contractName: CONTRACT_NAME,
            optimizationUsed: OPTIMIZATION_USED,
            runs: RUNS,
            evmVersion: EVM_VERSION,
            libraries: {},
            useStandardJsonInput: true
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
