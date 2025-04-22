#!/bin/bash
set -e

# Configuration
INDEXER_HOST=${INDEXER_HOST:-localhost}
INDEXER_PORT=${INDEXER_PORT:-3000}
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-studio_indexer_new}  # Updated to match docker-compose.yml
DB_USER=${DB_USER:-new_user}  # Updated to match docker-compose.yml
DB_PASSWORD=${DB_PASSWORD:-new_strong_password}  # Updated to match docker-compose.yml
CHECK_INTERVAL=${CHECK_INTERVAL:-60}  # Check every 60 seconds
LOG_FILE=${LOG_FILE:-/var/log/enhanced-monitor.log}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/indexer}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}  # Optional Slack webhook for notifications
DOCKER_COMPOSE_FILE=${DOCKER_COMPOSE_FILE:-"/project/docker-compose.yml"}
HONEYPOT_DB="studio_indexer"  # Name of the honeypot database

# Ensure log and backup directories exist
mkdir -p $(dirname $LOG_FILE)
mkdir -p $BACKUP_DIR

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to send Slack notification
send_notification() {
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$1\"}" \
      $SLACK_WEBHOOK_URL
  fi
}

# Function to check if PostgreSQL is running
check_postgres() {
  log "Checking if PostgreSQL is running..."

  # Try to connect to PostgreSQL directly
  if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL server"
    return 1
  fi

  log "PostgreSQL is running"
  return 0
}

# Function to check if the database exists and has tables
check_database() {
  log "Checking database..."

  # Check if we can connect to PostgreSQL
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c '\l' > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL server"
    return 1
  fi

  # Check if the database exists
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "ERROR: Database '$DB_NAME' does not exist"
    return 1
  }

  # Skip checking for blocks table for now - it might not exist yet
  # if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT to_regclass('public.blocks');" | grep -q blocks; then
  #   log "ERROR: 'blocks' table does not exist in the database"
  #   return 1
  # }

  log "Database is healthy"
  return 0
}

# Function to check if the honeypot database exists
check_honeypot() {
  log "Checking honeypot database..."

  # Create the honeypot database if it doesn't exist
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $HONEYPOT_DB; then
    log "Honeypot database does not exist, creating it..."
    restore_honeypot
    return 0
  }

  log "Honeypot database is intact"
  return 0
}

# Function to restore the honeypot database
restore_honeypot() {
  log "Restoring honeypot database..."

  # Create the honeypot database
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $HONEYPOT_DB;" > /dev/null 2>&1; then
    log "ERROR: Failed to create honeypot database"
    return 1
  }

  # Create dummy table and insert data
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $HONEYPOT_DB -c "
    CREATE TABLE dummy_data (id SERIAL PRIMARY KEY, data TEXT);
    INSERT INTO dummy_data (data) VALUES ('This is a honeypot database');
  " > /dev/null 2>&1; then
    log "ERROR: Failed to create dummy data in honeypot database"
    return 1
  }

  log "Honeypot database restored successfully"
  send_notification "🚨 SECURITY ALERT: Honeypot database was deleted and has been restored"
  return 0
}

# Function to check if the indexer API is responding
check_indexer_health() {
  log "Checking indexer health..."

  # Add a delay to give the indexer time to start up
  sleep 10

  # Check if the health endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/health" > /dev/null 2>&1; then
    log "ERROR: Indexer health endpoint is not responding"
    return 1
  }

  # Check if the indexer is reporting as healthy
  local health_response=$(curl -s "http://$INDEXER_HOST:$INDEXER_PORT/health")
  if ! echo "$health_response" | grep -q '"status":"ok"'; then
    log "ERROR: Indexer is reporting unhealthy status: $health_response"
    return 1
  }

  log "Indexer is healthy"
  return 0
}

# Function to check if the API endpoints are responding
check_api_endpoints() {
  log "Checking API endpoints..."

  # Add a delay to give the API time to start up
  sleep 5

  # Check if the blocks endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/blocks?limit=1" > /dev/null 2>&1; then
    log "ERROR: Blocks endpoint is not responding"
    return 1
  }

  # Check if the transactions endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/transactions?limit=1" > /dev/null 2>&1; then
    log "ERROR: Transactions endpoint is not responding"
    return 1
  }

  log "API endpoints are responding"
  return 0
}

# Main monitoring loop
main() {
  log "Starting enhanced indexer monitoring..."
  send_notification "🚀 Enhanced indexer monitoring started"

  # Wait for PostgreSQL to be ready
  log "Waiting for PostgreSQL to be ready..."
  while ! check_postgres; do
    log "PostgreSQL not ready yet, waiting 5 seconds..."
    sleep 5
  }

  # Wait for the indexer to be ready
  log "Waiting for indexer to be ready..."
  while ! check_indexer_health; do
    log "Indexer not ready yet, waiting 10 seconds..."
    sleep 10
  }

  # Main monitoring loop
  while true; do
    # Check if PostgreSQL is running
    if ! check_postgres; then
      log "PostgreSQL issue detected, waiting for it to recover..."
      sleep 30
      continue
    }

    # Check if the honeypot database exists
    check_honeypot

    # Check if the database exists
    if ! check_database; then
      log "Database issue detected, waiting for it to recover..."
      sleep 30
      continue
    }

    # Check if the indexer is healthy
    if ! check_indexer_health; then
      log "Indexer health issue detected, waiting for it to recover..."
      sleep 30
      continue
    }

    # Check if the API endpoints are responding
    if ! check_api_endpoints; then
      log "API endpoint issue detected, waiting for it to recover..."
      sleep 30
      continue
    }

    # Wait for the next check
    log "All checks completed, waiting $CHECK_INTERVAL seconds for next check..."
    sleep $CHECK_INTERVAL
  done
}

# Run the main function
main
