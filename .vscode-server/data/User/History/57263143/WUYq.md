# Guide: Verifying Smart Contracts on Studio Using Hardhat

This guide will walk you through the process of verifying your smart contracts on Studio Blockchain Explorer using Hardhat.

## Prerequisites

- A deployed smart contract on the Studio blockchain
- The contract's source code
- The contract's deployment parameters (constructor arguments, libraries, etc.)
- Node.js and npm installed

## Step 1: Set Up Your Hardhat Project

If you haven't already, set up a Hardhat project:

```bash
# Create a new directory for your project (if needed)
mkdir my-contract-project
cd my-contract-project

# Initialize a new npm project
npm init -y

# Install Hardhat
npm install --save-dev hardhat

# Initialize Hardhat
npx hardhat
```

Select "Create an empty hardhat.config.js" when prompted.

## Step 2: Install Required Plugins

Install the Hardhat verification plugin:

```bash
npm install --save-dev @nomicfoundation/hardhat-verify
```

## Step 3: Configure Hardhat

Update your `hardhat.config.js` file to include the Studio network and verification settings:

```javascript
require("@nomicfoundation/hardhat-verify");
require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20", // Use the same version you used to compile your contract
    settings: {
      optimizer: {
        enabled: true, // Set to the same value used during deployment
        runs: 200      // Set to the same value used during deployment
      },
      evmVersion: "cancun" // Set to the same EVM version used during deployment
    }
  },
  networks: {
    studio: {
      url: "https://studio-blockchain-rpc-endpoint.com", // Replace with actual Studio RPC endpoint
      accounts: [process.env.PRIVATE_KEY] // Your private key for deployment (if needed)
    }
  },
  etherscan: {
    apiKey: {
      studio: "dummy" // API key is not required for Studio, but the field is needed
    },
    customChains: [
      {
        network: "studio",
        chainId: 1234, // Replace with actual Studio chain ID
        urls: {
          apiURL: "https://studio-explorer-api.com/api", // Replace with actual Studio API endpoint
          browserURL: "https://studio-explorer.com" // Replace with actual Studio Explorer URL
        }
      }
    ]
  }
};
```

Make sure to:
- Use the exact same Solidity version that was used to deploy your contract
- Set the optimizer settings to match what was used during deployment
- Set the EVM version to match what was used during deployment
- Replace the placeholder URLs and chain ID with the actual Studio blockchain details

## Step 4: Create a Verification Script

Create a file named `verify.js` in your project:

```javascript
const hre = require("hardhat");

async function main() {
  const contractAddress = "0xYourContractAddress"; // Replace with your contract address
  const contractName = "YourContractName"; // Replace with your contract name
  
  // For contracts with constructor arguments
  const constructorArguments = [
    // Add your constructor arguments in the same order they were used during deployment
    // For example:
    // "0x1234567890123456789012345678901234567890", // address parameter
    // "Token Name",                                 // string parameter
    // "TKN",                                        // string parameter
    // 18,                                           // number parameter
    // 1000000000000000000000000n                    // BigNumber parameter
  ];
  
  // For contracts that use libraries
  const libraries = {
    // "LibraryName": "0xLibraryAddress",
  };

  console.log("Verifying contract...");
  
  try {
    // Verify the contract
    await hre.run("verify:verify", {
      address: contractAddress,
      contract: `contracts/${contractName}.sol:${contractName}`, // Path to the contract file and contract name
      constructorArguments: constructorArguments,
      libraries: libraries
    });
    
    console.log("Contract verified successfully!");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Make sure to:
- Replace `0xYourContractAddress` with your actual contract address
- Replace `YourContractName` with your actual contract name
- Add your constructor arguments in the same order they were used during deployment
- Add any libraries used by your contract

## Step 5: Run the Verification Script

Run the verification script:

```bash
npx hardhat run verify.js --network studio
```

If successful, you should see a message indicating that your contract has been verified.

## Alternative: Direct Verification Command

Instead of creating a script, you can also verify your contract directly using the Hardhat CLI:

```bash
npx hardhat verify --network studio 0xYourContractAddress [constructor arguments]
```

For contracts with libraries:

```bash
npx hardhat verify --network studio --libraries "LibraryName:0xLibraryAddress" 0xYourContractAddress [constructor arguments]
```

## Troubleshooting

### 1. Verification Fails with "Bytecode Mismatch"

This is the most common issue and usually happens when:

- The Solidity compiler version used for verification doesn't match the one used for deployment
- The optimizer settings (enabled/disabled, runs) don't match
- The EVM version doesn't match
- The constructor arguments are incorrect or in the wrong format
- The libraries are incorrect or missing

Solution:
- Double-check all compiler settings and make sure they match exactly what was used during deployment
- Ensure constructor arguments are in the correct order and format
- Verify that all libraries are correctly specified

### 2. "Contract Source Code Not Verified"

This can happen if:

- The contract name is incorrect
- The path to the contract file is incorrect
- The contract source code has been modified since deployment

Solution:
- Check the contract name and path
- Make sure you're using the exact same source code that was used for deployment

### 3. "Invalid Constructor Arguments"

This can happen if:

- The constructor arguments are in the wrong format
- The constructor arguments are in the wrong order
- The constructor arguments don't match what was used during deployment

Solution:
- Ensure constructor arguments are in the correct order and format
- For complex types (arrays, structs), make sure they're properly encoded

### 4. "Library Address Not Found"

This can happen if:

- The library address is incorrect
- The library name is incorrect
- The library wasn't linked during deployment

Solution:
- Check the library name and address
- Make sure the library was actually linked during deployment

## Advanced: Verifying Contracts with Complex Constructor Arguments

For contracts with complex constructor arguments (arrays, structs, etc.), you may need to encode them properly:

```javascript
const { ethers } = require("hardhat");

// Example: Encoding an array of addresses
const addresses = [
  "0x1234567890123456789012345678901234567890",
  "0x2345678901234567890123456789012345678901",
  "0x3456789012345678901234567890123456789012"
];

// Example: Encoding a struct
const struct = {
  name: "Token Name",
  symbol: "TKN",
  decimals: 18,
  totalSupply: ethers.parseEther("1000000")
};

// Add these to your constructorArguments array
const constructorArguments = [
  addresses,
  struct.name,
  struct.symbol,
  struct.decimals,
  struct.totalSupply
];
```

## Advanced: Verifying Contracts with Multiple Source Files

If your contract imports other contracts or libraries, make sure all source files are in the correct location in your project. The verification process will automatically include all imported files.

## Conclusion

By following this guide, you should be able to verify your smart contracts on the Studio Blockchain Explorer using Hardhat. Once verified, your contract's source code, ABI, and other details will be publicly available on the explorer, making it easier for users to interact with your contract.

Remember that contract verification is an important step in ensuring transparency and trust in your smart contract. It allows users to verify that the contract code matches what you claim it does, and it makes it easier for them to interact with your contract through the explorer's interface.
