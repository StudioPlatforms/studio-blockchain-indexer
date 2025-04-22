#!/bin/bash
set -e

# Configuration
LOG_FILE="/var/log/indexer-restart.log"

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Restarting indexer with new security configuration..."

# Stop all containers
log "Stopping all containers..."
cd /root/mainnet-indexer
docker-compose down

# Wait a moment for all containers to stop
sleep 5

# Start all containers with the new configuration
log "Starting all containers with new configuration..."
docker-compose up -d

# Wait for PostgreSQL to initialize
log "Waiting for PostgreSQL to initialize..."
sleep 30

# Check if the analytics_data database exists
log "Checking if analytics_data database exists..."
if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw analytics_data; then
  log "ERROR: analytics_data database does not exist. Something went wrong."
  exit 1
fi

# Check if the honeypot database exists
log "Checking if honeypot database exists..."
if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw studio_indexer; then
  log "ERROR: studio_indexer honeypot database does not exist. Something went wrong."
  exit 1
fi

# Check if the indexer is running
log "Checking if indexer is running..."
if ! docker ps | grep -q mainnet-indexer_indexer_1; then
  log "ERROR: Indexer container is not running. Something went wrong."
  exit 1
fi

log "Indexer restarted successfully with new security configuration"
log "The following protection measures are now in place:"
log "1. Database renamed to 'analytics_data' to avoid targeting by ransomware"
log "2. Honeypot database 'studio_indexer' created to deceive ransomware"
log "3. Honeypot monitor service running to automatically restore the honeypot if deleted"
log "4. Enhanced PostgreSQL security settings with comprehensive logging"
log "5. Suspicious activity monitoring service running"
log "6. Database access restricted to the indexer_user"

echo "Indexer restarted successfully with new security configuration"
echo "Run 'docker ps' to see the running containers"
echo "Run 'docker logs mainnet-indexer_indexer_1' to see the indexer logs"
