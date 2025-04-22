const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Paths
const contractsDir = path.join(__dirname, '../contracts');
const payloadsDir = path.join(__dirname, '../verification-payloads');
const tempDir = path.join(__dirname, '../temp-exact-structure');

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
 * Create a modified version of the contract with flattened imports
 * @param {string} contractName The name of the contract
 * @param {object} sourceFiles The source files
 * @returns {string} The modified contract content
 */
function createModifiedContract(contractName, sourceFiles) {
  // Get the main contract file
  const mainContractPath = `${contractName}.sol`;
  let mainContractContent = sourceFiles[mainContractPath];
  
  if (!mainContractContent) {
    throw new Error(`Main contract file not found: ${mainContractPath}`);
  }
  
  // Get all the import paths from the main contract
  const imports = extractImports(mainContractContent);
  console.log(`Main contract imports: ${imports.join(', ')}`);
  
  // Create a mapping of import paths to file paths
  const importMappings = {
    '@uniswap/v3-core/contracts/libraries/SafeCast.sol': 'libraries/SafeCast.sol',
    '@uniswap/v3-core/contracts/libraries/TickMath.sol': 'libraries/TickMath.sol',
    '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol': 'interfaces/IUniswapV3Pool.sol',
    './interfaces/ISwapRouter.sol': 'interfaces/ISwapRouter.sol',
    './base/PeripheryImmutableState.sol': 'base/PeripheryImmutableState.sol',
    './base/PeripheryValidation.sol': 'base/PeripheryValidation.sol',
    './base/PeripheryPaymentsWithFee.sol': 'base/PeripheryPaymentsWithFee.sol',
    './base/Multicall.sol': 'base/Multicall.sol',
    './base/SelfPermit.sol': 'base/SelfPermit.sol',
    './libraries/Path.sol': 'libraries/Path.sol',
    './libraries/PoolAddress.sol': 'libraries/PoolAddress.sol',
    './libraries/CallbackValidation.sol': 'libraries/CallbackValidation.sol',
    './interfaces/external/IWETH9.sol': 'interfaces/external/IWETH9.sol'
  };
  
  // Extract the license and pragma statements from the main contract
  const licenseMatch = mainContractContent.match(/\/\/ SPDX-License-Identifier: [^\n]+/);
  const license = licenseMatch ? licenseMatch[0] : '// SPDX-License-Identifier: GPL-2.0-or-later';
  
  const pragmaMatch = mainContractContent.match(/pragma solidity [^;]+;/);
  const pragma = pragmaMatch ? pragmaMatch[0] : 'pragma solidity =0.7.6;';
  
  const abicoderMatch = mainContractContent.match(/pragma abicoder [^;]+;/);
  const abicoder = abicoderMatch ? abicoderMatch[0] : 'pragma abicoder v2;';
  
  // Start with the license and pragma statements
  let flattenedContent = `${license}\n${pragma}\n${abicoder}\n\n`;
  
  // Process all imports
  const processedImports = new Set();
  
  function processImport(importPath) {
    if (processedImports.has(importPath)) {
      return;
    }
    
    processedImports.add(importPath);
    
    const filePath = importMappings[importPath];
    if (filePath && sourceFiles[filePath]) {
      // Get the content of the imported file
      let content = sourceFiles[filePath];
      
      // Remove SPDX license identifier
      content = content.replace(/\/\/ SPDX-License-Identifier: [^\n]+\n/, '');
      
      // Remove pragma statements
      content = content.replace(/pragma solidity [^;]+;\n/g, '');
      content = content.replace(/pragma abicoder [^;]+;\n/g, '');
      
      // Extract imports from this file
      const nestedImports = extractImports(content);
      
      // Remove import statements
      content = content.replace(/import\s+['"][^'"]+['"];\n/g, '');
      
      // Add the content
      flattenedContent += `\n// File: ${importPath}\n${content.trim()}\n`;
      
      // Process nested imports
      for (const nestedImport of nestedImports) {
        processImport(nestedImport);
      }
    }
  }
  
  // Process all imports from the main contract
  for (const importPath of imports) {
    processImport(importPath);
  }
  
  // Add the main contract content (without license, pragma, and imports)
  let mainContent = mainContractContent;
  mainContent = mainContent.replace(/\/\/ SPDX-License-Identifier: [^\n]+\n/, '');
  mainContent = mainContent.replace(/pragma solidity [^;]+;\n/g, '');
  mainContent = mainContent.replace(/pragma abicoder [^;]+;\n/g, '');
  mainContent = mainContent.replace(/import\s+['"][^'"]+['"];\n/g, '');
  
  flattenedContent += `\n// File: ${mainContractPath}\n${mainContent.trim()}\n`;
  
  return flattenedContent;
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
    
    // Create a modified version of the contract with flattened imports
    const flattenedContent = createModifiedContract(contractName, sourceFiles);
    
    // Write the flattened content to a file for inspection
    const flattenedPath = path.join(tempDir, `${contractName}-flattened.sol`);
    fs.mkdirSync(path.dirname(flattenedPath), { recursive: true });
    fs.writeFileSync(flattenedPath, flattenedContent);
    console.log(`Wrote flattened contract to ${flattenedPath}`);
    
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
