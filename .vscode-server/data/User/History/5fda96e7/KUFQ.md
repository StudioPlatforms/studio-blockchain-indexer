# Studio Blockchain Contract Verification Guide

Based on my analysis of the mainnet-indexer codebase, I can provide you with the exact API endpoint and requirements for contract verification on the Studio blockchain.

## API Endpoint for Contract Verification

The correct API endpoint for contract verification is:

```
https://mainnetindexer.studio-blockchain.com/contracts/verify
```

This endpoint accepts a POST request with the following parameters:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }",
  "compilerVersion": "0.8.0",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "0x...",
  "contractName": "MyContract",
  "libraries": {
    "MyLibrary": "0x1234567890123456789012345678901234567890"
  },
  "evmVersion": "cancun"
}
```

## Hardhat Configuration

To verify contracts using Hardhat, you need to update your `hardhat.config.js` file with the following configuration:

```javascript
module.exports = {
  // ... other config
  networks: {
    studio: {
      url: "https://mainnet.studio-blockchain.com",
      chainId: 240241
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
          apiURL: "https://mainnetindexer.studio-blockchain.com",
          browserURL: "https://studio-scan.com"
        }
      }
    ]
  }
};
```

## Important Note

The Hardhat verification plugin expects the API endpoint to follow the Etherscan API format, but the Studio blockchain's API endpoint might not be fully compatible with this format. This could be why you're experiencing issues with contract verification through Hardhat.

## Alternative Approach

If you're having trouble verifying contracts through Hardhat, you can try verifying them directly through the Studio blockchain explorer's web interface at https://studio-scan.com.

Alternatively, you can make a direct API request to the verification endpoint:

```bash
curl -X POST -H "Content-Type: application/json" https://mainnetindexer.studio-blockchain.com/contracts/verify -d '{
  "address": "0xe0ae105f3a9Dcd740949A73597Fc397F8F208871",
  "sourceCode": "// Your contract source code here",
  "compilerVersion": "0.8.0",
  "optimizationUsed": true,
  "runs": 200,
  "contractName": "StudioPresale",
  "evmVersion": "cancun"
}'
```

## Conclusion

Based on my analysis, the issue you're experiencing with Hardhat verification is likely due to a mismatch between the API format expected by the Hardhat verification plugin and the actual API format of the Studio blockchain's verification endpoint.

I recommend reaching out to the Studio blockchain team for specific guidance on how to verify contracts on their platform, as they may have a custom process or tool for contract verification.
