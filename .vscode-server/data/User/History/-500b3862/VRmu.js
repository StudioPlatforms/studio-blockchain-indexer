const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Paths
const contractsDir = path.join(__dirname, '../contracts');
const payloadsDir = path.join(__dirname, '../verification-payloads');
const nodeModulesDir = path.join(__dirname, '../node_modules');
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
 * Helper function to read a file
 * @param {string} filePath The file path
 * @returns {string} The file content
 */
function readSourceFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Create a node_modules structure for the contract
 * @param {string} contractName The name of the contract
 * @param {object} sourceFiles The source files
 * @returns {object} The source files with node_modules structure
 */
function createNodeModulesStructure(contractName, sourceFiles) {
  // Create the temporary directory if it doesn't exist
  if (fs.existsSync(tempDir)) {
    // Remove the existing directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Create the node_modules directory
  const tempNodeModulesDir = path.join(tempDir, 'node_modules');
  fs.mkdirSync(tempNodeModulesDir, { recursive: true });
  
  // Create the @uniswap directory structure
  const uniswapDir = path.join(tempNodeModulesDir, '@uniswap');
  fs.mkdirSync(uniswapDir, { recursive: true });
  
  // Create the v3-core directory
  const v3CoreDir = path.join(uniswapDir, 'v3-core');
  fs.mkdirSync(v3CoreDir, { recursive: true });
  
  // Create the contracts directory
  const contractsV3Dir = path.join(v3CoreDir, 'contracts');
  fs.mkdirSync(contractsV3Dir, { recursive: true });
  
  // Create the libraries directory
  const librariesDir = path.join(contractsV3Dir, 'libraries');
  fs.mkdirSync(librariesDir, { recursive: true });
  
  // Create the interfaces directory
  const interfacesDir = path.join(contractsV3Dir, 'interfaces');
  fs.mkdirSync(interfacesDir, { recursive: true });
  
  // Copy the SafeCast.sol file
  fs.writeFileSync(
    path.join(librariesDir, 'SafeCast.sol'),
    sourceFiles['libraries/SafeCast.sol']
  );
  
  // Copy the TickMath.sol file
  fs.writeFileSync(
    path.join(librariesDir, 'TickMath.sol'),
    sourceFiles['libraries/TickMath.sol']
  );
  
  // Copy the IUniswapV3Pool.sol file
  fs.writeFileSync(
    path.join(interfacesDir, 'IUniswapV3Pool.sol'),
    sourceFiles['interfaces/IUniswapV3Pool.sol']
  );
  
  // Create the local directories
  fs.mkdirSync(path.join(tempDir, 'interfaces'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'base'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'libraries'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'interfaces/external'), { recursive: true });
  
  // Copy the local files
  fs.writeFileSync(
    path.join(tempDir, 'interfaces/ISwapRouter.sol'),
    sourceFiles['interfaces/ISwapRouter.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'base/PeripheryImmutableState.sol'),
    sourceFiles['base/PeripheryImmutableState.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'base/PeripheryValidation.sol'),
    sourceFiles['base/PeripheryValidation.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'base/PeripheryPaymentsWithFee.sol'),
    sourceFiles['base/PeripheryPaymentsWithFee.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'base/Multicall.sol'),
    sourceFiles['base/Multicall.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'base/SelfPermit.sol'),
    sourceFiles['base/SelfPermit.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'libraries/Path.sol'),
    sourceFiles['libraries/Path.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'libraries/PoolAddress.sol'),
    sourceFiles['libraries/PoolAddress.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'libraries/CallbackValidation.sol'),
    sourceFiles['libraries/CallbackValidation.sol']
  );
  fs.writeFileSync(
    path.join(tempDir, 'interfaces/external/IWETH9.sol'),
    sourceFiles['interfaces/external/IWETH9.sol']
  );
  
  // Copy the main contract file
  fs.writeFileSync(
    path.join(tempDir, `${contractName}.sol`),
    sourceFiles[`${contractName}.sol`]
  );
  
  console.log(`Created node_modules structure in ${tempDir}`);
  
  // Create a new sourceFiles object with the node_modules structure
  const nodeModulesSourceFiles = {};
  
  // Add the main contract file
  nodeModulesSourceFiles[`${contractName}.sol`] = sourceFiles[`${contractName}.sol`];
  
  // Add the @uniswap files with node_modules prefix
  nodeModulesSourceFiles['node_modules/@uniswap/v3-core/contracts/libraries/SafeCast.sol'] = sourceFiles['libraries/SafeCast.sol'];
  nodeModulesSourceFiles['node_modules/@uniswap/v3-core/contracts/libraries/TickMath.sol'] = sourceFiles['libraries/TickMath.sol'];
  nodeModulesSourceFiles['node_modules/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol'] = sourceFiles['interfaces/IUniswapV3Pool.sol'];
  
  // Add the local files
  nodeModulesSourceFiles['interfaces/ISwapRouter.sol'] = sourceFiles['interfaces/ISwapRouter.sol'];
  nodeModulesSourceFiles['base/PeripheryImmutableState.sol'] = sourceFiles['base/PeripheryImmutableState.sol'];
  nodeModulesSourceFiles['base/PeripheryValidation.sol'] = sourceFiles['base/PeripheryValidation.sol'];
  nodeModulesSourceFiles['base/PeripheryPaymentsWithFee.sol'] = sourceFiles['base/PeripheryPaymentsWithFee.sol'];
  nodeModulesSourceFiles['base/Multicall.sol'] = sourceFiles['base/Multicall.sol'];
  nodeModulesSourceFiles['base/SelfPermit.sol'] = sourceFiles['base/SelfPermit.sol'];
  nodeModulesSourceFiles['libraries/Path.sol'] = sourceFiles['libraries/Path.sol'];
  nodeModulesSourceFiles['libraries/PoolAddress.sol'] = sourceFiles['libraries/PoolAddress.sol'];
  nodeModulesSourceFiles['libraries/CallbackValidation.sol'] = sourceFiles['libraries/CallbackValidation.sol'];
  nodeModulesSourceFiles['interfaces/external/IWETH9.sol'] = sourceFiles['interfaces/external/IWETH9.sol'];
  
  return nodeModulesSourceFiles;
}

/**
 * Helper function to collect all source files for a contract
 * @param {string} contractName The name of the contract
 * @returns {object} The source files
 */
function collectSourceFiles(contractName) {
  const sourceFiles = {};
  
  // Main contract file
  const mainContractPath = path.join(contractsDir, `${contractName}.sol`);
  if (fs.existsSync(mainContractPath)) {
    const mainContractContent = readSourceFile(mainContractPath);
    sourceFiles[`${contractName}.sol`] = mainContractContent;
    
    // Extract imports from the main contract
    const imports = extractImports(mainContractContent);
    
    // Process each import
    for (const importPath of imports) {
      processImport(importPath, sourceFiles, contractsDir, nodeModulesDir);
    }
  } else {
    console.error(`Main contract file ${mainContractPath} not found`);
    return null;
  }
  
  return sourceFiles;
}

/**
 * Helper function to process an import
 * @param {string} importPath The import path
 * @param {object} sourceFiles The source files
 * @param {string} contractsDir The contracts directory
 * @param {string} nodeModulesDir The node_modules directory
 */
function processImport(importPath, sourceFiles, contractsDir, nodeModulesDir) {
  // Skip if already processed
  if (sourceFiles[importPath]) {
    return;
  }
  
  // Normalize the import path
  let normalizedPath = importPath;
  if (normalizedPath.startsWith('./')) {
    normalizedPath = normalizedPath.substring(2);
  }
  
  // Try to find the file in the contracts directory
  let filePath = path.join(contractsDir, normalizedPath);
  
  // If not found, try to find it in node_modules
  if (!fs.existsSync(filePath)) {
    filePath = path.join(nodeModulesDir, importPath);
  }
  
  // If found, read the file and process its imports
  if (fs.existsSync(filePath)) {
    const content = readSourceFile(filePath);
    sourceFiles[normalizedPath] = content;
    
    // Extract imports from this file
    const imports = extractImports(content);
    
    // Process each import
    for (const nestedImport of imports) {
      processImport(nestedImport, sourceFiles, contractsDir, nodeModulesDir);
    }
  } else {
    console.warn(`Imported file ${importPath} not found`);
  }
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
    
    // Collect all source files
    const sourceFiles = collectSourceFiles(contractName);
    
    if (!sourceFiles) {
      console.error(`Could not collect source files for ${contractName}`);
      return {
        success: false,
        error: `Could not collect source files for ${contractName}`
      };
    }
    
    console.log(`Found ${Object.keys(sourceFiles).length} source files`);
    
    // Create a node_modules structure for the contract
    const nodeModulesSourceFiles = createNodeModulesStructure(contractName, sourceFiles);
    
    // Print out the keys in the nodeModulesSourceFiles object
    console.log('Node modules source files:');
    Object.keys(nodeModulesSourceFiles).forEach(key => {
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
      sourceFiles: nodeModulesSourceFiles
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
