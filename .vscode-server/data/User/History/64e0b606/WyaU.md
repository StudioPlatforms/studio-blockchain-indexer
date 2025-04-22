# Mainnet Deployment Guide

This guide provides step-by-step instructions for deploying the Studio Blockchain Indexer on mainnet.

## Prerequisites

- Server with at least 4GB RAM and 50GB storage
- Docker and Docker Compose installed
- Git installed
- Domain name (optional, for SSL setup)

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/studio-blockchain/indexer.git
cd indexer
```

### 2. Configure for Mainnet

Edit the `docker-compose.yml` file to ensure it's configured for mainnet:

```yaml
environment:
  - DB_HOST=postgres
  - DB_PORT=5432
  - DB_NAME=studio_indexer
  - DB_USER=postgres
  - DB_PASSWORD=postgres
  - RPC_URL=https://mainnet.studio-blockchain.com,https://mainnet2.studio-blockchain.com,https://mainnet3.studio-blockchain.com,https://mainnet.studio-scan.com,https://mainnet2.studio-scan.com
  - CHAIN_ID=240241
  - PORT=3000
  - HOST=0.0.0.0
  - START_BLOCK=0
  - BATCH_SIZE=10
  - CONFIRMATIONS=5
```

### 3. Build and Start the Services

```bash
docker-compose build
docker-compose up -d
```

### 4. Monitor the Indexer

Check the logs to ensure the indexer is running correctly:

```bash
docker-compose logs -f
```

You should see output indicating that the indexer is connecting to the RPC nodes and processing blocks.

### 5. Verify the API

Test the API endpoints to ensure they're working correctly:

```bash
# Check health endpoint
curl http://localhost:3000/health

# Get latest block
curl http://localhost:3000/blocks | jq
```

### 6. Set Up Nginx (Optional)

If you want to expose the API to the internet, set up Nginx as a reverse proxy:

1. Install Nginx:
```bash
sudo apt update
sudo apt install nginx
```

2. Create a new Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/indexer
```

3. Add the following configuration:
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

4. Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/indexer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Set Up SSL with Let's Encrypt (Optional)

If you have a domain name, you can set up SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mainnetindexer.studio-blockchain.com
```

## Maintenance

### Updating the Indexer

To update the indexer to a new version:

```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### Backing Up the Database

To back up the PostgreSQL database:

```bash
docker-compose exec postgres pg_dump -U postgres studio_indexer > backup.sql
```

### Restoring the Database

To restore the PostgreSQL database from a backup:

```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres studio_indexer
```

### Resetting the Indexer

If you need to reset the indexer and start from scratch:

```bash
# Stop the services
docker-compose down

# Remove the volumes
docker volume rm indexer_postgres_data

# Start the services again
docker-compose up -d
```

## Troubleshooting

### RPC Connection Issues

If the indexer is having trouble connecting to the RPC nodes, check the following:

1. Verify that the RPC nodes are accessible:
```bash
curl -X POST https://mainnet.studio-blockchain.com \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

2. Check the logs for any errors:
```bash
docker-compose logs indexer | grep "RPC provider"
```

### Database Issues

If there are issues with the database:

1. Check the PostgreSQL logs:
```bash
docker-compose logs postgres
```

2. Connect to the PostgreSQL database and check the tables:
```bash
docker-compose exec postgres psql -U postgres -d studio_indexer
```

3. Inside the PostgreSQL shell:
```sql
\dt
SELECT COUNT(*) FROM blocks;
SELECT COUNT(*) FROM transactions;
```

### API Issues

If the API is not responding:

1. Check if the API container is running:
```bash
docker-compose ps
```

2. Check the API logs:
```bash
docker-compose logs indexer | grep "API server"
```

3. Try restarting the API:
```bash
docker-compose restart indexer
```

## Contact

If you encounter any issues that you can't resolve, please contact the Studio Blockchain team for assistance.
