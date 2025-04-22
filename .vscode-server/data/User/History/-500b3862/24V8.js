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
 * Create a mapping of import paths to file contents
 * @param {string} contractName The name of the contract
 * @param {object} sourceFiles The source files
 * @returns {object} The import mappings
 */
function createImportMappings(contractName, sourceFiles) {
  // Get the main contract file
  const mainContractPath = `${contractName}.sol`;
  const mainContractContent = sourceFiles[mainContractPath];
  
  if (!mainContractContent) {
    throw new Error(`Main contract file not found: ${mainContractPath}`);
  }
  
  // Extract imports from the main contract file
  const imports = extractImports(mainContractContent);
  console.log(`Main contract imports: ${imports.join(', ')}`);
  
  // Create a mapping of import paths to file paths
  const importPathToFilePath = {
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
  
  // Create the import mappings object
  const importMappings = {};
  
  // Add the main contract file
  importMappings[mainContractPath] = mainContractContent;
  
  // Process all imports
  for (const importPath of imports) {
    const filePath = importPathToFilePath[importPath];
    if (filePath && sourceFiles[filePath]) {
      // Add the import mapping with the exact import path as the key
      importMappings[importPath] = sourceFiles[filePath];
      console.log(`Added import mapping for ${importPath} -> ${filePath}`);
      
      // Also add without ./ prefix for relative imports
      if (importPath.startsWith('./')) {
        const normalizedPath = importPath.substring(2);
        importMappings[normalizedPath] = sourceFiles[filePath];
        console.log(`Added normalized import mapping for ${normalizedPath} -> ${filePath}`);
      }
      
      // Process nested imports
      const nestedImports = extractImports(sourceFiles[filePath]);
      for (const nestedImport of nestedImports) {
        // Handle relative imports in nested files
        let resolvedImport = nestedImport;
        if (nestedImport.startsWith('./') || nestedImport.startsWith('../')) {
          // Get the directory of the current file
          const fileDir = path.dirname(filePath);
          // Resolve the relative import
          resolvedImport = path.normalize(path.join(fileDir, nestedImport)).replace(/\\/g, '/');
          console.log(`Resolved relative import ${nestedImport} -> ${resolvedImport}`);
        }
        
        // Find the file path for the nested import
        let nestedFilePath = null;
        for (const [key, value] of Object.entries(importPathToFilePath)) {
          if (key.endsWith('/' + resolvedImport) || key === resolvedImport) {
            nestedFilePath = value;
            break;
          }
        }
        
        if (nestedFilePath && sourceFiles[nestedFilePath]) {
          // Add the nested import mapping
          importMappings[nestedImport] = sourceFiles[nestedFilePath];
          console.log(`Added nested import mapping for ${nestedImport} -> ${nestedFilePath}`);
          
          // Also add without ./ prefix for relative imports
          if (nestedImport.startsWith('./')) {
            const normalizedPath = nestedImport.substring(2);
            importMappings[normalizedPath] = sourceFiles[nestedFilePath];
            console.log(`Added normalized nested import mapping for ${normalizedPath} -> ${nestedFilePath}`);
          }
          
          // Also add the resolved import
          if (resolvedImport !== nestedImport) {
            importMappings[resolvedImport] = sourceFiles[nestedFilePath];
            console.log(`Added resolved import mapping for ${resolvedImport} -> ${nestedFilePath}`);
          }
        }
      }
    } else {
      console.warn(`Could not find file path for import: ${importPath}`);
    }
  }
  
  // Print out the keys in the importMappings object
  console.log('Import mappings:');
  Object.keys(importMappings).forEach(key => {
    console.log(`  ${key}`);
  });
  
  return importMappings;
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
    
    // Create import mappings
    const importMappings = createImportMappings(contractName, sourceFiles);
    
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
      sourceCode: sourceFiles[`${contractName}.sol`],
      isMultiPart: true,
      sourceFiles: importMappings
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
