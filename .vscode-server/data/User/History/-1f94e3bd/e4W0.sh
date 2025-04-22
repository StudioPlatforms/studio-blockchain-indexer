#!/bin/bash

# Script to run all migrations inside the Docker container

# Set environment variables
source ./set-env.sh

echo "$(date '+%Y-%m-%d %H:%M:%S') - Running migrations inside the Docker container..."

# Run each migration file
for migration in migrations/*.sql; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Running migration: $(basename $migration)"
    docker exec -i mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -f - < $migration
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Migration completed: $(basename $migration)"
done

echo "$(date '+%Y-%m-%d %H:%M:%S') - All migrations completed successfully"
