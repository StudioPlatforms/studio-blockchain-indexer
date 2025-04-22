#!/bin/bash
set -e

echo "Starting database reset process..."

# Stop all containers
echo "Stopping all containers..."
cd /root/mainnet-indexer
docker-compose down

# Start PostgreSQL container
echo "Starting PostgreSQL container..."
docker-compose up -d postgres

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to start..."
sleep 15

# Check if the database exists and drop it
echo "Checking if the database exists..."
if docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw studio_indexer_new; then
  echo "Database studio_indexer_new exists, dropping it..."
  docker exec mainnet-indexer_postgres_1 psql -U postgres -c "DROP DATABASE IF EXISTS studio_indexer_new;"
fi

# Check if the analytics database exists and drop it
if docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw analytics_data_new; then
  echo "Database analytics_data_new exists, dropping it..."
  docker exec mainnet-indexer_postgres_1 psql -U postgres -c "DROP DATABASE IF EXISTS analytics_data_new;"
fi

# Create the databases
echo "Creating databases..."
docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE studio_indexer_new;"
docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE analytics_data_new;"

# Run migrations on analytics_data_new
echo "Running migrations on analytics_data_new..."
for migration in /root/mainnet-indexer/migrations/*.sql; do
  echo "Running migration: $(basename $migration)"
  docker cp "$migration" mainnet-indexer_postgres_1:/tmp/
  docker exec mainnet-indexer_postgres_1 psql -U postgres -d analytics_data_new -f /tmp/$(basename $migration)
done

# Create honeypot database
echo "Creating honeypot database..."
docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE studio_indexer;"
docker exec mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -c "
  CREATE TABLE dummy_data (id SERIAL PRIMARY KEY, data TEXT);
  INSERT INTO dummy_data (data) VALUES ('This is a honeypot database');
"

# Start all containers
echo "Starting all containers..."
docker-compose up -d

echo "Database reset process completed successfully!"
echo "The indexer should now be running with the new database schema."
echo "You can check the status with: docker-compose ps"
echo "You can check the logs with: docker-compose logs -f indexer"
