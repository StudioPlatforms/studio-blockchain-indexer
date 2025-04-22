# Studio Blockchain Indexer

This service indexes the Studio Blockchain and provides API endpoints for the explorer frontend.

## Features

- Indexes blocks and transactions from the Studio Blockchain
- Provides REST API endpoints for querying blockchain data
- Maintains transaction counts and basic statistics
- Supports searching by block number, transaction hash, and address
- Indexes and provides data for ERC-20, ERC-721, and ERC-1155 tokens
- Supports NFT metadata retrieval and ownership tracking

## Deployment

### Docker Deployment (Recommended)

1. Install Docker and Docker Compose
2. Configure environment variables in `docker-compose.yml` if needed
3. Run `docker-compose up -d`

### Manual Deployment

1. Install Node.js 20.x and PostgreSQL 15.x
2. Install dependencies: `npm install`
3. Create database and configure environment variables
4. Run migrations: `npm run migrate up`
5. Build and start: `npm run build && npm start`

## Development

Run in development mode: `npm run dev`
