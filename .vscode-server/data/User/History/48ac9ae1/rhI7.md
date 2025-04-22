# Step-by-Step Deployment Guide

## Prerequisites
- Server where your Studio Blockchain node is running
- Docker and Docker Compose installed on the server
- Git installed on the server
- Basic knowledge of terminal commands

## Step 1: Prepare the Server

1. Connect to your server via SSH:
```bash
ssh user@your-server-ip
```

2. Install Docker if not already installed:
```bash
# Update package list
sudo apt update

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package list again
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and log back in for this to take effect
```

## Step 2: Deploy the Indexer

1. Create a directory for the indexer:
```bash
mkdir -p /opt/studio-indexer
cd /opt/studio-indexer
```

2. Copy all indexer files to the server:
```bash
# On your local machine, from the project root:
scp -r indexer/* user@your-server-ip:/opt/studio-indexer/
```

3. On the server, update the configuration:
```bash
cd /opt/studio-indexer

# Edit docker-compose.yml to set the correct RPC URL
# If your node is running on the same server, use the local URL
nano docker-compose.yml

# Change the RPC_URL to point to your local node, for example:
# RPC_URL=http://localhost:8545
```

## Step 3: Start the Services

1. Build and start the containers:
```bash
# Make scripts executable
chmod +x *.sh

# Start the services
docker-compose up -d
```

2. Check if containers are running:
```bash
docker-compose ps
```

3. View the logs:
```bash
# View all logs
docker-compose logs -f

# View only indexer logs
docker-compose logs -f indexer
```

## Step 4: Verify It's Working

1. Check if the API is responding:
```bash
# Check health endpoint
curl http://localhost:3000/health

# Check latest block
curl http://localhost:3000/v1/blocks/latest

# Check total transactions
curl http://localhost:3000/v1/transactions/count
```

2. Monitor the indexing progress:
```bash
# View real-time logs
docker-compose logs -f indexer | grep "Processed block"
```

## Step 5: Configure Nginx (Optional)

If you want to expose the indexer API to the internet:

1. Install Nginx:
```bash
sudo apt install -y nginx
```

2. Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/studio-indexer

# Add this configuration:
server {
    listen 80;
    server_name mainnetindexer.studio-blockchain.com;  # Updated domain

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

3. Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/studio-indexer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Troubleshooting

1. If containers fail to start:
```bash
# Check container logs
docker-compose logs indexer
docker-compose logs postgres

# Restart containers
docker-compose down
docker-compose up -d
```

2. If database migrations fail:
```bash
# Connect to the indexer container
docker-compose exec indexer sh

# Run migrations manually
npm run migrate up
```

3. If the indexer is not syncing:
```bash
# Check RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://mainnet.studio-blockchain.com  # Updated RPC URL

# Restart indexer if needed
docker-compose restart indexer
```

## Maintenance

1. Update the indexer:
```bash
# Pull latest changes
git pull

# Rebuild and restart containers
docker-compose down
docker-compose build
docker-compose up -d
```

2. Backup the database:
```bash
# Create a backup
docker-compose exec postgres pg_dump -U postgres studio_indexer > backup.sql

# Restore from backup if needed
cat backup.sql | docker-compose exec -T postgres psql -U postgres studio_indexer
```

3. View resource usage:
```bash
docker stats
