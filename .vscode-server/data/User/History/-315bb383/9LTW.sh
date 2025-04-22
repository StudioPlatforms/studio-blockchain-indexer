#!/bin/bash
set -e

# Configuration
INDEXER_HOST=${INDEXER_HOST:-localhost}
INDEXER_PORT=${INDEXER_PORT:-3000}
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-studio_indexer}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
CHECK_INTERVAL=${CHECK_INTERVAL:-60}  # Check every 60 seconds
LOG_FILE=${LOG_FILE:-/var/log/indexer-monitor.log}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}  # Optional Slack webhook for notifications

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

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

# Function to check if the indexer API is responding
check_indexer_health() {
  log "Checking indexer health..."
  
  # Check if the health endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/health" > /dev/null; then
    log "ERROR: Indexer health endpoint is not responding"
    return 1
  fi
  
  # Check if the indexer is reporting as healthy
  local health_response=$(curl -s "http://$INDEXER_HOST:$INDEXER_PORT/health")
  if ! echo "$health_response" | grep -q '"status":"ok"'; then
    log "ERROR: Indexer is reporting unhealthy status: $health_response"
    return 1
  fi
  
  # Check if the indexer is actively indexing
  if ! echo "$health_response" | grep -q '"isIndexing":true'; then
    log "ERROR: Indexer is not actively indexing: $health_response"
    return 1
  fi
  
  log "Indexer is healthy and actively indexing"
  return 0
}

# Function to check if the database exists and has tables
check_database() {
  log "Checking database..."
  
  # Check if we can connect to PostgreSQL
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -c '\l' postgres > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL server at $DB_HOST:$DB_PORT"
    return 1
  fi
  
  # Check if the database exists
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "ERROR: Database '$DB_NAME' does not exist"
    return 1
  fi
  
  # Check if the blocks table exists
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -d $DB_NAME -c "SELECT to_regclass('public.blocks');" | grep -q blocks; then
    log "ERROR: 'blocks' table does not exist in the database"
    return 1
  fi
  
  log "Database is healthy"
  return 0
}

# Function to check if the API endpoints are responding
check_api_endpoints() {
  log "Checking API endpoints..."
  
  # Check if the blocks endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/blocks?limit=1" > /dev/null; then
    log "ERROR: Blocks endpoint is not responding"
    return 1
  fi
  
  # Check if the transactions endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/transactions?limit=1" > /dev/null; then
    log "ERROR: Transactions endpoint is not responding"
    return 1
  fi
  
  log "API endpoints are responding"
  return 0
}

# Function to restart the indexer
restart_indexer() {
  log "Restarting indexer..."
  
  # Use docker-compose to restart the indexer
  if ! docker-compose -f /root/mainnet-indexer/docker-compose.yml restart indexer; then
    log "ERROR: Failed to restart indexer"
    return 1
  fi
  
  log "Indexer restarted successfully"
  return 0
}

# Function to recreate the database if it doesn't exist
recreate_database() {
  log "Recreating database..."
  
  # Create the database if it doesn't exist
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "Creating database '$DB_NAME'..."
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -c "CREATE DATABASE $DB_NAME;" postgres; then
      log "ERROR: Failed to create database"
      return 1
    fi
  fi
  
  # Run migrations
  log "Running migrations..."
  for migration in /root/mainnet-indexer/migrations/*.sql; do
    log "Running migration: $(basename $migration)"
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -d $DB_NAME -f $migration; then
      log "ERROR: Failed to run migration: $(basename $migration)"
      return 1
    fi
  done
  
  log "Database recreated successfully"
  return 0
}

# Main monitoring loop
main() {
  log "Starting indexer monitoring..."
  
  while true; do
    # Check if the database exists and has tables
    if ! check_database; then
      log "Database issue detected, attempting to recreate..."
      send_notification "⚠️ Indexer Alert: Database issue detected, attempting to recreate..."
      
      if recreate_database; then
        log "Database recreated, restarting indexer..."
        restart_indexer
      else
        log "Failed to recreate database, manual intervention required"
        send_notification "🚨 Indexer Alert: Failed to recreate database, manual intervention required"
      fi
    fi
    
    # Check if the indexer is healthy
    if ! check_indexer_health; then
      log "Indexer health issue detected, attempting to restart..."
      send_notification "⚠️ Indexer Alert: Health issue detected, attempting to restart..."
      
      if restart_indexer; then
        log "Indexer restarted, monitoring will continue..."
      else
        log "Failed to restart indexer, manual intervention required"
        send_notification "🚨 Indexer Alert: Failed to restart indexer, manual intervention required"
      fi
    fi
    
    # Check if the API endpoints are responding
    if ! check_api_endpoints; then
      log "API endpoint issue detected, attempting to restart indexer..."
      send_notification "⚠️ Indexer Alert: API endpoint issue detected, attempting to restart..."
      
      if restart_indexer; then
        log "Indexer restarted, monitoring will continue..."
      else
        log "Failed to restart indexer, manual intervention required"
        send_notification "🚨 Indexer Alert: Failed to restart indexer, manual intervention required"
      fi
    fi
    
    # Wait for the next check
    log "All checks completed, waiting $CHECK_INTERVAL seconds for next check..."
    sleep $CHECK_INTERVAL
  done
}

# Run the main function
main
