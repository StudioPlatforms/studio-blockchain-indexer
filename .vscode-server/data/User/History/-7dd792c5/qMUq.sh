#!/bin/bash

# Script to apply the verification fix and restart the indexer

echo "Applying verification fix for import handling..."

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

echo "Verification fix has been applied and the indexer has been restarted!"
echo "You can check the logs with: docker-compose logs -f"
