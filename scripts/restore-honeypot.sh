#!/bin/bash
set -e

# Configuration
POSTGRES_CONTAINER="mainnet-indexer_postgres_1"
HONEYPOT_DB="studio_indexer"
CHECK_INTERVAL=60  # Check every 60 seconds
LOG_FILE="/var/log/honeypot-monitor.log"

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to check if the honeypot database exists
check_database_exists() {
  if docker exec $POSTGRES_CONTAINER psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $HONEYPOT_DB; then
    return 0
  else
    return 1
  fi
}

# Function to restore the honeypot database
restore_honeypot() {
  log "Honeypot database '$HONEYPOT_DB' was deleted. Restoring..."

  # Create the database
  docker exec $POSTGRES_CONTAINER psql -U postgres -c "CREATE DATABASE $HONEYPOT_DB;"

  # Create dummy table and insert data
  docker exec $POSTGRES_CONTAINER psql -U postgres -d $HONEYPOT_DB -c "
    CREATE TABLE dummy_data (id SERIAL PRIMARY KEY, data TEXT);
    INSERT INTO dummy_data (data) VALUES ('This is a honeypot database');
  "

  log "Honeypot database restored successfully"
}

# Main monitoring loop
log "Starting honeypot database monitoring..."

while true; do
  # Check if the honeypot database exists
  if ! check_database_exists; then
    log "ALERT: Honeypot database '$HONEYPOT_DB' has been deleted!"
    restore_honeypot
  fi

  # Wait for the next check
  sleep $CHECK_INTERVAL
done
