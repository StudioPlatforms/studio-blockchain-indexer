# Quick Guide: Verifying Your Contract on Studio

This is a simplified step-by-step guide for verifying your smart contract on Studio Blockchain Explorer using Hardhat.

## Step 1: Install Required Packages

```bash
# Install Hardhat and verification plugin
npm install --save-dev hardhat @nomicfoundation/hardhat-verify @nomicfoundation/hardhat-ethers
```

## Step 2: Configure Hardhat

Create or update your `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-verify");
require("@nomicfoundation/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.20", // IMPORTANT: Use the EXACT version you used for deployment
    settings: {
      optimizer: {
        enabled: true, // Must match deployment settings
        runs: 200      // Must match deployment settings
      },
      evmVersion: "cancun" // Must match deployment settings
    }
  },
  networks: {
    studio: {
      url: "https://mainnet.studio-blockchain.com", // Studio RPC endpoint
      chainId: 240241 // Studio chain ID
    }
  },
  etherscan: {
    apiKey: {
      studio: "dummy" // API key placeholder (required field)
    },
    customChains: [
      {
        network: "studio",
        chainId: 240241, // Studio chain ID
        urls: {
          apiURL: "https://mainnetindexer.studio-blockchain.com/contracts/verify", // Studio API endpoint
          browserURL: "https://studio-scan.com" // Studio Explorer URL
        }
      }
    ]
  }
};
```

## Step 3: Verify Your Contract

### Option 1: Direct Command (Simplest)

```bash
npx hardhat verify --network studio 0xYourContractAddress [constructor arguments]
```

Example with constructor arguments:
```bash
npx hardhat verify --network studio 0x1234567890123456789012345678901234567890 "Token Name" "TKN" 18 1000000000000000000000000
```

### Option 2: Using a Script

Create a file named `verify.js`:

```javascript
const hre = require("hardhat");

async function main() {
  await hre.run("verify:verify", {
    address: "0xYourContractAddress", // Replace with your contract address
    constructorArguments: [
      // Add your constructor arguments in the same order as in your contract
      "Token Name",
      "TKN",
      18,
      "1000000000000000000000000"
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Run the script:
```bash
npx hardhat run verify.js --network studio
```

## Common Issues & Solutions

### 1. Bytecode Mismatch
- **Problem**: The compiled bytecode doesn't match the deployed bytecode
- **Solution**: Ensure compiler version, optimizer settings, and EVM version EXACTLY match what was used during deployment

### 2. Constructor Arguments
- **Problem**: Incorrect constructor arguments
- **Solution**: Provide arguments in the EXACT same order and format as in your contract constructor

### 3. Libraries
- **Problem**: Missing or incorrect library addresses
- **Solution**: Specify libraries with the `--libraries` flag:
  ```bash
  npx hardhat verify --network studio --libraries "LibraryName:0xLibraryAddress" 0xYourContractAddress
  ```

### 4. Complex Arguments
- **Problem**: Arrays, structs, or other complex types
- **Solution**: For complex arguments, use a verification script (Option 2) and format the arguments correctly

## Verification Checklist

✅ Using EXACT same Solidity version as deployment  
✅ Using EXACT same optimizer settings as deployment  
✅ Using EXACT same EVM version as deployment  
✅ Constructor arguments in correct order  
✅ All library addresses specified correctly  
✅ Source code matches exactly what was deployed  

## Need More Help?

For more detailed instructions, see the comprehensive guide: [hardhat-contract-verification-guide.md](./hardhat-contract-verification-guide.md)
