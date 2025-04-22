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
  
  // Define dependencies for each contract
  const contractDependencies = {
    'UniswapV3Factory': [
      'interfaces/IUniswapV3Factory.sol',
      'UniswapV3PoolDeployer.sol',
      'NoDelegateCall.sol',
      'interfaces/IUniswapV3PoolDeployer.sol',
      'UniswapV3Pool.sol'
    ],
    'NFTDescriptor': [
      'libraries/NFTDescriptor.sol',
      'libraries/HexStrings.sol',
      'libraries/NFTSVG.sol'
    ],
    'NonfungibleTokenPositionDescriptor': [
      'NonfungibleTokenPositionDescriptor.sol',
      'interfaces/INonfungibleTokenPositionDescriptor.sol',
      'libraries/NFTDescriptor.sol',
      'libraries/NFTSVG.sol',
      'libraries/HexStrings.sol',
      'libraries/PoolAddress.sol'
    ],
    'NonfungiblePositionManager': [
      'NonfungiblePositionManager.sol',
      'interfaces/INonfungiblePositionManager.sol',
      'base/LiquidityManagement.sol',
      'base/PeripheryImmutableState.sol',
      'base/Multicall.sol',
      'base/ERC721Permit.sol',
      'base/PeripheryValidation.sol',
      'base/SelfPermit.sol',
      'libraries/PositionKey.sol',
      'libraries/PoolAddress.sol'
    ],
    'SwapRouter': [
      'SwapRouter.sol',
      'interfaces/ISwapRouter.sol',
      'base/PeripheryImmutableState.sol',
      'base/PeripheryValidation.sol',
      'base/PeripheryPayments.sol',
      'base/Multicall.sol',
      'libraries/Path.sol',
      'libraries/PoolAddress.sol',
      'libraries/CallbackValidation.sol'
    ]
  };
  
  // Get dependencies for the current contract
  const dependencies = contractDependencies[contractName] || [];
  
  // Add all dependencies
  for (const dependency of dependencies) {
    const dependencyPath = path.join(contractsDir, dependency);
    if (fs.existsSync(dependencyPath)) {
      sourceFiles[dependency] = readSourceFile(dependencyPath);
    } else {
      console.error(`Dependency file ${dependencyPath} not found`);
    }
  }
  
  // Add all imported files recursively
  const processedFiles = new Set(Object.keys(sourceFiles));
  let newFilesAdded = true;
  
  while (newFilesAdded) {
    newFilesAdded = false;
    
    // Check each file for imports
    for (const filePath of processedFiles) {
      const content = sourceFiles[filePath];
      if (!content) continue;
      
      // Extract imports
      const importRegex = /import\s+['"](.+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (!processedFiles.has(importPath)) {
          const fullPath = path.join(contractsDir, importPath);
          if (fs.existsSync(fullPath)) {
            sourceFiles[importPath] = readSourceFile(fullPath);
            processedFiles.add(importPath);
            newFilesAdded = true;
          } else {
            console.error(`Imported file ${fullPath} not found`);
          }
        }
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
      compilerVersion: payload.compilerVersion || "0.7.6",
      optimizationUsed: payload.optimizationUsed !== undefined ? payload.optimizationUsed : true,
      runs: payload.runs || 200,
      evmVersion: payload.evmVersion || "istanbul",
      isMultiPart: true,
      sourceFiles: sourceFiles,
      libraries: payload.libraries || {}
    };
    
    // Add constructor arguments if they exist
    if (payload.constructorArguments && payload.constructorArguments.length > 0) {
      verificationPayload.constructorArguments = payload.constructorArguments;
    }
    
    // Debug log
    console.log('Verification payload:', JSON.stringify(verificationPayload, null, 2));
    
    console.log(`Verifying contract ${verificationPayload.contractName} at ${verificationPayload.address}...`);
    
    // Log the exact request being sent
    console.log('Request URL:', `${INDEXER_API_URL}/contracts/verify`);
    console.log('Request Headers:', {
      'Content-Type': 'application/json'
    });
    
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
    console.error(`Error verifying contract ${payload.name}:`, error.response?.data || error.message);
    
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
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Verify a contract using its payload file
async function verifyContract(fileName) {
  try {
    const payload = readVerificationPayload(fileName);
    const result = await sendVerificationRequest(payload);
    
    if (result.success) {
      console.log(`✅ Contract ${payload.name} verified successfully!`);
      console.log(`Response: ${JSON.stringify(result.data, null, 2)}`);
    } else {
      console.log(`❌ Failed to verify contract ${payload.name}`);
      console.log(`Error: ${JSON.stringify(result.error, null, 2)}`);
      
      // If the error is related to missing imports, try with a simplified payload
      if (result.error?.error?.includes('import') && !fileName.includes('_simplified')) {
        console.log(`Trying with simplified payload for ${payload.name}...`);
        await verifyContract(`${payload.name}_simplified.json`);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error processing verification for ${fileName}:`, error);
    return { success: false, error: error.message };
  }
}

// Verify all contracts in order
async function verifyAllContracts() {
  try {
    // Verify contracts in the correct order
    const contracts = [
      'UniswapV3Factory.json',
      'NFTDescriptor.json',
      'NonfungibleTokenPositionDescriptor.json',
      'NonfungiblePositionManager.json',
      'SwapRouter.json'
    ];
    
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
