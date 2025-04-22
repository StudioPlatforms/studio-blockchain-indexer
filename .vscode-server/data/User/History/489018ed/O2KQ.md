# Studio Blockchain Explorer API Guide

This guide provides detailed information about the available API endpoints for the Studio Blockchain Explorer. These endpoints allow you to retrieve information about accounts, tokens, and transactions on the Studio Blockchain.

## Base URL

All API endpoints are relative to the base URL of the indexer:

```
http://localhost:3000
```

In production, this would be:

```
https://mainnetindexer.studio-blockchain.com
```

## Health Check

### GET /health

Returns the current status of the indexer.

**Response:**

```json
{
  "status": "ok",
  "lastBlock": 5180,
  "isIndexing": true
}
```

## Account Endpoints

### GET /account/{address}/balances

Returns the native STO balance and token balances for an account.

**Parameters:**
- `address`: The account address

**Response:**

```json
{
  "native": 9.977708773822956,
  "tokens": [
    {
      "contractAddress": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
      "symbol": "USDT",
      "name": "Tether USD",
      "balance": 1250.75,
      "decimals": 18,
      "type": "ERC20"
    }
  ]
}
```

**Notes:**
- The `native` field contains the native STO balance of the address
- The `tokens` array contains all tokens owned by the address
- Each token includes its contract address, symbol, name, balance, decimals, and type
- The balance is already converted from wei to the token's unit based on its decimals

### GET /address/{address}/tokens

Returns all tokens owned by an address.

**Parameters:**
- `address`: The account address

**Response:**

```json
[
  {
    "contractAddress": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
    "symbol": "USDT",
    "name": "Tether USD",
    "balance": 1250.75,
    "decimals": 18,
    "type": "ERC20"
  }
]
```

**Notes:**
- This endpoint returns the same token information as `/account/{address}/balances`, but without the native balance
- Each token includes its contract address, symbol, name, balance, decimals, and type
- The balance is already converted from wei to the token's unit based on its decimals

### GET /address/{address}/token-transfers

Returns all token transfers for an address (both incoming and outgoing).

**Parameters:**
- `address`: The account address
- `limit` (optional): Number of transfers to return (default: 10)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**

```json
[
  {
    "hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "blockNumber": 12345678,
    "timestamp": 1742892853,
    "from": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "to": "0x7890abcdef1234567890abcdef1234567890abcdef",
    "tokenAddress": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
    "tokenSymbol": "USDT",
    "tokenName": "Tether USD",
    "value": "100000000000000000000",
    "decimals": 18
  }
]
```

**Notes:**
- This endpoint returns all token transfers for the address (both incoming and outgoing)
- Each transfer includes the transaction hash, block number, timestamp, from address, to address, token address, token symbol, token name, value, and decimals
- The value is the raw value in wei as a string to preserve precision
- You should convert the value to the token's unit based on its decimals for display

## Token Endpoints

### GET /tokens/{tokenAddress}

Returns detailed information about a token.

**Parameters:**
- `tokenAddress`: The token contract address

**Response:**

```json
{
  "address": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
  "symbol": "USDT",
  "name": "Tether USD",
  "decimals": 6,
  "totalSupply": "2000000000000",
  "type": "ERC20",
  "holders": 12345,
  "transfers": 67890
}
```

**Notes:**
- This endpoint returns detailed information about a token
- It includes the token's address, symbol, name, decimals, total supply, type, and optionally the number of holders and transfers
- The total supply is the raw value in wei as a string to preserve precision
- You should convert the total supply to the token's unit based on its decimals for display

### GET /tokens/{tokenAddress}/holders

Returns the holders of a token.

**Parameters:**
- `tokenAddress`: The token contract address
- `limit` (optional): Number of holders to return (default: 100)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**

```json
[
  {
    "address": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "balance": "1250750000000000000000",
    "percentage": 0.00125
  }
]
```

**Notes:**
- This endpoint returns the holders of a token
- Each holder includes the address, balance, and optionally the percentage of the total supply
- The balance is the raw value in wei as a string to preserve precision
- You should convert the balance to the token's unit based on its decimals for display

### GET /tokens/{tokenAddress}/transfers

Returns the transfers of a token.

**Parameters:**
- `tokenAddress`: The token contract address
- `limit` (optional): Number of transfers to return (default: 10)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**

```json
[
  {
    "hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "blockNumber": 12345678,
    "timestamp": 1742892853,
    "from": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "to": "0x7890abcdef1234567890abcdef1234567890abcdef",
    "tokenAddress": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
    "value": "100000000000000000000"
  }
]
```

**Notes:**
- This endpoint returns the transfers of a token
- Each transfer includes the transaction hash, block number, timestamp, from address, to address, token address, and value
- The value is the raw value in wei as a string to preserve precision
- You should convert the value to the token's unit based on its decimals for display

## Error Handling

All endpoints return a JSON response with a 200 status code on success. In case of an error, the response will have an appropriate status code (4xx or 5xx) and a JSON body with an error message:

```json
{
  "error": "Error message"
}
```

## Pagination

Endpoints that return lists of items support pagination through the `limit` and `offset` query parameters:

- `limit`: Number of items to return (default varies by endpoint)
- `offset`: Offset for pagination (default: 0)

Example:

```
GET /tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=20&offset=40
```

This would return transfers 41-60 for the specified token.

## Implementation Notes

When displaying token balances or values, always convert the raw wei value to the token's unit based on its decimals. For example, if a token has 18 decimals, divide the wei value by 10^18 to get the token unit value.

Example:

```javascript
// Convert wei to token units
function weiToTokenUnits(weiValue, decimals) {
  return parseFloat(weiValue) / Math.pow(10, decimals);
}

// Example usage
const tokenBalance = weiToTokenUnits("1250750000000000000000", 18);
console.log(tokenBalance); // 1250.75
```

## Maintenance

If you need to reset the indexer, you can use the `reset-indexer.sh` script:

```bash
cd /root/mainnet-indexer
./reset-indexer.sh
```

This script will:
1. Stop all containers
2. Remove all data volumes
3. Start containers with a fresh database
4. Run all migrations
5. Restart the indexer
