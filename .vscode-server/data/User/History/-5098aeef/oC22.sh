#!/bin/bash

# Run all migrations in order
echo "Running all migrations..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running or not installed. Please start Docker and try again."
  exit 1
fi

# Check if the postgres container is running
if ! docker ps | grep -q postgres; then
  echo "PostgreSQL container is not running. Starting the containers..."
  docker-compose up -d postgres
  
  # Wait for PostgreSQL to be ready
  echo "Waiting for PostgreSQL to be ready..."
  sleep 10
fi

# Run the initial schema migration
echo "Executing initial schema migration..."
docker exec -i $(docker ps -q -f name=postgres) psql -U new_user -d studio_indexer_new -f - < migrations/001_initial_schema.sql

# Run the token transfers migration
echo "Executing token transfers migration..."
docker exec -i $(docker ps -q -f name=postgres) psql -U new_user -d studio_indexer_new -f - < migrations/002_token_transfers.sql

# Run the token balances migration
echo "Executing token balances migration..."
docker exec -i $(docker ps -q -f name=postgres) psql -U new_user -d studio_indexer_new -f - < migrations/003_token_balances.sql

echo "All migrations completed successfully!"
