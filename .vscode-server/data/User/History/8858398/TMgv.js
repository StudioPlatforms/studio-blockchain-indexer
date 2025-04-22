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
 * Create a sourceFiles object with the exact import paths
 * @param {string} contractName The name of the contract
 * @param {object} sourceFiles The source files
 * @returns {object} The sourceFiles object with exact import paths
 */
function createSourceFilesWithExactImportPaths(contractName, sourceFiles) {
  const result = {};
  const processedFiles = new Set();
  const filesToProcess = [`${contractName}.sol`];
  
  // Process all files recursively
  while (filesToProcess.length > 0) {
    const currentFilePath = filesToProcess.pop();
    
    // Skip if already processed
    if (processedFiles.has(currentFilePath)) {
      continue;
    }
    
    // Mark as processed
    processedFiles.add(currentFilePath);
    
    // Get the file content
    const content = sourceFiles[currentFilePath];
    
    if (!content) {
      console.warn(`File not found: ${currentFilePath}`);
      continue;
    }
    
    // Add the file to the result with its original path
    result[currentFilePath] = content;
    
    // Extract imports
    const imports = extractImports(content);
    
    // Process each import
    for (const importPath of imports) {
      // Skip if already processed
      if (processedFiles.has(importPath)) {
        continue;
      }
      
      // Handle relative imports
      let resolvedPath = importPath;
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const currentDir = path.dirname(currentFilePath);
        resolvedPath = path.normalize(path.join(currentDir, importPath)).replace(/\\/g, '/');
      }
      
      // Try to find the file in the sourceFiles
      if (sourceFiles[resolvedPath]) {
        // Add the file to the result with the exact import path
        result[importPath] = sourceFiles[resolvedPath];
        filesToProcess.push(resolvedPath);
      } else {
        // Try to find the file by its basename
        const importFileName = path.basename(importPath);
        let found = false;
        
        for (const [sourceFilePath, sourceFileContent] of Object.entries(sourceFiles)) {
          if (path.basename(sourceFilePath) === importFileName) {
            // Add the file to the result with the exact import path
            result[importPath] = sourceFileContent;
            filesToProcess.push(sourceFilePath);
            found = true;
            console.log(`Mapped ${importPath} to ${sourceFilePath}`);
            break;
          }
        }
        
        if (!found) {
          console.warn(`Could not find mapping for import: ${importPath}`);
        }
      }
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
    
    // Create a sourceFiles object with the exact import paths
    const exactPathSourceFiles = createSourceFilesWithExactImportPaths(contractName, sourceFiles);
    
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
