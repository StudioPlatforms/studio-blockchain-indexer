const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Verification payloads directory
const PAYLOADS_DIR = path.join(__dirname, '../verification-payloads');

// Helper function to read a verification payload
function readVerificationPayload(fileName) {
  return JSON.parse(fs.readFileSync(path.join(PAYLOADS_DIR, fileName), 'utf8'));
}

// Helper function to read a file
function readSourceFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Helper function to collect all source files for a contract
function collectSourceFiles(contractName) {
  const contractsDir = path.join(__dirname, '../contracts');
  const sourceFiles = {};
  
  // Main contract file
  const mainContractPath = path.join(contractsDir, `${contractName}.sol`);
  if (fs.existsSync(mainContractPath)) {
    sourceFiles[`${contractName}.sol`] = readSourceFile(mainContractPath);
  } else {
    console.error(`Main contract file ${mainContractPath} not found`);
    return null;
  }
  
  // For UniswapV3Factory, we need to include these files
  if (contractName === 'UniswapV3Factory') {
    const dependencies = [
      'interfaces/IUniswapV3Factory.sol',
      'UniswapV3PoolDeployer.sol',
      'NoDelegateCall.sol',
      'interfaces/IUniswapV3PoolDeployer.sol',
      'UniswapV3Pool.sol'
    ];
    
    for (const dependency of dependencies) {
      const dependencyPath = path.join(contractsDir, dependency);
      if (fs.existsSync(dependencyPath)) {
        sourceFiles[dependency] = readSourceFile(dependencyPath);
      } else {
        console.error(`Dependency file ${dependencyPath} not found`);
      }
    }
  }
  
  return sourceFiles;
}

// Helper function to send a verification request
async function sendVerificationRequest(payload) {
  try {
    // Create a multi-part verification payload
    const sourceFiles = collectSourceFiles(payload.name);
    if (!sourceFiles) {
      return {
        success: false,
        error: `Could not collect source files for ${payload.name}`
      };
    }
    
    const verificationPayload = {
      address: payload.address,
      contractName: payload.name,
      compilerVersion: "0.7.6",
      optimizationUsed: true,
      runs: 1000,
      evmVersion: "istanbul",
      isMultiPart: true,
      sourceFiles: sourceFiles,
      libraries: payload.libraries || {}
    };
    
    // Add constructor arguments if they exist
    if (payload.constructorArguments && payload.constructorArguments.length > 0) {
      verificationPayload.constructorArguments = payload.constructorArguments.join('');
    }
    
    // Debug log
    console.log('Verification payload:', JSON.stringify(verificationPayload, null, 2));
    
    console.log(`Verifying contract ${verificationPayload.contractName} at ${verificationPayload.address}...`);
    
    const response = await axios.post(`${INDEXER_API_URL}/contracts/verify`, verificationPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    console.error(`Error verifying contract ${payload.contractName}:`, error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
    
    for (const contractFile of contracts) {
      const result = await verifyContract(contractFile);
      
      // Add a delay between verification requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!result.success) {
        console.log(`Verification failed for ${contractFile}. Continuing with next contract...`);
      }
    }
    
    console.log('Verification process completed!');
  } catch (error) {
    console.error('Error during verification process:', error);
  }
}

// Try different verification approaches for a specific contract
async function tryDifferentApproaches(contractName) {
  try {
    console.log(`Trying different verification approaches for ${contractName}...`);
    
    // Try with the full payload
    console.log(`1. Trying with full payload...`);
    const fullResult = await verifyContract(`${contractName}.json`);
    
    if (fullResult.success) {
      console.log(`✅ Full payload verification successful!`);
      return fullResult;
    }
    
    // Try with simplified payload
    console.log(`2. Trying with simplified payload...`);
    const simplifiedResult = await verifyContract(`${contractName}_simplified.json`);
    
    if (simplifiedResult.success) {
      console.log(`✅ Simplified payload verification successful!`);
      return simplifiedResult;
    }
    
    // If both approaches failed, log the errors
    console.log(`❌ All verification approaches failed for ${contractName}`);
    console.log(`Full payload error: ${JSON.stringify(fullResult.error, null, 2)}`);
    console.log(`Simplified payload error: ${JSON.stringify(simplifiedResult.error, null, 2)}`);
    
    return { success: false, errors: { full: fullResult.error, simplified: simplifiedResult.error } };
  } catch (error) {
    console.error(`Error trying different approaches for ${contractName}:`, error);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  try {
    // Check if a specific contract was specified
    const contractName = process.argv[2];
    
    if (contractName) {
      // Verify a specific contract
      await tryDifferentApproaches(contractName);
    } else {
      // Verify all contracts
      await verifyAllContracts();
    }
  } catch (error) {
    console.error('Error in verification script:', error);
  }
}

// Run the main function
main().catch(console.error);
