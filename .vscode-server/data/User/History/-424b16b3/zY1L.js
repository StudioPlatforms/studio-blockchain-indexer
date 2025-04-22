#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x6f1aF63eb91723a883c632E38D34f2cB6090b805';
const COMPILER_VERSION = '0.7.6';
const CONTRACT_NAME = 'UniswapV3Factory';
const OPTIMIZATION_USED = true;
const RUNS = 800; // From the hardhat.config.ts file
const CONSTRUCTOR_ARGUMENTS = ''; // No constructor arguments
const EVM_VERSION = 'berlin'; // From the hardhat.config.ts file

// Function to read the original source code from the GitHub repository
async function getOriginalSourceCode() {
    try {
        console.log('Reading original source code from GitHub repository...');
        
        // Read the UniswapV3Factory.sol file
        const factoryPath = '/root/uniswap/v3-core/contracts/UniswapV3Factory.sol';
        const factorySource = fs.readFileSync(factoryPath, 'utf8');
        
        // Read all imported files
        const imports = extractImports(factorySource);
        const importedSources = {};
        
        for (const importPath of imports) {
            const fullPath = path.join('/root/uniswap/v3-core', importPath);
            if (fs.existsSync(fullPath)) {
                const importSource = fs.readFileSync(fullPath, 'utf8');
                importedSources[importPath] = importSource;
            } else {
                console.warn(`Import file not found: ${fullPath}`);
            }
        }
        
        return {
            factory: factorySource,
            imports: importedSources
        };
    } catch (error) {
        console.error('Error getting original source code:', error);
        throw error;
    }
}

// Function to extract imports from a Solidity file
function extractImports(source) {
    const importRegex = /import\s+['"](.+)['"]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(source)) !== null) {
        imports.push(match[1]);
    }
    
    return imports;
}

// Function to flatten the source code
function flattenSourceCode(factory, imports) {
    try {
        console.log('Flattening source code...');
        
        // Replace imports with the actual source code
        let flattened = factory;
        
        for (const [importPath, importSource] of Object.entries(imports)) {
            const importStatement = `import '${importPath}';`;
            flattened = flattened.replace(importStatement, importSource);
        }
        
        return flattened;
    } catch (error) {
        console.error('Error flattening source code:', error);
        throw error;
    }
}

// Function to verify the contract
async function verifyContract(sourceCode) {
    try {
        console.log(`Verifying contract ${CONTRACT_ADDRESS}...`);
        
        // Verify the contract
        const response = await axios.post(`${API_URL}/contracts/verify`, {
            address: CONTRACT_ADDRESS,
            sourceCode: sourceCode,
            compilerVersion: COMPILER_VERSION,
            contractName: CONTRACT_NAME,
            optimizationUsed: OPTIMIZATION_USED,
            runs: RUNS,
            constructorArguments: CONSTRUCTOR_ARGUMENTS,
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

async function main() {
    try {
        // Get the original source code
        const { factory, imports } = await getOriginalSourceCode();
        
        // Flatten the source code
        const flattened = flattenSourceCode(factory, imports);
        
        // Save the flattened source code to a file
        fs.writeFileSync('flattened.sol', flattened);
        console.log('Flattened source code saved to flattened.sol');
        
        // Verify the contract
        await verifyContract(flattened);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
