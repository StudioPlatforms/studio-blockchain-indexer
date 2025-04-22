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
 * Create a directory structure that exactly matches the import paths
 * @param {string} contractName The name of the contract
 * @param {object} sourceFiles The source files
 * @returns {string} The path to the temporary directory
 */
function createExactDirectoryStructure(contractName, sourceFiles) {
  // Create the temporary directory if it doesn't exist
  if (fs.existsSync(tempDir)) {
    // Remove the existing directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(tempDir, { recursive: true });
  
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
  
  // Create directories and copy files
  for (const [importPath, filePath] of Object.entries(importMappings)) {
    // Normalize the import path
    let normalizedImportPath = importPath;
    if (normalizedImportPath.startsWith('./')) {
      normalizedImportPath = normalizedImportPath.substring(2);
    }
    
    // Create the directory
    const dirPath = path.dirname(path.join(tempDir, normalizedImportPath));
    fs.mkdirSync(dirPath, { recursive: true });
    
    // Copy the file
    const content = sourceFiles[filePath];
    if (content) {
      fs.writeFileSync(path.join(tempDir, normalizedImportPath), content);
      console.log(`Copied ${filePath} to ${normalizedImportPath}`);
    } else {
      console.warn(`Could not find content for ${filePath}`);
    }
  }
  
  // Copy the main contract file
  fs.writeFileSync(path.join(tempDir, mainContractPath), mainContractContent);
  console.log(`Copied ${mainContractPath} to ${mainContractPath}`);
  
  // Create directories for @uniswap/v3-core imports inside node_modules
  // This is the key change - placing files in node_modules/@uniswap/v3-core instead of @uniswap/v3-core
  const uniswapV3CoreDir = path.join(tempDir, 'node_modules/@uniswap/v3-core/contracts');
  fs.mkdirSync(path.join(uniswapV3CoreDir, 'libraries'), { recursive: true });
  fs.mkdirSync(path.join(uniswapV3CoreDir, 'interfaces'), { recursive: true });
  
  // Copy files for @uniswap/v3-core imports
  fs.writeFileSync(
    path.join(uniswapV3CoreDir, 'libraries/SafeCast.sol'),
    sourceFiles['libraries/SafeCast.sol']
  );
  fs.writeFileSync(
    path.join(uniswapV3CoreDir, 'libraries/TickMath.sol'),
    sourceFiles['libraries/TickMath.sol']
  );
  fs.writeFileSync(
    path.join(uniswapV3CoreDir, 'interfaces/IUniswapV3Pool.sol'),
    sourceFiles['interfaces/IUniswapV3Pool.sol']
  );
  
  console.log(`Created exact directory structure in ${tempDir}`);
  
  return tempDir;
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
    
    // Create a directory structure that exactly matches the import paths
    const exactStructureDir = createExactDirectoryStructure(contractName, sourceFiles);
    
    // Create the final sourceFiles object for the verification request
    const finalSourceFiles = {};
    
    // Add the main contract file
    finalSourceFiles[`${contractName}.sol`] = sourceFiles[`${contractName}.sol`];
    
    // Add all import files with the exact paths as they appear in the import statements
    // These are the paths that the Solidity compiler will look for
    finalSourceFiles['@uniswap/v3-core/contracts/libraries/SafeCast.sol'] = sourceFiles['libraries/SafeCast.sol'];
    finalSourceFiles['@uniswap/v3-core/contracts/libraries/TickMath.sol'] = sourceFiles['libraries/TickMath.sol'];
    finalSourceFiles['@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol'] = sourceFiles['interfaces/IUniswapV3Pool.sol'];
    finalSourceFiles['interfaces/ISwapRouter.sol'] = sourceFiles['interfaces/ISwapRouter.sol'];
    finalSourceFiles['base/PeripheryImmutableState.sol'] = sourceFiles['base/PeripheryImmutableState.sol'];
    finalSourceFiles['base/PeripheryValidation.sol'] = sourceFiles['base/PeripheryValidation.sol'];
    finalSourceFiles['base/PeripheryPaymentsWithFee.sol'] = sourceFiles['base/PeripheryPaymentsWithFee.sol'];
    finalSourceFiles['base/Multicall.sol'] = sourceFiles['base/Multicall.sol'];
    finalSourceFiles['base/SelfPermit.sol'] = sourceFiles['base/SelfPermit.sol'];
    finalSourceFiles['libraries/Path.sol'] = sourceFiles['libraries/Path.sol'];
    finalSourceFiles['libraries/PoolAddress.sol'] = sourceFiles['libraries/PoolAddress.sol'];
    finalSourceFiles['libraries/CallbackValidation.sol'] = sourceFiles['libraries/CallbackValidation.sol'];
    finalSourceFiles['interfaces/external/IWETH9.sol'] = sourceFiles['interfaces/external/IWETH9.sol'];
    
    // Print out the keys in the finalSourceFiles object
    console.log('Final sourceFiles:');
    Object.keys(finalSourceFiles).forEach(key => {
      console.log(`  ${key}`);
    });
    
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
      sourceFiles: finalSourceFiles
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
