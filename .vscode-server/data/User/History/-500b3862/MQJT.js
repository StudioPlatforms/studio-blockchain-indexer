const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Paths
const contractsDir = path.join(__dirname, '../contracts');
const payloadsDir = path.join(__dirname, '../verification-payloads');
const tempDir = path.join(__dirname, '../temp-exact-structure');
const flattenedDir = path.join(__dirname, '../flattened');

/**
 * Read a verification payload
 * @param {string} contractName The name of the contract
 * @returns {object} The verification payload
 */
function readVerificationPayload(contractName) {
  const payloadPath = path.join(payloadsDir, `${contractName}.json`);
  return JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
}

/**
 * Flatten a contract using Hardhat's flattener
 * @param {string} contractName The name of the contract
 * @returns {string} The path to the flattened contract
 */
async function flattenContract(contractName) {
  // Create the flattened directory if it doesn't exist
  if (!fs.existsSync(flattenedDir)) {
    fs.mkdirSync(flattenedDir);
  }
  
  const contractPath = path.join(contractsDir, `${contractName}.sol`);
  const outputPath = path.join(flattenedDir, `${contractName}_flattened.sol`);
  
  // Command to run Hardhat's flattener
  const command = `cd ${path.join(__dirname, '..')} && npx hardhat flatten ${contractPath} > ${outputPath}`;
  
  console.log(`Running command: ${command}`);
  
  // Execute the command
  await execPromise(command);
  
  console.log(`Flattened contract written to: ${outputPath}`);
  
  // Fix license identifiers (Hardhat flattener adds multiple SPDX license identifiers)
  let content = fs.readFileSync(outputPath, 'utf8');
  
  // Remove all SPDX license identifiers
  content = content.replace(/\/\/ SPDX-License-Identifier: .+\n/g, '');
  
  // Add a single SPDX license identifier at the top
  content = '// SPDX-License-Identifier: GPL-2.0-or-later\n\n' + content;
  
  // Write the fixed content back to the file
  fs.writeFileSync(outputPath, content);
  
  console.log('Fixed license identifiers');
  
  return outputPath;
}

/**
 * Verify a contract using single-file verification with a flattened contract
 * @param {string} contractName The name of the contract
 */
async function verifyContract(contractName) {
  try {
    console.log(`Verifying contract: ${contractName}`);
    
    // Read the verification payload
    const payload = readVerificationPayload(contractName);
    
    // Flatten the contract using Hardhat's flattener
    const flattenedPath = await flattenContract(contractName);
    
    // Read the flattened contract
    const flattenedContent = fs.readFileSync(flattenedPath, 'utf8');
    
    // Create the verification request
    const verificationRequest = {
      address: payload.address,
      contractName: payload.name,
      compilerVersion: payload.compilerVersion,
      optimizationUsed: payload.optimizationUsed,
      runs: payload.runs,
      evmVersion: payload.evmVersion,
      constructorArguments: payload.constructorArguments,
      libraries: payload.libraries,
      sourceCode: flattenedContent,
      isMultiPart: false // Use single file verification with flattened contract
    };
    
    console.log(`Verification request for ${contractName}:`, JSON.stringify({
      address: verificationRequest.address,
      contractName: verificationRequest.contractName,
      compilerVersion: verificationRequest.compilerVersion,
      optimizationUsed: verificationRequest.optimizationUsed,
      runs: verificationRequest.runs,
      evmVersion: verificationRequest.evmVersion,
      constructorArguments: verificationRequest.constructorArguments,
      libraries: verificationRequest.libraries,
      sourceCodeLength: verificationRequest.sourceCode.length,
      isMultiPart: verificationRequest.isMultiPart
    }, null, 2));
    
    // Send the verification request
    const response = await axios.post(`${INDEXER_API_URL}/contracts/verify`, verificationRequest, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Verification response for ${contractName}:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ Contract ${contractName} verified successfully!`);
    } else {
      console.log(`❌ Failed to verify contract ${contractName}`);
      console.log(`Error: ${JSON.stringify(response.data.error, null, 2)}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error verifying contract ${contractName}:`, error.response?.data || error.message);
    
    // Log more details about the error
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('Request made but no response received');
      console.error('Request:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Verify the SwapRouter contract
verifyContract('SwapRouter')
  .then(() => {
    console.log('Verification process completed!');
  })
  .catch(error => {
    console.error('Error during verification process:', error);
  });
