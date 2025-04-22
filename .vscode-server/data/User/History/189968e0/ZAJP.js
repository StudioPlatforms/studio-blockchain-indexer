/**
 * ERC20 Token Verification Example
 * 
 * This script demonstrates how to verify an ERC20 token contract on Studio Blockchain Explorer.
 * 
 * Usage:
 * 1. Update the contract address and constructor arguments
 * 2. Make sure your hardhat.config.js has the correct Studio blockchain settings:
 *    - RPC URL: https://mainnet.studio-blockchain.com
 *    - Chain ID: 240241
 *    - API URL: https://mainnetindexer.studio-blockchain.com
 *    - Browser URL: https://studio-scan.com
 * 3. Run with: npx hardhat run erc20-verification-example.js --network studio
 */

const hre = require("hardhat");

async function main() {
  // ======= CONFIGURATION - UPDATE THESE VALUES =======
  
  // The address of your deployed ERC20 token contract
  const contractAddress = "0xYourTokenContractAddress";
  
  // The name of your contract (must match the .sol file name without extension)
  const contractName = "MyToken";
  
  // Constructor arguments used when deploying the contract
  // For a typical ERC20 token, these might be:
  // - name: Token name (string)
  // - symbol: Token symbol (string)
  // - decimals: Number of decimals (number)
  // - initialSupply: Initial token supply (BigNumber)
  const tokenName = "My Example Token";
  const tokenSymbol = "MET";
  const tokenDecimals = 18;
  const initialSupply = "1000000000000000000000000"; // 1 million tokens with 18 decimals
  
  // ======= VERIFICATION PROCESS =======
  
  console.log(`Verifying ERC20 token contract at ${contractAddress}...`);
  console.log(`Token Name: ${tokenName}`);
  console.log(`Token Symbol: ${tokenSymbol}`);
  console.log(`Decimals: ${tokenDecimals}`);
  console.log(`Initial Supply: ${initialSupply}`);
  
  try {
    // Verify the contract
    await hre.run("verify:verify", {
      address: contractAddress,
      contract: `contracts/${contractName}.sol:${contractName}`, // Path to contract file and contract name
      constructorArguments: [
        tokenName,
        tokenSymbol,
        tokenDecimals,
        initialSupply
      ],
    });
    
    console.log("\n✅ Contract verified successfully!");
    console.log(`You can view your verified contract at: https://studio-scan.com/address/${contractAddress}`);
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    
    // Provide helpful troubleshooting tips based on common errors
    if (error.message.includes("Already Verified")) {
      console.log("\n📝 Note: This contract has already been verified.");
    } else if (error.message.includes("Bytecode")) {
      console.log("\n📝 Troubleshooting tips for bytecode mismatch:");
      console.log("  - Ensure you're using the exact same Solidity version used for deployment");
      console.log("  - Check that optimizer settings match what was used during deployment");
      console.log("  - Verify that the EVM version matches what was used during deployment");
      console.log("  - Make sure constructor arguments are in the correct order and format");
    } else if (error.message.includes("constructor arguments")) {
      console.log("\n📝 Troubleshooting tips for constructor arguments:");
      console.log("  - Ensure arguments are in the same order as in your contract constructor");
      console.log("  - Check that numeric values have the correct number of decimals");
      console.log("  - Verify that addresses are correctly formatted");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
