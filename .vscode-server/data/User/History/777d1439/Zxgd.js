const fs = require('fs');
const path = require('path');

// Contract addresses from deployment
const ADDRESSES = {
  WSTO: '0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0',
  UniswapV3Factory: '0x6f1aF63eb91723a883c632E38D34f2cB6090b805',
  NFTDescriptor: '0x6E186Abde1aedCCa4EAa08b4960b2A2CC422fEd6',
  NonfungibleTokenPositionDescriptor: '0x68550Fc74cf81066ef7b8D991Ce76C8cf685F346',
  NonfungiblePositionManager: '0x402306D1864657168B7614E459C7f3d5be0677eA',
  SwapRouter: '0x5D16d5b06bB052A91D74099A70D4048143a56406'
};

// Constructor arguments
const CONSTRUCTOR_ARGS = {
  SwapRouter: '0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db0',
  NonfungibleTokenPositionDescriptor: '0000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db053544f0000000000000000000000000000000000000000000000000000000000',
  NonfungiblePositionManager: '0000000000000000000000006f1af63eb91723a883c632e38d34f2cb6090b8050000000000000000000000005cca138772f7ec71adf95029291f87d26d0c0db000000000000000000000000068550fc74cf81066ef7b8d991ce76c8cf685f346'
};

// Libraries
const LIBRARIES = {
  NonfungibleTokenPositionDescriptor: {
    NFTDescriptor: ADDRESSES.NFTDescriptor
  }
};

// Contract source files
const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const OUTPUT_DIR = path.join(__dirname, '../verification-payloads');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to read a contract file
function readContractFile(filePath) {
  return fs.readFileSync(path.join(CONTRACTS_DIR, filePath), 'utf8');
}

// Helper function to get all files in a directory recursively
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(path.relative(CONTRACTS_DIR, filePath));
    }
  });
  
  return fileList;
}

// Generate verification payload for a contract
function generateVerificationPayload(contractName, isMultiPart = false) {
  const address = ADDRESSES[contractName];
  const constructorArguments = CONSTRUCTOR_ARGS[contractName] || '';
  const libraries = LIBRARIES[contractName] || {};
  
  let payload;
  
  if (isMultiPart) {
    // Get all contract files
    const allFiles = getAllFiles(CONTRACTS_DIR);
    const sourceFiles = {};
    
    // Read all contract files
    allFiles.forEach(file => {
      sourceFiles[file] = readContractFile(file);
    });
    
    payload = {
      address,
      compilerVersion: '0.7.6',
      contractName,
      optimizationUsed: true,
      runs: 200,
      evmVersion: 'istanbul',
      isMultiPart: true,
      sourceFiles
    };
    
    if (constructorArguments) {
      payload.constructorArguments = constructorArguments;
    }
    
    if (Object.keys(libraries).length > 0) {
      payload.libraries = libraries;
    }
  } else {
    // For single file contracts
    const mainFile = `${contractName}.sol`;
    const sourceCode = readContractFile(mainFile);
    
    payload = {
      address,
      compilerVersion: '0.7.6',
      contractName,
      optimizationUsed: true,
      runs: 200,
      evmVersion: 'istanbul',
      sourceCode
    };
    
    if (constructorArguments) {
      payload.constructorArguments = constructorArguments;
    }
  }
  
  return payload;
}

