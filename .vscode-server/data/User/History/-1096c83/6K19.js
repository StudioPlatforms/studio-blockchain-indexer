const fs = require('fs');
const path = require('path');

// Directories
const contractsDir = path.join(__dirname, '../contracts');
const nodeModulesDir = path.join(__dirname, '../node_modules');
const outputDir = path.join(__dirname, '../flattened');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Set to track processed files to avoid duplicates
const processedFiles = new Set();
// Map to store license identifiers
const licenseIdentifiers = new Map();
// Set to track pragma directives
const pragmaDirectives = new Set();
// Set to track import statements to remove
const importStatements = new Set();

/**
 * Read a file and return its content
 * @param {string} filePath The path to the file
 * @returns {string} The file content
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Resolve an import path to a file path
 * @param {string} importPath The import path
 * @param {string} currentDir The current directory
 * @returns {string} The resolved file path
 */
function resolveImport(importPath, currentDir) {
  // Check if it's a relative import
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return path.resolve(currentDir, importPath);
  }
  
  // Check if it's a node_modules import
  return path.join(nodeModulesDir, importPath);
}

/**
 * Process a file and its imports
 * @param {string} filePath The path to the file
 * @param {string} currentDir The current directory
 * @returns {string} The processed file content
 */
function processFile(filePath, currentDir) {
  // Skip if already processed
  if (processedFiles.has(filePath)) {
    return '';
  }
  
  // Read the file
  const content = readFile(filePath);
  if (!content) {
    return '';
  }
  
  // Mark as processed
  processedFiles.add(filePath);
  
  // Extract license identifier
  const licenseMatch = content.match(/\/\/\s*SPDX-License-Identifier:\s*([^\n\r]+)/);
  if (licenseMatch && licenseMatch[1]) {
    licenseIdentifiers.set(filePath, licenseMatch[1].trim());
  }
  
  // Extract pragma directives
  const pragmaMatches = content.matchAll(/pragma\s+([^;]+);/g);
  for (const match of pragmaMatches) {
    pragmaDirectives.add(match[0]);
  }
  
  // Extract import statements
  const importMatches = content.matchAll(/import\s+['"]([^'"]+)['"]/g);
  let processedContent = content;
  
  for (const match of importMatches) {
    const importPath = match[1];
    const importStatement = match[0];
    importStatements.add(importStatement);
    
    // Resolve the import path
    const importFilePath = resolveImport(importPath, currentDir);
    const importDir = path.dirname(importFilePath);
    
    // Process the imported file
    processFile(importFilePath, importDir);
  }
  
  return processedContent;
}

/**
 * Flatten a contract
 * @param {string} contractName The name of the contract
 */
function flattenContract(contractName) {
  console.log(`Flattening contract: ${contractName}`);
  
  // Clear sets and maps
  processedFiles.clear();
  licenseIdentifiers.clear();
  pragmaDirectives.clear();
  importStatements.clear();
  
  // Process the main contract file
  const mainFilePath = path.join(contractsDir, `${contractName}.sol`);
  const mainDir = path.dirname(mainFilePath);
  const content = processFile(mainFilePath, mainDir);
  
  if (!content) {
    console.error(`Failed to process main contract file: ${mainFilePath}`);
    return;
  }
  
  // Create the flattened content
  let flattenedContent = '';
  
  // Add license identifiers
  if (licenseIdentifiers.size > 0) {
    flattenedContent += `// SPDX-License-Identifier: ${Array.from(licenseIdentifiers.values())[0]}\n\n`;
  }
  
  // Add pragma directives
  for (const pragma of pragmaDirectives) {
    flattenedContent += `${pragma}\n`;
  }
  
  flattenedContent += '\n';
  
  // Add all processed files
  for (const filePath of processedFiles) {
    let fileContent = readFile(filePath);
    
    // Remove license identifiers
    fileContent = fileContent.replace(/\/\/\s*SPDX-License-Identifier:[^\n\r]+[\n\r]/g, '');
    
    // Remove pragma directives
    fileContent = fileContent.replace(/pragma\s+[^;]+;/g, '');
    
    // Remove import statements
    for (const importStatement of importStatements) {
      fileContent = fileContent.replace(new RegExp(importStatement, 'g'), '');
    }
    
    // Add the file content
    flattenedContent += `// File: ${path.relative(process.cwd(), filePath)}\n`;
    flattenedContent += fileContent.trim() + '\n\n';
  }
  
  // Write the flattened content to a file
  const outputPath = path.join(outputDir, `${contractName}_flattened.sol`);
  fs.writeFileSync(outputPath, flattenedContent);
  
  console.log(`Flattened contract written to: ${outputPath}`);
}

// Flatten the SwapRouter contract
flattenContract('SwapRouter');
