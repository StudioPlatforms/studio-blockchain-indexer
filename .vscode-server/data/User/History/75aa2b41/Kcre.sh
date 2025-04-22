#!/bin/bash

# Restart the indexer service

echo "Restarting the indexer service..."

# Stop the indexer container
docker-compose stop indexer

# Wait for the container to stop
sleep 5

# Start the indexer container
docker-compose up -d indexer

echo "Indexer service restarted successfully!"
