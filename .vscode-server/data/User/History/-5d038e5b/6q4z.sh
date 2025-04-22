#!/bin/bash

# Script to completely delete the current database and start a new one from scratch

# Set environment variables
source ./set-env.sh

echo "$(date '+%Y-%m-%d %H:%M:%S') - Stopping all containers..."
docker-compose down

echo "$(date '+%Y-%m-%d %H:%M:%S') - Removing all data volumes..."
docker volume ls | grep mainnet-indexer | awk '{print $2}' | xargs -r docker volume rm

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting containers with a fresh database..."
docker-compose up -d

echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for the database to start..."
sleep 15

echo "$(date '+%Y-%m-%d %H:%M:%S') - Truncating all tables in the database..."
docker exec mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "
DO \$\$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE;';
    END LOOP;
END \$\$;
"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Running migrations..."
docker exec mainnet-indexer_indexer_1 sh -c "cd /app && node run-migration.js"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Restarting the indexer..."
docker-compose restart indexer

echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for the indexer to start..."
sleep 10

echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking if the indexer is running..."
HEALTH_CHECK=$(curl -s http://localhost:3000/health)
if [[ $HEALTH_CHECK == *"\"status\":\"ok\""* ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Indexer is running"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Database reset successfully"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Indexer is not running"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Database reset failed"
    exit 1
fi
