# Quick Deployment Guide for Studio Blockchain Server

## Step 1: Copy Files to Server

```bash
# On your local machine, create a tar of the indexer files
tar -czf indexer.tar.gz indexer/

# Copy to server
scp indexer.tar.gz root@vmi2334300:/opt/

# SSH into server
ssh root@vmi2334300

# On the server
cd /opt
tar xzf indexer.tar.gz
cd indexer
```

## Step 2: Configure Nginx

```bash
# Create Nginx configuration for indexer
cat > /etc/nginx/sites-available/mainnetindexer.studio-blockchain.com << 'EOL'
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
EOL

# Enable the site
ln -s /etc/nginx/sites-available/mainnetindexer.studio-blockchain.com /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Add SSL (using existing certificate)
certbot --nginx -d mainnetindexer.studio-blockchain.com
```

## Step 3: Start the Services

```bash
# Install Docker Compose if not already installed
apt update
apt install -y docker-compose

# Start the services
cd /opt/indexer
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Step 4: Verify Installation

```bash
# Check if API is responding
curl http://localhost:3000/health

# Check if indexer is syncing
docker-compose logs -f indexer | grep "Processed block"
```

## Common Commands

```bash
# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f indexer
docker-compose logs -f postgres

# Check database
docker-compose exec postgres psql -U postgres -d studio_indexer -c "SELECT COUNT(*) FROM blocks;"
```

## Troubleshooting

1. If services won't start:
```bash
# Check if ports are in use
netstat -tulpn | grep -E '3000|5432'

# Check Docker logs
docker-compose logs
```

2. If database fails to initialize:
```bash
# Remove volumes and try again
docker-compose down -v
docker-compose up -d
```

3. If indexer can't connect to RPC:
```bash
# Test RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://mainnet.studio-blockchain.com
```

## Updating the Indexer

```bash
# Pull latest changes
cd /opt/indexer
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
