#!/bin/bash

# Script to rebuild and restart the indexer after code changes

echo "Rebuilding and restarting the Studio Blockchain Indexer..."

# Navigate to the project directory
cd /root/mainnet-indexer

# Stop the running containers
echo "Stopping running containers..."
docker-compose down

# Rebuild the containers
echo "Rebuilding containers..."
docker-compose build

# Start the containers
echo "Starting containers..."
docker-compose up -d

# Wait for the containers to start
echo "Waiting for containers to start..."
sleep 5

# Check if the containers are running
echo "Checking container status..."
docker-compose ps

# Apply migrations
echo "Applying migrations..."
./apply-all-migrations.sh

echo "Rebuild and restart completed!"
echo "You can check the logs with: docker-compose logs -f"
