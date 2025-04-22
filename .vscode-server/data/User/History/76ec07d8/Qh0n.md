# Studio Blockchain Indexer

This service indexes the Studio Blockchain and provides API endpoints for the explorer frontend.

## Features

- Indexes blocks and transactions from the Studio Blockchain
- Provides REST API endpoints for querying blockchain data
- Maintains transaction counts and basic statistics
- Supports searching by block number, transaction hash, and address

## API Endpoints

- `GET /v1/health` - Health check
- `GET /v1/blocks/latest` - Get latest block
- `GET /v1/blocks/:blockId` - Get block by number or hash
- `GET /v1/transactions/:hash` - Get transaction by hash
- `GET /v1/transactions?address=0x...` - Get transactions by address
- `GET /v1/transactions/count` - Get total transactions count

## Deployment Options

### Option 1: Docker Deployment (Recommended)

1. Install Docker and Docker Compose on your server
2. Clone this repository
3. Configure environment variables in `docker-compose.yml` if needed
4. Run the following commands:

```bash
# Build and start the services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Manual Deployment

#### Prerequisites

- Node.js 20.x
- PostgreSQL 15.x
- Git

#### Installation Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd indexer
```

2. Install dependencies:
```bash
npm install
```

3. Create database:
```bash
createdb studio_indexer
```

4. Create .env file:
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=studio_indexer
DB_USER=postgres
DB_PASSWORD=postgres

# Blockchain
RPC_URL=https://mainnet.studio-blockchain.com
CHAIN_ID=240241

# Server
PORT=3000
HOST=0.0.0.0

# Indexer
START_BLOCK=0
BATCH_SIZE=10
CONFIRMATIONS=12
```

5. Run database migrations:
```bash
npm run migrate up
```

6. Build and start the service:
```bash
npm run build
npm start
```

## Production Deployment Notes

1. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start dist/index.js --name studio-indexer
```

2. Set up Nginx as a reverse proxy:
```nginx
server {
    listen 80;
    server_name mainnetindexer.studio-blockchain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Set up SSL with Let's Encrypt:
```bash
sudo certbot --nginx -d mainnetindexer.studio-blockchain.com
```

## Monitoring

- Check service status: `GET /health`
- View logs: `tail -f logs/combined.log`
- Monitor errors: `tail -f logs/error.log`

## Development

1. Start PostgreSQL:
```bash
docker-compose up postgres -d
```

2. Run in development mode:
```bash
npm run dev
```

## Troubleshooting

1. Check logs:
```bash
tail -f logs/error.log
```

2. Verify RPC connection:
```bash
curl -X POST https://mainnet.studio-blockchain.com \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

3. Reset database:
```bash
npm run migrate down
npm run migrate up
