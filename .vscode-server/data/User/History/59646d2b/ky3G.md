# API Endpoints Documentation

This document provides an overview of the available API endpoints in the Studio Blockchain Indexer.

## Transaction Endpoints

### Get Transaction Details

- **Endpoint**: `/transactions/{hash}`
- **Method**: GET
- **Description**: Get details of a transaction by its hash.
- **Response**:
  ```json
  {
    "hash": "0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46",
    "blockNumber": "181268",
    "from": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "to": "0xfccc20bf4f0829e121bc99ff2222456ad4465a1e",
    "value": {
      "type": "BigNumber",
      "hex": "0x00"
    },
    "gasLimit": {
      "type": "BigNumber",
      "hex": "0xbf49"
    },
    "gasPrice": {
      "type": "BigNumber",
      "hex": "0x3b9aca07"
    },
    "data": "0x095ea7b3000000000000000000000000cbb0cdf4d9a4a14d031a66de6adb4bfc2141ffb7000000000000000000000000000000000000000000000000000000000bebc200",
    "nonce": "80",
    "transactionIndex": 5652,
    "status": null,
    "timestamp": 1743074058
  }
  ```

### Get Decoded Transaction Data

- **Endpoint**: `/transactions/{hash}/decoded`
- **Method**: GET
- **Description**: Get decoded transaction data for a contract interaction. This endpoint decodes the function call and parameters from the transaction data.
- **Response**:
  ```json
  {
    "transaction": {
      "hash": "0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46",
      "blockNumber": "181268",
      "from": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
      "to": "0xfccc20bf4f0829e121bc99ff2222456ad4465a1e",
      "value": {
        "type": "BigNumber",
        "hex": "0x00"
      },
      "gasLimit": {
        "type": "BigNumber",
        "hex": "0xbf49"
      },
      "gasPrice": {
        "type": "BigNumber",
        "hex": "0x3b9aca07"
      },
      "data": "0x095ea7b3000000000000000000000000cbb0cdf4d9a4a14d031a66de6adb4bfc2141ffb7000000000000000000000000000000000000000000000000000000000bebc200",
      "nonce": "80",
      "transactionIndex": 5652,
      "status": null,
      "timestamp": 1743074058
    },
    "decoded": {
      "functionName": "approve",
      "functionSignature": "approve(address,uint256)",
      "params": [
        {
          "name": "spender",
          "type": "address",
          "value": "0xcbb0cdf4d9a4a14d031a66de6adb4bfc2141ffb7"
        },
        {
          "name": "value",
          "type": "uint256",
          "value": "200000000"
        }
      ]
    },
    "description": "Approve 0xcbb0cdf4d9a4a14d031a66de6adb4bfc2141ffb7 to spend 200000000 Tether USD tokens"
  }
  ```
- **Error Response** (if contract is not verified):
  ```json
  {
    "transaction": {
      "hash": "0xe7db91fa896213debff5889824285e5f0f294a8d3d6c7ecde960a60d654d7c46",
      "blockNumber": "181268",
      "from": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
      "to": "0xfccc20bf4f0829e121bc99ff2222456ad4465a1e",
      "value": {
        "type": "BigNumber",
        "hex": "0x00"
      },
      "gasLimit": {
        "type": "BigNumber",
        "hex": "0xbf49"
      },
      "gasPrice": {
        "type": "BigNumber",
        "hex": "0x3b9aca07"
      },
      "data": "0x095ea7b3000000000000000000000000cbb0cdf4d9a4a14d031a66de6adb4bfc2141ffb7000000000000000000000000000000000000000000000000000000000bebc200",
      "nonce": "80",
      "transactionIndex": 5652,
      "status": null,
      "timestamp": 1743074058
    },
    "decoded": null,
    "description": "Contract is not verified"
  }
  ```

## Statistics Endpoints

### TPS (Transactions Per Second)

- **Endpoint**: `/stats/tps`
- **Method**: GET
- **Description**: Get the current transactions per second (TPS) of the network.
- **Response**:
  ```json
  {
    "tps": 5.2,
    "timeSpan": 60,
    "totalTransactions": 312,
    "fromBlock": 1000,
    "toBlock": 1050,
    "fromTimestamp": 1616161616,
    "toTimestamp": 1616161676
  }
  ```

### Total STO Holders

- **Endpoint**: `/stats/holders`
- **Method**: GET
- **Description**: Get the total number of addresses that hold STO tokens.
- **Response**:
  ```json
  {
    "holders": 1234
  }
  ```

### Validators Payout

- **Endpoint**: `/stats/validators/payout`
- **Method**: GET
- **Description**: Get the total amount of STO paid to all validators since the beginning.
- **Response**:
  ```json
  {
    "totalPayout": "1000000000000000000000",
    "formattedPayout": "1000"
  }
  ```

