# NFT Endpoints Documentation

This document describes the NFT-related endpoints available in the Studio Blockchain Indexer.

## NFT Ownership Endpoint

Retrieves all NFTs owned by a specific address.

```
GET /address/:address/nfts
```

### Parameters

- `address` (path parameter): The Ethereum address to get NFTs for
- `tokenAddress` (query parameter, optional): Filter by specific token contract address
- `limit` (query parameter, optional): Number of results to return (default: 10)
- `offset` (query parameter, optional): Pagination offset (default: 0)

### Response

```json
[
  {
    "id": 1,
    "tokenAddress": "0x1234...",
    "tokenId": "42",
    "ownerAddress": "0xabcd...",
    "metadataUri": "ipfs://...",
    "name": "Cool NFT",
    "description": "A very cool NFT",
    "imageUrl": "https://...",
    "metadata": {
      "name": "Cool NFT",
      "description": "A very cool NFT",
      "image": "https://...",
      "attributes": [...]
    },
    "lastUpdated": 1679123456
  },
  ...
]
```

## NFT Metadata Endpoint

Retrieves detailed metadata for a specific NFT.

```
GET /nfts/:tokenAddress/:tokenId
```

### Parameters

- `tokenAddress` (path parameter): The NFT contract address
- `tokenId` (path parameter): The token ID

### Response

```json
{
  "id": 1,
  "tokenAddress": "0x1234...",
  "tokenId": "42",
  "ownerAddress": "0xabcd...",
  "metadataUri": "ipfs://...",
  "name": "Cool NFT",
  "description": "A very cool NFT",
  "imageUrl": "https://...",
  "metadata": {
    "name": "Cool NFT",
    "description": "A very cool NFT",
    "image": "https://...",
    "attributes": [
      {
        "trait_type": "Background",
        "value": "Blue"
      },
      {
        "trait_type": "Eyes",
        "value": "Green"
      },
      ...
    ]
  },
  "lastUpdated": 1679123456
}
```

## NFT Transaction History Endpoint

Retrieves all NFT transfers for a specific address.

```
GET /address/:address/nft-transfers
```

### Parameters

- `address` (path parameter): The Ethereum address to get NFT transfers for
- `tokenAddress` (query parameter, optional): Filter by specific token contract address
- `tokenType` (query parameter, optional): Filter by token type ('ERC721' or 'ERC1155')
- `limit` (query parameter, optional): Number of results to return (default: 10)
- `offset` (query parameter, optional): Pagination offset (default: 0)

### Response

```json
[
  {
    "id": 1,
    "transactionHash": "0x1234...",
    "blockNumber": 12345,
    "tokenAddress": "0x1234...",
    "fromAddress": "0xabcd...",
    "toAddress": "0xefgh...",
    "value": "1",
    "tokenType": "ERC721",
    "tokenId": "42",
    "timestamp": 1679123456
  },
  ...
]
```

## NFT Collection Endpoint

Retrieves information about an NFT collection.

```
GET /nfts/:tokenAddress
```

### Parameters

- `tokenAddress` (path parameter): The NFT contract address

### Response

```json
{
  "id": 1,
  "tokenAddress": "0x1234...",
  "name": "Cool NFT Collection",
  "symbol": "COOL",
  "totalSupply": 10000,
  "ownerCount": 5000,
  "floorPrice": "0.1",
  "volumeTraded": "1000",
  "lastUpdated": 1679123456
}
```

## NFT Collections Endpoint

Retrieves a list of NFT collections.

```
GET /nfts
```

### Parameters

- `limit` (query parameter, optional): Number of results to return (default: 10)
- `offset` (query parameter, optional): Pagination offset (default: 0)

### Response

```json
[
  {
    "id": 1,
    "tokenAddress": "0x1234...",
    "name": "Cool NFT Collection",
    "symbol": "COOL",
    "totalSupply": 10000,
    "ownerCount": 5000,
    "floorPrice": "0.1",
    "volumeTraded": "1000",
    "lastUpdated": 1679123456
  },
  ...
]
