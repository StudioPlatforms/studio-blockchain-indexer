# API Endpoints Documentation

This document provides an overview of the available API endpoints in the Studio Blockchain Indexer.

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
    "address": "0x1234567890123456789012345678901234567890",
    "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }",
    "compilerVersion": "0.8.0",
    "optimizationUsed": true,
    "runs": 200,
    "constructorArguments": "0x...",
    "contractName": "MyContract",
    "libraries": {
      "MyLibrary": "0x1234567890123456789012345678901234567890"
    }
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
    "address": "0x1234567890123456789012345678901234567890",
    "method": "balanceOf",
    "params": ["0x1234567890123456789012345678901234567890"],
    "result": "1000000000000000000"
  }
