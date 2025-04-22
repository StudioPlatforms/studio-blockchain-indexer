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
 * Create a mapping between import paths and file paths
 * @param {object} sourceFiles The source files
 * @returns {object} The import mappings
 */
function createImportMappings(sourceFiles) {
  const importMappings = {};
  
  // First, add all files with their original paths
  for (const [filePath, content] of Object.entries(sourceFiles)) {
    importMappings[filePath] = content;
  }
  
  // Then, add mappings for the import paths
  for (const [filePath, content] of Object.entries(sourceFiles)) {
    // Extract imports from the file
    const imports = extractImports(content);
    
    // For each import, try to find the corresponding file
    for (const importPath of imports) {
      // Skip if already mapped
      if (importMappings[importPath]) {
        continue;
      }
      
      // Try to find the file in the sourceFiles
      let found = false;
      
      // Case 1: Direct match
      if (sourceFiles[importPath]) {
        importMappings[importPath] = sourceFiles[importPath];
        found = true;
        continue;
      }
      
      // Case 2: Match by filename
      const importFileName = path.basename(importPath);
      for (const [sourceFilePath, sourceFileContent] of Object.entries(sourceFiles)) {
        if (path.basename(sourceFilePath) === importFileName) {
          importMappings[importPath] = sourceFileContent;
          found = true;
          break;
        }
      }
      
      // Case 3: For @uniswap/v3-core imports, map to the corresponding file
      if (!found && importPath.startsWith('@uniswap/v3-core/')) {
        const relativePath = importPath.replace('@uniswap/v3-core/contracts/', '');
        for (const [sourceFilePath, sourceFileContent] of Object.entries(sourceFiles)) {
          if (sourceFilePath.endsWith(relativePath)) {
            importMappings[importPath] = sourceFileContent;
            found = true;
            break;
          }
        }
      }
      
      // Case 4: For relative imports, try to resolve the path
      if (!found && (importPath.startsWith('./') || importPath.startsWith('../'))) {
        const importDir = path.dirname(filePath);
        const resolvedPath = path.normalize(path.join(importDir, importPath));
        const normalizedPath = resolvedPath.replace(/\\/g, '/');
        
        if (sourceFiles[normalizedPath]) {
          importMappings[importPath] = sourceFiles[normalizedPath];
          found = true;
        }
      }
      
      // Case 5: For imports without a path prefix, try to find in the same directory
      if (!found && !importPath.includes('/')) {
        const importDir = path.dirname(filePath);
        const resolvedPath = path.normalize(path.join(importDir, importPath));
        const normalizedPath = resolvedPath.replace(/\\/g, '/');
        
        if (sourceFiles[normalizedPath]) {
          importMappings[importPath] = sourceFiles[normalizedPath];
          found = true;
        }
      }
      
      if (!found) {
        console.warn(`Could not find mapping for import: ${importPath} in file: ${filePath}`);
      }
    }
  }
  
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
    
    // Create import mappings
    const importMappings = createImportMappings(sourceFiles);
    
    console.log(`Created ${Object.keys(importMappings).length} import mappings`);
    
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
      importMappings: importMappings
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
      importMappingsCount: Object.keys(verificationRequest.importMappings).length
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
