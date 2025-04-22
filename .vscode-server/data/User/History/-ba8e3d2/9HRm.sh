#!/bin/bash
set -e

echo "Starting fix and restart process for the blockchain indexer..."

# Stop all containers
echo "Stopping all containers..."
cd /root/mainnet-indexer
docker-compose down

# Start PostgreSQL container
echo "Starting PostgreSQL container..."
docker-compose up -d postgres

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to start..."
sleep 10

# Check if the database exists
echo "Checking if the database exists..."
if docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw studio_indexer; then
  echo "Database exists, dropping it to start fresh..."
  docker exec mainnet-indexer_postgres_1 psql -U postgres -c "DROP DATABASE IF EXISTS studio_indexer;"
fi

# Create the database
echo "Creating database..."
docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE studio_indexer;"

# Run migrations
echo "Running migrations..."
for migration in /root/mainnet-indexer/migrations/*.sql; do
  echo "Running migration: $(basename $migration)"
  docker cp "$migration" mainnet-indexer_postgres_1:/tmp/
  docker exec mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer -f /tmp/$(basename $migration)
done

# Build the enhanced monitor
echo "Building enhanced monitor..."
cd /root/mainnet-indexer/scripts
docker build -t mainnet-indexer_enhanced-monitor -f Dockerfile.enhanced-monitor .

# Start the rest of the containers
echo "Starting all containers..."
cd /root/mainnet-indexer
docker-compose up -d

# Create an initial backup
echo "Creating initial database backup..."
/root/mainnet-indexer/scripts/backup-database.sh

# Start the investigation script in the background
echo "Starting investigation script in the background..."
nohup /root/mainnet-indexer/scripts/investigate-db-deletion.sh > /var/log/investigation-startup.log 2>&1 &

echo "Fix and restart process completed successfully!"
echo "The indexer should now be running and the enhanced monitoring system is active."
echo "Database backups will run every 6 hours."
echo "You can check the status with: docker-compose ps"
echo "You can check the logs with: docker-compose logs -f"
echo "For more information, see the MONITORING.md file."