### Total Contracts Count

- **Endpoint**: `/stats/contracts/count`
- **Method**: GET
- **Description**: Get the total number of deployed smart contracts.
- **Response**:
  ```json
  {
    "count": 5678
  }
  ```

### ERC20 Contracts Count

- **Endpoint**: `/stats/contracts/erc20/count`
- **Method**: GET
- **Description**: Get the total number of ERC20 contracts.
- **Response**:
  ```json
  {
    "count": 1234
  }
  ```

### NFT Contracts Count

- **Endpoint**: `/stats/contracts/nft/count`
- **Method**: GET
- **Description**: Get the total number of NFT contracts (ERC721 and ERC1155).
- **Response**:
  ```json
  {
    "count": 2345,
    "erc721Count": 1234,
    "erc1155Count": 1111
  }
  ```

## Contract Verification Endpoints

### Verify Contract

- **Endpoint**: `/contracts/verify`
- **Method**: POST
- **Description**: Submit contract source code for verification.
- **Request Body**:
  ```json
  {
    "address": "0x1234567890123456789012345678901234567890"
    "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }"
    "compilerVersion": "0.8.0"
    "optimizationUsed": true
    "runs": 200
    "constructorArguments": "0x..."
    "contractName": "MyContract"
    "libraries": {
      "MyLibrary": "0x1234567890123456789012345678901234567890"
    }
    "evmVersion": "cancun"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Contract verified successfully",
    "address": "0x1234567890123456789012345678901234567890"
  }
  ```

### Check if Contract is Verified

- **Endpoint**: `/contracts/{address}/verified`
- **Method**: GET
- **Description**: Check if a contract is fully verified (has both ABI and source code).
- **Response**:
  ```json
  {
    "verified": true
  }
  ```
- **Error Response** (if address is not a contract):
  ```json
  {
    "verified": false,
    "error": "Not a contract address"
  }
  ```

### Get Contract ABI

- **Endpoint**: `/contracts/{address}/abi`
- **Method**: GET
- **Description**: Retrieve the ABI of a verified contract.
- **Response**:
  ```json
  {
    "address": "0x1234567890123456789012345678901234567890",
    "abi": [
      {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      ...
    ]
  }
  ```
- **Error Response** (if contract is not verified):
  ```json
  {
    "success": false,
    "error": "Contract is not verified"
  }
  ```

### Get Contract Source Code

- **Endpoint**: `/contracts/{address}/source`
- **Method**: GET
- **Description**: Retrieve the source code of a verified contract.
- **Response**:
  ```json
  {
    "address": "0x1234567890123456789012345678901234567890",
    "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }"
  }
  ```
- **Error Response** (if contract is not verified):
  ```json
  {
    "success": false,
    "error": "Contract is not verified"
  }
  ```

### Get Contract Verification Details

- **Endpoint**: `/contracts/{address}/verification`
- **Method**: GET
- **Description**: Retrieve detailed verification information for a verified contract.
- **Response**:
  ```json
  {
    "address": "0x1234567890123456789012345678901234567890",
    "contractName": "MyContract",
    "compilerVersion": "0.8.0",
    "license": "MIT",
    "optimizationUsed": true,
    "runs": 200,
    "evmVersion": "cancun",
    "constructorArguments": "0x...",
    "libraries": {
      "MyLibrary": "0x1234567890123456789012345678901234567890"
    },
    "verifiedAt": "2025-03-28T10:00:00Z",
    "metadataHash": "0xa165627a7a72305820...",
    "ownerAddress": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "creatorAddress": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "creationInfo": {
      "creator": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
      "blockNumber": "22166",
      "timestamp": 1742059631,
      "transactionHash": "0x3531c58c08bc1b4f0d94bf6ae2942f459f8918e1ccfd298b5d5f59b387ec913f"
    }
  }
  ```
- **Error Response** (if contract is not verified):
  ```json
  {
    "success": false,
    "error": "Contract is not verified"
  }
  ```

### Interact with Contract

- **Endpoint**: `/contracts/{address}/interact`
- **Method**: POST
- **Description**: Interact with a verified contract's functions.
- **Request Body**:
  ```json
  {
    "method": "balanceOf",
    "params": ["0x1234567890123456789012345678901234567890"],
    "value": "0"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "address": "0x1234567890123456789012345678901234567890",
    "method": "balanceOf",
    "params": ["0x1234567890123456789012345678901234567890"],
    "result": "1000000000000000000"
  }
  ```
- **Error Response** (if contract is not verified):
  ```json
  {
    "success": false,
    "error": "Contract is not verified"
  }
  ```
