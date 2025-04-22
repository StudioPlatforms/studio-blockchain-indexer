# Studio Blockchain Explorer - Frontend Integration Guide

This document provides comprehensive instructions for frontend developers to integrate with the Studio Blockchain Indexer API to build a blockchain explorer interface.

## Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [API Endpoints](#api-endpoints)
4. [Authentication](#authentication)
5. [Rate Limiting](#rate-limiting)
6. [Example Implementations](#example-implementations)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

The Studio Blockchain Indexer is a backend service that indexes blockchain data from the Studio Blockchain mainnet. It provides a RESTful API that allows frontend applications to access blockchain data such as blocks, transactions, accounts, tokens, and NFTs.

Key features:
- Real-time blockchain data indexing
- Address type detection (wallet, contract, token)
- Token transfers tracking (ERC20, ERC721, ERC1155)
- NFT metadata indexing
- Search functionality

## Setup Instructions

### Environment Configuration

The API server runs on port 3000 by default. You can configure your frontend application to connect to the API server using the following base URL:

```
http://[indexer-host]:3000
```

For production environments, it's recommended to set up a reverse proxy with HTTPS and proper caching.

### CORS Configuration

The API server has CORS enabled by default, allowing requests from any origin. If you need to restrict access to specific origins, you can modify the CORS configuration in the API service.

### Health Check

Before integrating with the API, you should check if the indexer is running and up-to-date:

```javascript
// Example using fetch API
fetch('http://localhost:3000/health')
  .then(response => response.json())
  .then(data => {
    console.log('Indexer status:', data.status);
    console.log('Latest indexed block:', data.lastBlock);
    console.log('Is indexing:', data.isIndexing);
  });
```

## API Endpoints

### Core Endpoints

#### Health Check
- **GET /health**
  - Returns the health status of the indexer
  - Response: `{ "status": "ok", "lastBlock": "435", "isIndexing": true }`

#### Blocks
- **GET /blocks**
  - Returns the latest blocks
  - Query parameters:
    - `limit` (optional): Number of blocks to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
  - Response: Array of block objects

- **GET /blocks/:number**
  - Returns a specific block by number
  - Response: Block object with transactions

- **GET /blocks/hash/:hash**
  - Returns a specific block by hash
  - Response: Block object with transactions

#### Transactions
- **GET /transactions/:hash**
  - Returns a specific transaction by hash
  - Response: Transaction object

- **GET /transactions/:hash/receipt**
  - Returns the receipt for a specific transaction
  - Response: Transaction receipt object

- **GET /transactions/pending**
  - Returns pending transactions
  - Response: Array of pending transaction objects

#### Search
- **GET /search?q=:query**
  - Searches for blocks, transactions, or addresses
  - Query parameters:
    - `q` (required): Search query (block number, transaction hash, or address)
  - Response: Search result object with type and data

### Address-related Endpoints

#### Address Type
- **GET /address/:address/type**
  - Returns the type of an address (wallet, contract, token)
  - Response: 
    - For wallets: `{ "address": "0x...", "type": "wallet" }`
    - For contracts: `{ "address": "0x...", "type": "contract", "contractType": "unknown" }`
    - For tokens: `{ "address": "0x...", "type": "contract", "contractType": "ERC20"|"ERC721"|"ERC1155" }`

#### Address Transactions
- **GET /address/:address/transactions**
  - Returns transactions for a specific address
  - Query parameters:
    - `limit` (optional): Number of transactions to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
  - Response: Array of transaction objects

#### Account Balances
- **GET /account/:address/balances**
  - Returns token balances for a specific address
  - Response: Object with token balances

### Token-related Endpoints

#### Token Transfers
- **GET /tokens/:address/transfers**
  - Returns transfers for a specific token
  - Query parameters:
    - `limit` (optional): Number of transfers to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
  - Response: Array of token transfer objects

#### Address Tokens
- **GET /address/:address/tokens**
  - Returns token transfers for a specific address
  - Query parameters:
    - `limit` (optional): Number of transfers to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
    - `type` (optional): Token type filter (ERC20, ERC721, ERC1155)
  - Response: Array of token transfer objects

### NFT-related Endpoints

#### NFTs by Owner
- **GET /address/:address/nfts**
  - Returns NFTs owned by a specific address
  - Query parameters:
    - `limit` (optional): Number of NFTs to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
    - `tokenAddress` (optional): Filter by token address
  - Response: Array of NFT objects

#### NFT Collections
- **GET /nfts**
  - Returns NFT collections
  - Query parameters:
    - `limit` (optional): Number of collections to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
  - Response: Array of NFT collection objects

#### NFT Collection
- **GET /nfts/:tokenAddress**
  - Returns a specific NFT collection
  - Response: NFT collection object

#### NFT Token
- **GET /nfts/:tokenAddress/:tokenId**
  - Returns a specific NFT token
  - Response: NFT token object with metadata

#### NFT Transfers
- **GET /address/:address/nft-transfers**
  - Returns NFT transfers for a specific address
  - Query parameters:
    - `limit` (optional): Number of transfers to return (default: 10)
    - `offset` (optional): Offset for pagination (default: 0)
    - `tokenAddress` (optional): Filter by token address
    - `tokenType` (optional): Filter by token type (ERC721, ERC1155)
  - Response: Array of NFT transfer objects

### RPC Endpoint

#### RPC Proxy
- **POST /proxy/rpc**
  - Proxies JSON-RPC requests to the blockchain
  - Request body: JSON-RPC request object
  - Response: JSON-RPC response object

## Authentication

The API currently does not require authentication. If you need to restrict access to the API, you should implement authentication at the reverse proxy level.

## Rate Limiting

The API currently does not have rate limiting. If you need to implement rate limiting, you should do so at the reverse proxy level.

## Example Implementations

### Displaying Latest Blocks

```javascript
// Example using React and fetch API
import React, { useState, useEffect } from 'react';

function LatestBlocks() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const response = await fetch('http://localhost:3000/blocks');
        const data = await response.json();
        setBlocks(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching blocks:', error);
        setLoading(false);
      }
    };

    fetchBlocks();
    // Set up polling to refresh blocks every 10 seconds
    const interval = setInterval(fetchBlocks, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>Latest Blocks</h2>
      <table>
        <thead>
          <tr>
            <th>Block Number</th>
            <th>Timestamp</th>
            <th>Transactions</th>
            <th>Gas Used</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map(block => (
            <tr key={block.number}>
              <td>{block.number}</td>
              <td>{new Date(block.timestamp * 1000).toLocaleString()}</td>
              <td>{block.transactions_count}</td>
              <td>{block.gas_used}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LatestBlocks;
```

### Searching for Blocks, Transactions, or Addresses

```javascript
// Example using React and fetch API
import React, { useState } from 'react';

function Search() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`http://localhost:3000/search?q=${query}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;

    switch (result.type) {
      case 'block':
        return (
          <div>
            <h3>Block {result.data.number}</h3>
            <p>Hash: {result.data.hash}</p>
            <p>Timestamp: {new Date(result.data.timestamp * 1000).toLocaleString()}</p>
            <p>Transactions: {result.data.transactions_count}</p>
          </div>
        );
      case 'transaction':
        return (
          <div>
            <h3>Transaction</h3>
            <p>Hash: {result.data.hash}</p>
            <p>Block: {result.data.block_number}</p>
            <p>From: {result.data.from_address}</p>
            <p>To: {result.data.to_address}</p>
            <p>Value: {result.data.value}</p>
          </div>
        );
      case 'address':
        return (
          <div>
            <h3>Address</h3>
            <p>Address: {result.data.address}</p>
            <p>Type: {result.addressType}</p>
            {result.contractType && <p>Contract Type: {result.contractType}</p>}
            <p>Transactions: {result.data.transactions.length}</p>
          </div>
        );
      default:
        return <p>Unknown result type</p>;
    }
  };

  return (
    <div>
      <h2>Search</h2>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Block number, transaction hash, or address"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && renderResult()}
    </div>
  );
}

export default Search;
```

### Displaying NFTs Owned by an Address

```javascript
// Example using React and fetch API
import React, { useState, useEffect } from 'react';

function AddressNFTs({ address }) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNFTs = async () => {
      try {
        const response = await fetch(`http://localhost:3000/address/${address}/nfts`);
        if (!response.ok) {
          throw new Error('Failed to fetch NFTs');
        }
        const data = await response.json();
        setNfts(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchNFTs();
    }
  }, [address]);

  if (loading) {
    return <div>Loading NFTs...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (nfts.length === 0) {
    return <div>No NFTs found for this address</div>;
  }

  return (
    <div>
      <h2>NFTs Owned by {address}</h2>
      <div className="nft-grid">
        {nfts.map(nft => (
          <div key={`${nft.tokenAddress}-${nft.tokenId}`} className="nft-card">
            {nft.metadata && nft.metadata.image && (
              <img src={nft.metadata.image} alt={nft.metadata.name || 'NFT'} />
            )}
            <h3>{nft.metadata?.name || `NFT #${nft.tokenId}`}</h3>
            <p>Collection: {nft.tokenAddress}</p>
            <p>Token ID: {nft.tokenId}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AddressNFTs;
```

## Best Practices

### Caching

To improve performance and reduce load on the API server, implement client-side caching for frequently accessed data:

```javascript
// Example using a simple cache
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function fetchWithCache(url) {
  const now = Date.now();
  const cacheKey = url;
  
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < CACHE_TTL) {
      return data;
    }
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  cache.set(cacheKey, { data, timestamp: now });
  return data;
}
```

### Pagination

When displaying large datasets, implement pagination to improve performance:

```javascript
// Example pagination component
function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="pagination">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
    </div>
  );
}
```

### Error Handling

Implement robust error handling to provide a good user experience:

```javascript
// Example error boundary component
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error.toString()}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Responsive Design

Ensure your blockchain explorer is usable on all device sizes:

```css
/* Example responsive CSS */
.blocks-table {
  width: 100%;
  border-collapse: collapse;
}

@media (max-width: 768px) {
  .blocks-table th:nth-child(3),
  .blocks-table td:nth-child(3) {
    display: none; /* Hide less important columns on mobile */
  }
}

@media (max-width: 480px) {
  .blocks-table th:nth-child(4),
  .blocks-table td:nth-child(4) {
    display: none; /* Hide even more columns on small screens */
  }
}
```

## Troubleshooting

### API Connection Issues

If you're having trouble connecting to the API:

1. Check if the indexer is running: `curl http://localhost:3000/health`
2. Verify network connectivity: `ping [indexer-host]`
3. Check for CORS issues in the browser console
4. Ensure the API server is accessible from your frontend application

### Data Synchronization Issues

If the blockchain data seems outdated:

1. Check the latest indexed block: `curl http://localhost:3000/health`
2. Compare with the current blockchain height: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:3000/proxy/rpc`
3. If the indexer is significantly behind, it may still be catching up with the blockchain

### Performance Issues

If the frontend is slow:

1. Implement caching as described in the Best Practices section
2. Use pagination for large datasets
3. Optimize your React components (use memoization, virtualized lists, etc.)
4. Consider implementing server-side rendering for initial page load

---

For additional support or feature requests, please contact the indexer development team.
