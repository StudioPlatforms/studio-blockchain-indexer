#!/bin/bash

# Script to run all migrations in order
# This script will run all migrations in the migrations directory

set -e

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Log function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Run a migration
run_migration() {
    local migration_file=$1
    log "Running migration: $migration_file"
    psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "$DIR/migrations/$migration_file"
    log "Migration completed: $migration_file"
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

# Run migrations in order
log "Starting migrations..."

# Initial schema
run_migration "001_initial_schema.sql"

# Token transfers
run_migration "002_token_transfers.sql"

# Token balances
run_migration "003_token_balances.sql"

# NFT schema
run_migration "001_nft_schema.sql"

# Event logs
run_migration "004_event_logs.sql"

# Contracts
run_migration "005_contracts.sql"

log "All migrations completed successfully"
