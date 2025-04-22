# Studio Blockchain Verification URLs

Based on the analysis of the mainnet-indexer codebase and your feedback, here are the correct URLs you should use in your hardhat.config.js file for contract verification on the Studio blockchain:

## Required URLs for hardhat.config.js

```javascript
module.exports = {
  // ... other config
  networks: {
    studio: {
      url: "https://mainnet.studio-blockchain.com", // RPC endpoint
      chainId: 240241 // Chain ID from config
    }
  },
  etherscan: {
    apiKey: {
      studio: "dummy" // API key is not required but field is needed
    },
    customChains: [
      {
        network: "studio",
        chainId: 240241,
        urls: {
          // API URL for verification service
          apiURL: "https://mainnetindexer.studio-blockchain.com/contracts/verify",
          
          // Browser URL for the explorer (confirmed)
          browserURL: "https://studio-scan.com"
        }
      }
    ]
  }
};
```

## Notes on the URLs

1. **RPC URL**: `https://mainnet.studio-blockchain.com`
   - This is the primary RPC endpoint for the Studio blockchain
   - Alternative RPC endpoints include:
     - https://mainnet2.studio-blockchain.com
     - https://mainnet3.studio-blockchain.com
     - https://mainnet.studio-scan.com
     - https://mainnet2.studio-scan.com

2. **API URL**: `https://mainnetindexer.studio-blockchain.com/contracts/verify`
   - This is the API endpoint for the verification service
   - This is the direct endpoint for contract verification

3. **Browser URL**: `https://studio-scan.com`
   - This is the confirmed URL for the blockchain explorer frontend
   - After verification, your contract will be viewable at this URL

## Verification Process

When you run `npx hardhat verify`, Hardhat will:

1. Compile your contract with the specified settings
2. Send the compiled bytecode, source code, and other parameters to the API URL
3. The verification service will compare the compiled bytecode with the on-chain bytecode
4. If they match, your contract will be marked as verified

After successful verification, you can view your verified contract at:
`https://studio-scan.com/address/0xYourContractAddress`
