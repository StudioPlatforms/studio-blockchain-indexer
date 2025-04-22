#!/bin/bash

# Run the token balances migration
echo "Running token balances migration..."

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

# Run the migration inside the postgres container
echo "Executing migration script..."
docker exec -i $(docker ps -q -f name=postgres) psql -U new_user -d studio_indexer_new -f - < migrations/003_token_balances.sql

echo "Migration completed successfully!"
