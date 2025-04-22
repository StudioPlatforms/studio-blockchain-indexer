#!/bin/bash

# Comprehensive script to reset the indexer
# This script will:
# 1. Stop all containers
# 2. Remove all data volumes
# 3. Start containers with a fresh database
# 4. Run all migrations
# 5. Restart the indexer

# Set environment variables
source ./set-env.sh

# Log function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Stop all containers
log "Stopping all containers..."
docker-compose down

# Remove all data volumes
log "Removing all data volumes..."
docker volume ls | grep mainnet-indexer | awk '{print $2}' | xargs -r docker volume rm || true

# Start containers with a fresh database
log "Starting containers with a fresh database..."
docker-compose up -d

# Wait for the database to start
log "Waiting for the database to start..."
sleep 15

# Run all migrations
log "Running migrations..."
for migration in migrations/*.sql; do
    log "Running migration: $(basename $migration)"
    docker exec -i mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -f - < $migration
    log "Migration completed: $(basename $migration)"
done

# Restart the indexer
log "Restarting the indexer..."
docker-compose restart indexer

# Wait for the indexer to start
log "Waiting for the indexer to start..."
sleep 10

# Check if the indexer is running
log "Checking if the indexer is running..."
HEALTH_CHECK=$(curl -s http://localhost:3000/health)
if [[ $HEALTH_CHECK == *"\"status\":\"ok\""* ]]; then
    log "Indexer is running"
    log "Indexer reset successfully"
else
    log "Indexer is not running"
    log "Indexer reset failed"
    exit 1
fi

# Show the current status
log "Current indexer status:"
curl -s http://localhost:3000/health | jq
