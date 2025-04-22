const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Paths
const contractsDir = path.join(__dirname, '../contracts');
const payloadsDir = path.join(__dirname, '../verification-payloads');
const tempDir = path.join(__dirname, '../temp');

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
 * Create a temporary directory with modified imports
 * @param {string} contractName The name of the contract
 * @param {object} sourceFiles The source files
 * @returns {string} The path to the temporary directory
 */
function createTempDirWithModifiedImports(contractName, sourceFiles) {
  // Create the temporary directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create subdirectories
  fs.mkdirSync(path.join(tempDir, 'interfaces'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'interfaces', 'external'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'interfaces', 'callback'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'interfaces', 'pool'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'libraries'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'base'), { recursive: true });
  
  // Copy all source files to the temporary directory
  for (const [filePath, content] of Object.entries(sourceFiles)) {
    const tempFilePath = path.join(tempDir, filePath);
    const tempFileDir = path.dirname(tempFilePath);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(tempFileDir)) {
      fs.mkdirSync(tempFileDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(tempFilePath, content);
  }
  
  // Modify the main contract file to use relative imports
  const mainContractPath = path.join(tempDir, `${contractName}.sol`);
  let mainContractContent = fs.readFileSync(mainContractPath, 'utf8');
  
  // Replace @uniswap/v3-core imports with relative imports
  mainContractContent = mainContractContent.replace(
    /@uniswap\/v3-core\/contracts\/libraries\/SafeCast\.sol/g,
    './libraries/SafeCast.sol'
  );
  
  mainContractContent = mainContractContent.replace(
    /@uniswap\/v3-core\/contracts\/libraries\/TickMath\.sol/g,
    './libraries/TickMath.sol'
  );
  
  mainContractContent = mainContractContent.replace(
    /@uniswap\/v3-core\/contracts\/interfaces\/IUniswapV3Pool\.sol/g,
    './interfaces/IUniswapV3Pool.sol'
  );
  
  // Write the modified file
  fs.writeFileSync(mainContractPath, mainContractContent);
  
  // Copy the v3-core files to the temporary directory
  const v3CoreFiles = {
    'libraries/SafeCast.sol': sourceFiles['libraries/SafeCast.sol'],
    'libraries/TickMath.sol': sourceFiles['libraries/TickMath.sol'],
    'interfaces/IUniswapV3Pool.sol': sourceFiles['interfaces/IUniswapV3Pool.sol'],
    'interfaces/pool/IUniswapV3PoolImmutables.sol': sourceFiles['interfaces/pool/IUniswapV3PoolImmutables.sol'],
    'interfaces/pool/IUniswapV3PoolState.sol': sourceFiles['interfaces/pool/IUniswapV3PoolState.sol'],
    'interfaces/pool/IUniswapV3PoolDerivedState.sol': sourceFiles['interfaces/pool/IUniswapV3PoolDerivedState.sol'],
    'interfaces/pool/IUniswapV3PoolActions.sol': sourceFiles['interfaces/pool/IUniswapV3PoolActions.sol'],
    'interfaces/pool/IUniswapV3PoolOwnerActions.sol': sourceFiles['interfaces/pool/IUniswapV3PoolOwnerActions.sol'],
    'interfaces/pool/IUniswapV3PoolEvents.sol': sourceFiles['interfaces/pool/IUniswapV3PoolEvents.sol'],
    'interfaces/callback/IUniswapV3SwapCallback.sol': sourceFiles['interfaces/callback/IUniswapV3SwapCallback.sol']
  };
  
  for (const [filePath, content] of Object.entries(v3CoreFiles)) {
    const tempFilePath = path.join(tempDir, filePath);
    const tempFileDir = path.dirname(tempFilePath);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(tempFileDir)) {
      fs.mkdirSync(tempFileDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(tempFilePath, content);
  }
  
  return tempDir;
}

/**
 * Get all source files from a directory
 * @param {string} dir The directory to search
 * @returns {object} The source files
 */
function getSourceFiles(dir) {
  const result = {};
  
  const files = fs.readdirSync(dir, { recursive: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (!stat.isDirectory() && file.endsWith('.sol')) {
      // Get the relative path from the directory
      const relativePath = path.relative(dir, filePath);
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
    
    // Create a temporary directory with modified imports
    const tempDirPath = createTempDirWithModifiedImports(contractName, sourceFiles);
    
    console.log(`Created temporary directory with modified imports: ${tempDirPath}`);
    
    // Get all source files from the temporary directory
    const tempSourceFiles = getSourceFiles(tempDirPath);
    
    console.log(`Found ${Object.keys(tempSourceFiles).length} source files in temporary directory`);
    
    // Get the main contract file
    const mainContractPath = `${contractName}.sol`;
    const mainContractContent = tempSourceFiles[mainContractPath];
    
    if (!mainContractContent) {
      console.error(`Main contract file not found: ${mainContractPath}`);
      return {
        success: false,
        error: `Main contract file not found: ${mainContractPath}`
      };
    }
    
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
      sourceFiles: tempSourceFiles
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
