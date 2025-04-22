const { ethers } = require('ethers');

// ERC20 ABI (minimal for balanceOf)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

async function main() {
  // Address to check
  const address = '0x846C234adc6D8E74353c0c355b0c2B6a1e46634f';
  
  // USDT token address
  const tokenAddress = '0xfccc20bf4f0829e121bc99ff2222456ad4465a1e';
  
  // Connect to the blockchain
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  
  // Create contract instance
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  try {
    // Get token info
    const [balance, decimals, symbol, name] = await Promise.all([
      tokenContract.balanceOf(address),
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name()
    ]);
    
    // Format the balance
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    
    console.log(`Address: ${address}`);
    console.log(`Token: ${name} (${symbol})`);
    console.log(`Balance: ${formattedBalance} ${symbol}`);
    console.log(`Raw Balance: ${balance.toString()}`);
    console.log(`Decimals: ${decimals}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
