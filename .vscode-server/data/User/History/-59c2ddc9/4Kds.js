const axios = require('axios');

async function verifyContract() {
  try {
    // Check if the contract is verified
    const verificationResponse = await axios.get('http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified');
    console.log('Contract verification status:', verificationResponse.data);

    // Get contract details
    const contractResponse = await axios.get('http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E');
    console.log('Contract details:', contractResponse.data);

    // Verify the contract
    const verifyResponse = await axios.post('http://localhost:3000/contracts/verify', {
      address: '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E',
      sourceCode: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TetherUSD is ERC20, Ownable {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 2000000000000 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
      `,
      compilerVersion: '0.8.0',
      optimizationUsed: true,
      runs: 200,
      contractName: 'TetherUSD',
      evmVersion: 'cancun'
    });

    console.log('Verification response:', verifyResponse.data);

    // Check if the contract is verified after verification
    const verificationAfterResponse = await axios.get('http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/verified');
    console.log('Contract verification status after verification:', verificationAfterResponse.data);

    // Get contract ABI
    const abiResponse = await axios.get('http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/abi');
    console.log('Contract ABI:', abiResponse.data);

    // Get contract source code
    const sourceResponse = await axios.get('http://localhost:3000/contracts/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/source');
    console.log('Contract source code:', sourceResponse.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

verifyContract();
