const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Paths
const contractsDir = path.join(__dirname, '../contracts');
const payloadsDir = path.join(__dirname, '../verification-payloads');

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
 * Extract import paths from a file
 * @param {string} content The file content
 * @returns {string[]} The import paths
 */
function extractImports(content) {
  const imports = [];
  const importRegex = /import\s+['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Get all source files recursively
 * @param {string} dir The directory to search
 * @param {string} baseDir The base directory
 * @param {object} result The result object
 * @returns {object} The source files
 */
function getSourceFilesRecursive(dir, baseDir, result = {}) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      getSourceFilesRecursive(filePath, baseDir, result);
    } else if (file.endsWith('.sol')) {
      // Get the relative path from the base directory
      const relativePath = path.relative(baseDir, filePath);
      // Use forward slashes for consistency
      const normalizedPath = relativePath.replace(/\\/g, '/');
      // Read the file content
      const content = fs.readFileSync(filePath, 'utf8');
      // Add to result
      result[normalizedPath] = content;
    }
  }
  
  return result;
}

/**
 * Verify a contract using multi-part verification
 * @param {string} contractName The name of the contract
 */
async function verifyContract(contractName) {
  try {
    console.log(`Verifying contract: ${contractName}`);
    
    // Read the verification payload
    const payload = readVerificationPayload(contractName);
    
    // Get all source files recursively
    const sourceFiles = getSourceFilesRecursive(contractsDir, contractsDir);
    
    console.log(`Found ${Object.keys(sourceFiles).length} source files`);
    
    // Get the main contract file
    const mainContractPath = `${contractName}.sol`;
    const mainContractContent = sourceFiles[mainContractPath];
    
    if (!mainContractContent) {
      console.error(`Main contract file not found: ${mainContractPath}`);
      return {
        success: false,
        error: `Main contract file not found: ${mainContractPath}`
      };
    }
    
    // Extract imports from the main contract file
    const imports = extractImports(mainContractContent);
    console.log(`Main contract imports: ${imports.join(', ')}`);
    
    // Create a sourceFiles object with the exact import paths
    const exactPathSourceFiles = {};
    
    // Add the main contract file
    exactPathSourceFiles[mainContractPath] = mainContractContent;
    
    // Manually add the imports with their exact paths
    const importMappings = {
      '@uniswap/v3-core/contracts/libraries/SafeCast.sol': sourceFiles['libraries/SafeCast.sol'],
      '@uniswap/v3-core/contracts/libraries/TickMath.sol': sourceFiles['libraries/TickMath.sol'],
      '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol': sourceFiles['interfaces/IUniswapV3Pool.sol'],
      './interfaces/ISwapRouter.sol': sourceFiles['interfaces/ISwapRouter.sol'],
      './base/PeripheryImmutableState.sol': sourceFiles['base/PeripheryImmutableState.sol'],
      './base/PeripheryValidation.sol': sourceFiles['base/PeripheryValidation.sol'],
      './base/PeripheryPaymentsWithFee.sol': sourceFiles['base/PeripheryPaymentsWithFee.sol'],
      './base/Multicall.sol': sourceFiles['base/Multicall.sol'],
      './base/SelfPermit.sol': sourceFiles['base/SelfPermit.sol'],
      './libraries/Path.sol': sourceFiles['libraries/Path.sol'],
      './libraries/PoolAddress.sol': sourceFiles['libraries/PoolAddress.sol'],
      './libraries/CallbackValidation.sol': sourceFiles['libraries/CallbackValidation.sol'],
      './interfaces/external/IWETH9.sol': sourceFiles['interfaces/external/IWETH9.sol']
    };
    
    // Add all import mappings to the sourceFiles object
    for (const [importPath, content] of Object.entries(importMappings)) {
      if (content) {
        exactPathSourceFiles[importPath] = content;
        console.log(`Added ${importPath} to sourceFiles`);
      } else {
        console.warn(`Could not find content for ${importPath}`);
      }
    }
    
    // Add all other files with their original paths
    for (const [filePath, content] of Object.entries(sourceFiles)) {
      if (!exactPathSourceFiles[filePath]) {
        exactPathSourceFiles[filePath] = content;
      }
    }
    
    console.log(`Created ${Object.keys(exactPathSourceFiles).length} source files with exact import paths`);
    
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
      sourceCode: mainContractContent,
      isMultiPart: true,
      sourceFiles: exactPathSourceFiles
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
      isMultiPart: verificationRequest.isMultiPart,
      sourceFilesCount: Object.keys(verificationRequest.sourceFiles).length
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
