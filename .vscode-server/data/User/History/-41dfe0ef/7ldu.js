// Script to deploy Uniswap V3 contracts to Studio blockchain
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Uniswap V3 contracts to Studio blockchain...");
  
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Get the initial balance
  const initialBalance = await deployer.getBalance();
  console.log(`Initial balance: ${hre.ethers.utils.formatEther(initialBalance)} ETH`);
  
  // Deploy contracts
  const deployedContracts = {};
  
  // WSTO address (already deployed on Studio blockchain)
  const WSTO_ADDRESS = "0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0";
  deployedContracts.WSTO = WSTO_ADDRESS;
  console.log(`Using existing WSTO at: ${WSTO_ADDRESS}`);
  
  // Deploy UniswapV3Factory
  console.log("Deploying UniswapV3Factory...");
  const UniswapV3Factory = await hre.ethers.getContractFactory("UniswapV3Factory");
  const factory = await UniswapV3Factory.deploy();
  await factory.deployed();
  deployedContracts.UniswapV3Factory = factory.address;
  console.log(`UniswapV3Factory deployed to: ${factory.address}`);
  
  // Deploy NFTDescriptor
  console.log("Deploying NFTDescriptor...");
  const NFTDescriptor = await hre.ethers.getContractFactory("NFTDescriptor");
  const nftDescriptor = await NFTDescriptor.deploy();
  await nftDescriptor.deployed();
  deployedContracts.NFTDescriptor = nftDescriptor.address;
  console.log(`NFTDescriptor deployed to: ${nftDescriptor.address}`);
  
  // Deploy NonfungibleTokenPositionDescriptor
  console.log("Deploying NonfungibleTokenPositionDescriptor...");
  const NonfungibleTokenPositionDescriptor = await hre.ethers.getContractFactory(
    "NonfungibleTokenPositionDescriptor",
    {
      libraries: {
        NFTDescriptor: nftDescriptor.address,
      },
    }
  );
  const nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deploy(
    WSTO_ADDRESS,
    // Native currency symbol (STO)
    "0x53544f0000000000000000000000000000000000000000000000000000000000"
  );
  await nonfungibleTokenPositionDescriptor.deployed();
  deployedContracts.NonfungibleTokenPositionDescriptor = nonfungibleTokenPositionDescriptor.address;
  console.log(`NonfungibleTokenPositionDescriptor deployed to: ${nonfungibleTokenPositionDescriptor.address}`);
  
  // Deploy NonfungiblePositionManager
  console.log("Deploying NonfungiblePositionManager...");
  const NonfungiblePositionManager = await hre.ethers.getContractFactory("NonfungiblePositionManager");
  const nonfungiblePositionManager = await NonfungiblePositionManager.deploy(
    factory.address,
    WSTO_ADDRESS,
    nonfungibleTokenPositionDescriptor.address
  );
  await nonfungiblePositionManager.deployed();
  deployedContracts.NonfungiblePositionManager = nonfungiblePositionManager.address;
  console.log(`NonfungiblePositionManager deployed to: ${nonfungiblePositionManager.address}`);
  
  // Deploy SwapRouter
  console.log("Deploying SwapRouter...");
  const SwapRouter = await hre.ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy(
    factory.address,
    WSTO_ADDRESS
  );
  await swapRouter.deployed();
  deployedContracts.SwapRouter = swapRouter.address;
  console.log(`SwapRouter deployed to: ${swapRouter.address}`);
  
  // Get the final balance
  const finalBalance = await deployer.getBalance();
  console.log(`Final balance: ${hre.ethers.utils.formatEther(finalBalance)} ETH`);
  console.log(`Deployment cost: ${hre.ethers.utils.formatEther(initialBalance.sub(finalBalance))} ETH`);
  
  // Save the deployed contract addresses to a file
  const deploymentPath = path.join(__dirname, "../deployed-contracts.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deployedContracts, null, 2)
  );
  console.log(`Deployment addresses saved to ${deploymentPath}`);
  
  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
