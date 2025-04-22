#!/bin/bash

# Script to reset the database and restart the indexer from scratch

# Set environment variables
source ./set-env.sh

echo "$(date '+%Y-%m-%d %H:%M:%S') - Stopping the indexer..."
docker-compose down

echo "$(date '+%Y-%m-%d %H:%M:%S') - Removing the database volume..."
docker volume rm mainnet-indexer_postgres-data || true

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting the indexer with a fresh database..."
docker-compose up -d

echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for the database to start..."
sleep 15

echo "$(date '+%Y-%m-%d %H:%M:%S') - Running migrations inside the Docker container..."
docker exec mainnet-indexer_indexer_1 node /app/run-all-migrations.js

echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for the indexer to start..."
sleep 10

echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking if the indexer is running..."
HEALTH_CHECK=$(curl -s http://localhost:3000/health)
if [[ $HEALTH_CHECK == *"\"status\":\"ok\""* ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Indexer is running"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Database reset successfully"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Indexer is not running"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Database reset failed"
    exit 1
fi