// Generate verification payloads for all contracts
function generateAllVerificationPayloads() {
  // Generate payload for UniswapV3Factory
  const factoryPayload = generateVerificationPayload('UniswapV3Factory', true);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'UniswapV3Factory.json'),
    JSON.stringify(factoryPayload, null, 2)
  );
  console.log('Generated verification payload for UniswapV3Factory');
  
  // Generate payload for NFTDescriptor
  const nftDescriptorPayload = generateVerificationPayload('NFTDescriptor', true);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'NFTDescriptor.json'),
    JSON.stringify(nftDescriptorPayload, null, 2)
  );
  console.log('Generated verification payload for NFTDescriptor');
  
  // Generate payload for NonfungibleTokenPositionDescriptor
  const descriptorPayload = generateVerificationPayload('NonfungibleTokenPositionDescriptor', true);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'NonfungibleTokenPositionDescriptor.json'),
    JSON.stringify(descriptorPayload, null, 2)
  );
  console.log('Generated verification payload for NonfungibleTokenPositionDescriptor');
  
  // Generate payload for NonfungiblePositionManager
  const managerPayload = generateVerificationPayload('NonfungiblePositionManager', true);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'NonfungiblePositionManager.json'),
    JSON.stringify(managerPayload, null, 2)
  );
  console.log('Generated verification payload for NonfungiblePositionManager');
  
  // Generate payload for SwapRouter
  const routerPayload = generateVerificationPayload('SwapRouter', true);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'SwapRouter.json'),
    JSON.stringify(routerPayload, null, 2)
  );
  console.log('Generated verification payload for SwapRouter');
}

// Generate flattened verification payloads
async function generateFlattenedPayloads() {
  // This would require running the Hardhat flattener
  console.log('To generate flattened payloads, run:');
  console.log('npx hardhat flatten contracts/UniswapV3Factory.sol > flattened/UniswapV3Factory.sol');
  console.log('npx hardhat flatten contracts/NFTDescriptor.sol > flattened/NFTDescriptor.sol');
  console.log('npx hardhat flatten contracts/NonfungibleTokenPositionDescriptor.sol > flattened/NonfungibleTokenPositionDescriptor.sol');
  console.log('npx hardhat flatten contracts/NonfungiblePositionManager.sol > flattened/NonfungiblePositionManager.sol');
  console.log('npx hardhat flatten contracts/SwapRouter.sol > flattened/SwapRouter.sol');
}

// Create a simplified verification payload for testing
function generateSimplifiedPayload(contractName) {
  const address = ADDRESSES[contractName];
  const constructorArguments = CONSTRUCTOR_ARGS[contractName] || '';
  
  // For the main contract file only
  const mainFileName = `${contractName}.sol`;
  let sourceFiles = {};
  
  try {
    sourceFiles[mainFileName] = readContractFile(mainFileName);
    
    // Add direct dependencies based on import statements
    const importRegex = /import ['"](.+?)['"];/g;
    let match;
    while ((match = importRegex.exec(sourceFiles[mainFileName])) !== null) {
      const importPath = match[1];
      try {
        sourceFiles[importPath] = readContractFile(importPath);
      } catch (err) {
        console.warn(`Could not find import: ${importPath}`);
      }
    }
  } catch (err) {
    console.error(`Error reading contract file for ${contractName}:`, err);
    return null;
  }
  
  const payload = {
    address,
    compilerVersion: '0.7.6',
    contractName,
    optimizationUsed: true,
    runs: 200,
    evmVersion: 'istanbul',
    isMultiPart: true,
    sourceFiles
  };
  
  if (constructorArguments) {
    payload.constructorArguments = constructorArguments;
  }
  
  return payload;
}

// Generate simplified payloads for testing
function generateSimplifiedPayloads() {
  const contracts = ['UniswapV3Factory', 'NFTDescriptor', 'NonfungibleTokenPositionDescriptor', 'NonfungiblePositionManager', 'SwapRouter'];
  
  for (const contractName of contracts) {
    const payload = generateSimplifiedPayload(contractName);
    if (payload) {
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${contractName}_simplified.json`),
        JSON.stringify(payload, null, 2)
      );
      console.log(`Generated simplified verification payload for ${contractName}`);
    }
  }
}

// Main function
async function main() {
  try {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Generate verification payloads
    generateAllVerificationPayloads();
    
    // Generate simplified payloads for testing
    generateSimplifiedPayloads();
    
    // Provide instructions for flattened payloads
    await generateFlattenedPayloads();
    
    console.log('All verification payloads generated successfully!');
  } catch (error) {
    console.error('Error generating verification payloads:', error);
  }
}

// Run the main function
main().catch(console.error);
