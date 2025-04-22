#!/bin/bash

# Script to restart the indexer after an upgrade
# This script will stop the indexer, run the migrations, and start the indexer again

set -e

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Log function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    log "Error: Database environment variables not set"
    log "Please set DB_HOST, DB_PORT, DB_USER, and DB_NAME"
    exit 1
fi

# Check if PGPASSWORD is set
if [ -z "$PGPASSWORD" ] && [ -z "$DB_PASSWORD" ]; then
    log "Error: Database password not set"
    log "Please set PGPASSWORD or DB_PASSWORD"
    exit 1
fi

# Set PGPASSWORD if not already set
if [ -z "$PGPASSWORD" ]; then
    export PGPASSWORD=$DB_PASSWORD
fi

# Stop the indexer
log "Stopping the indexer..."
docker-compose -f "$DIR/docker-compose.yml" down

# Run the migrations
log "Running migrations..."
"$DIR/run-all-migrations.sh"

# Start the indexer
log "Starting the indexer..."
docker-compose -f "$DIR/docker-compose.yml" up -d

# Wait for the indexer to start
log "Waiting for the indexer to start..."
sleep 10

# Check if the indexer is running
log "Checking if the indexer is running..."
if docker-compose -f "$DIR/docker-compose.yml" ps | grep -q "Up"; then
    log "Indexer is running"
else
    log "Error: Indexer failed to start"
    exit 1
fi

# Log success
log "Indexer restarted successfully"
