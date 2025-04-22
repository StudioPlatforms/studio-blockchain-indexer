// Script to generate verification payloads for Uniswap V3 contracts
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Generating verification payloads for Uniswap V3 contracts...");
  
  // Load deployed contract addresses
  const deploymentPath = path.join(__dirname, "../deployed-contracts.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found. Please run deploy.js first.");
    process.exit(1);
  }
  
  const deployedContracts = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Loaded deployed contracts:", deployedContracts);
  
  // Create verification payloads directory if it doesn't exist
  const verificationDir = path.join(__dirname, "../verification-payloads");
  if (!fs.existsSync(verificationDir)) {
    fs.mkdirSync(verificationDir);
  }
  
  // Generate verification payload for UniswapV3Factory
  console.log("Generating payload for UniswapV3Factory...");
  const factoryPayload = await generatePayload(
    "UniswapV3Factory",
    deployedContracts.UniswapV3Factory,
    []
  );
  
  // Generate verification payload for NFTDescriptor
  console.log("Generating payload for NFTDescriptor...");
  const nftDescriptorPayload = await generatePayload(
    "NFTDescriptor",
    deployedContracts.NFTDescriptor,
    []
  );
  
  // Generate verification payload for NonfungibleTokenPositionDescriptor
  console.log("Generating payload for NonfungibleTokenPositionDescriptor...");
  const nonfungibleTokenPositionDescriptorPayload = await generatePayload(
    "NonfungibleTokenPositionDescriptor",
    deployedContracts.NonfungibleTokenPositionDescriptor,
    [
      deployedContracts.WSTO,
      "0x53544f0000000000000000000000000000000000000000000000000000000000" // STO symbol in hex
    ],
    {
      NFTDescriptor: deployedContracts.NFTDescriptor
    }
  );
  
  // Generate verification payload for NonfungiblePositionManager
  console.log("Generating payload for NonfungiblePositionManager...");
  const nonfungiblePositionManagerPayload = await generatePayload(
    "NonfungiblePositionManager",
    deployedContracts.NonfungiblePositionManager,
    [
      deployedContracts.UniswapV3Factory,
      deployedContracts.WSTO,
      deployedContracts.NonfungibleTokenPositionDescriptor
    ]
  );
  
  // Generate verification payload for SwapRouter
  console.log("Generating payload for SwapRouter...");
  const swapRouterPayload = await generatePayload(
    "SwapRouter",
    deployedContracts.SwapRouter,
    [
      deployedContracts.UniswapV3Factory,
      deployedContracts.WSTO
    ]
  );
  
  // Save all payloads to a single file
  const allPayloads = {
    UniswapV3Factory: factoryPayload,
    NFTDescriptor: nftDescriptorPayload,
    NonfungibleTokenPositionDescriptor: nonfungibleTokenPositionDescriptorPayload,
    NonfungiblePositionManager: nonfungiblePositionManagerPayload,
    SwapRouter: swapRouterPayload
  };
  
  const allPayloadsPath = path.join(verificationDir, "all-payloads.json");
  fs.writeFileSync(allPayloadsPath, JSON.stringify(allPayloads, null, 2));
  console.log(`All verification payloads saved to ${allPayloadsPath}`);
  
  // Save individual payloads
  for (const [name, payload] of Object.entries(allPayloads)) {
    const payloadPath = path.join(verificationDir, `${name}.json`);
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
    console.log(`${name} verification payload saved to ${payloadPath}`);
  }
  
  console.log("Verification payload generation completed successfully!");
}

async function generatePayload(contractName, contractAddress, constructorArgs, libraries = {}) {
  // Get the contract factory
  const contractFactory = await hre.ethers.getContractFactory(contractName, { libraries });
  
  // Get the contract bytecode
  const bytecode = contractFactory.bytecode;
  
  // Get the contract ABI
  const abi = contractFactory.interface.format("json");
  
  // Create the verification payload
  const payload = {
    name: contractName,
    address: contractAddress,
    constructorArguments: constructorArgs,
    bytecode,
    abi,
    libraries
  };
  
  return payload;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
