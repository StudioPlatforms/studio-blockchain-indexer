#!/bin/bash
set -e

# Configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-studio_indexer}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
MIGRATIONS_DIR=${MIGRATIONS_DIR:-/app/migrations}
LOG_FILE=${LOG_FILE:-/app/logs/db-healthcheck.log}

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to check if database exists
check_database_exists() {
  log "Checking if database '$DB_NAME' exists..."
  
  # Check if we can connect to PostgreSQL
  if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -c '\l' postgres > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL server at $DB_HOST:$DB_PORT"
    return 1
  fi
  
  # Check if the database exists
  if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "Database '$DB_NAME' exists."
    return 0
  else
    log "Database '$DB_NAME' does not exist."
    return 1
  fi
}

# Function to create database
create_database() {
  log "Creating database '$DB_NAME'..."
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -c "CREATE DATABASE $DB_NAME;" postgres
  log "Database '$DB_NAME' created successfully."
}

# Function to run migrations
run_migrations() {
  log "Running migrations..."
  
  # Check if migrations directory exists
  if [ ! -d "$MIGRATIONS_DIR" ]; then
    log "ERROR: Migrations directory '$MIGRATIONS_DIR' does not exist."
    return 1
  fi
  
  # Run each migration file
  for migration in $MIGRATIONS_DIR/*.sql; do
    log "Running migration: $(basename $migration)"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -d $DB_NAME -f $migration
  done
  
  log "Migrations completed successfully."
}

# Function to check if tables exist
check_tables_exist() {
  log "Checking if tables exist..."
  
  # Check if the blocks table exists
  if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -d $DB_NAME -c "SELECT to_regclass('public.blocks');" | grep -q blocks; then
    log "Tables exist in the database."
    return 0
  else
    log "Tables do not exist in the database."
    return 1
  fi
}

# Main function
main() {
  log "Starting database health check..."
  
  # Check if database exists
  if ! check_database_exists; then
    log "Creating database..."
    create_database
  fi
  
  # Check if tables exist
  if ! check_tables_exist; then
    log "Running migrations..."
    run_migrations
  fi
  
  log "Database health check completed successfully."
}

# Run the main function
main
