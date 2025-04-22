const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // WSTO address (already deployed)
  const WSTO_ADDRESS = "0x5CCa138772f7ec71aDf95029291F87D26D0c0dB0";
  console.log("Using WSTO address:", WSTO_ADDRESS);

  // Deploy UniswapV3Factory
  const UniswapV3Factory = await ethers.getContractFactory("UniswapV3Factory");
  const factory = await UniswapV3Factory.deploy();
  await factory.deployed();
  console.log("UniswapV3Factory deployed to:", factory.address);

  // Deploy NFTDescriptor library
  const NFTDescriptor = await ethers.getContractFactory("NFTDescriptor");
  const nftDescriptor = await NFTDescriptor.deploy();
  await nftDescriptor.deployed();
  console.log("NFTDescriptor deployed to:", nftDescriptor.address);

  // Deploy NonfungibleTokenPositionDescriptor with the NFTDescriptor library
  const NonfungibleTokenPositionDescriptor = await ethers.getContractFactory("NonfungibleTokenPositionDescriptor", {
    libraries: {
      NFTDescriptor: nftDescriptor.address,
    },
  });
  
  // Convert "STO" to bytes32
  const nativeCurrencyLabelBytes = ethers.utils.formatBytes32String("STO");
  
  const tokenDescriptor = await NonfungibleTokenPositionDescriptor.deploy(
    WSTO_ADDRESS,
    nativeCurrencyLabelBytes
  );
  await tokenDescriptor.deployed();
  console.log("NonfungibleTokenPositionDescriptor deployed to:", tokenDescriptor.address);

  // Deploy NonfungiblePositionManager
  const NonfungiblePositionManager = await ethers.getContractFactory("NonfungiblePositionManager");
  const positionManager = await NonfungiblePositionManager.deploy(
    factory.address,
    WSTO_ADDRESS,
    tokenDescriptor.address
  );
  await positionManager.deployed();
  console.log("NonfungiblePositionManager deployed to:", positionManager.address);

  // Deploy SwapRouter
  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy(
    factory.address,
    WSTO_ADDRESS
  );
  await swapRouter.deployed();
  console.log("SwapRouter deployed to:", swapRouter.address);

  // Log all deployed contract addresses for verification
  console.log("\nDeployed Contracts Overview");
  console.log("| Contract Name | Address | Solidity Version | Optimization | Constructor Arguments |");
  console.log("|---------------|---------|------------------|--------------|----------------------|");
  console.log(`| UniswapV3Factory | ${factory.address} | 0.7.6 | Enabled (200 runs) | None |`);
  console.log(`| WSTO (Wrapped STO) | ${WSTO_ADDRESS} | 0.7.6 | Enabled (200 runs) | None |`);
  console.log(`| SwapRouter | ${swapRouter.address} | 0.7.6 | Enabled (200 runs) | Factory address, WSTO address |`);
  console.log(`| NFTDescriptor Library | ${nftDescriptor.address} | 0.7.6 | Enabled (200 runs) | None |`);
  console.log(`| NonfungibleTokenPositionDescriptor | ${tokenDescriptor.address} | 0.7.6 | Enabled (200 runs) | WSTO address, "STO" as bytes32 |`);
  console.log(`| NonfungiblePositionManager | ${positionManager.address} | 0.7.6 | Enabled (200 runs) | Factory address, WSTO address, Descriptor address |`);

  // Log constructor arguments for verification
  console.log("\nConstructor Arguments for Verification:");
  console.log("SwapRouter:", `${factory.address}${WSTO_ADDRESS.slice(2)}`);
  console.log("NonfungibleTokenPositionDescriptor:", `${WSTO_ADDRESS.slice(2)}${nativeCurrencyLabelBytes.slice(2)}`);
  console.log("NonfungiblePositionManager:", `${factory.address.slice(2)}${WSTO_ADDRESS.slice(2)}${tokenDescriptor.address.slice(2)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
