const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Indexer API URL
const INDEXER_API_URL = 'http://localhost:3000';

// Verification payloads directory
const PAYLOADS_DIR = path.join(__dirname, '../verification-payloads');

// Helper function to read a verification payload
function readVerificationPayload(fileName) {
  return JSON.parse(fs.readFileSync(path.join(PAYLOADS_DIR, fileName), 'utf8'));
}

// Helper function to send a verification request
async function sendVerificationRequest(payload) {
  try {
    // Create a new verification payload with the correct format
    const verificationPayload = {
      address: payload.address,
      contractName: payload.name,
      compilerVersion: "0.7.6",
      optimizationUsed: true,
      runs: 200,
      evmVersion: "istanbul",
      sourceCode: payload.bytecode,
      libraries: payload.libraries || {}
    };
    
    // Fix ABI format if needed
    if (payload.abi) {
      try {
        // If it's a string, try to parse it
        if (typeof payload.abi === 'string') {
          // Fix missing commas in the ABI
          const fixedAbi = payload.abi.replace(/"\s*(\w+):/g, '","$1:').replace(/\}\s*\{/g, '},{');
          verificationPayload.abi = JSON.parse(`[${fixedAbi.replace(/^\[|\]$/g, '')}]`);
        } else {
          verificationPayload.abi = payload.abi;
        }
      } catch (e) {
        console.error('Error parsing ABI:', e);
      }
    }
    
    // Add constructor arguments if they exist
    if (payload.constructorArguments && payload.constructorArguments.length > 0) {
      verificationPayload.constructorArguments = payload.constructorArguments.join('');
    }
    
    // Debug log
    console.log('Verification payload:', JSON.stringify(verificationPayload, null, 2));
    
    console.log(`Verifying contract ${verificationPayload.contractName} at ${verificationPayload.address}...`);
    
    const response = await axios.post(`${INDEXER_API_URL}/contracts/verify`, verificationPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    console.error(`Error verifying contract ${payload.contractName}:`, error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Verify a contract using its payload file
async function verifyContract(fileName) {
  try {
    const payload = readVerificationPayload(fileName);
    const result = await sendVerificationRequest(payload);
    
    if (result.success) {
      console.log(`✅ Contract ${payload.contractName} verified successfully!`);
      console.log(`Response: ${JSON.stringify(result.data, null, 2)}`);
    } else {
      console.log(`❌ Failed to verify contract ${payload.contractName}`);
      console.log(`Error: ${JSON.stringify(result.error, null, 2)}`);
      
      // If the error is related to missing imports, try with a simplified payload
      if (result.error?.error?.includes('import') && !fileName.includes('_simplified')) {
        console.log(`Trying with simplified payload for ${payload.contractName}...`);
        await verifyContract(`${payload.contractName}_simplified.json`);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error processing verification for ${fileName}:`, error);
    return { success: false, error: error.message };
  }
}

// Verify all contracts in order
async function verifyAllContracts() {
  try {
    // Verify contracts in the correct order
    const contracts = [
      'UniswapV3Factory.json',
      'NFTDescriptor.json',
      'NonfungibleTokenPositionDescriptor.json',
      'NonfungiblePositionManager.json',
      'SwapRouter.json'
    ];
    
    for (const contractFile of contracts) {
      const result = await verifyContract(contractFile);
      
      // Add a delay between verification requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!result.success) {
        console.log(`Verification failed for ${contractFile}. Continuing with next contract...`);
      }
    }
    
    console.log('Verification process completed!');
  } catch (error) {
    console.error('Error during verification process:', error);
  }
}

// Try different verification approaches for a specific contract
async function tryDifferentApproaches(contractName) {
  try {
    console.log(`Trying different verification approaches for ${contractName}...`);
    
    // Try with the full payload
    console.log(`1. Trying with full payload...`);
    const fullResult = await verifyContract(`${contractName}.json`);
    
    if (fullResult.success) {
      console.log(`✅ Full payload verification successful!`);
      return fullResult;
    }
    
    // Try with simplified payload
    console.log(`2. Trying with simplified payload...`);
    const simplifiedResult = await verifyContract(`${contractName}_simplified.json`);
    
    if (simplifiedResult.success) {
      console.log(`✅ Simplified payload verification successful!`);
      return simplifiedResult;
    }
    
    // If both approaches failed, log the errors
    console.log(`❌ All verification approaches failed for ${contractName}`);
    console.log(`Full payload error: ${JSON.stringify(fullResult.error, null, 2)}`);
    console.log(`Simplified payload error: ${JSON.stringify(simplifiedResult.error, null, 2)}`);
    
    return { success: false, errors: { full: fullResult.error, simplified: simplifiedResult.error } };
  } catch (error) {
    console.error(`Error trying different approaches for ${contractName}:`, error);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  try {
    // Check if a specific contract was specified
    const contractName = process.argv[2];
    
    if (contractName) {
      // Verify a specific contract
      await tryDifferentApproaches(contractName);
    } else {
      // Verify all contracts
      await verifyAllContracts();
    }
  } catch (error) {
    console.error('Error in verification script:', error);
  }
}

// Run the main function
main().catch(console.error);
