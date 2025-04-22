#!/bin/bash

# Script to rebuild and restart the indexer with enhanced verification support

echo "Stopping the indexer..."
docker-compose down

echo "Rebuilding the indexer..."
docker-compose build

echo "Applying the multi-file contracts migration..."
docker-compose up -d postgres
sleep 10  # Wait for postgres to start

# Copy the migration file to the postgres container
echo "Copying migration file to postgres container..."
docker cp migrations/012_multi_file_contracts.sql $(docker-compose ps -q postgres):/tmp/

# Run the migration script inside the postgres container
echo "Running migration..."
docker-compose exec postgres bash -c "
    export PGPASSWORD=new_strong_password
    
    # Create migrations table if it doesn't exist
    psql -h localhost -p 5432 -U new_user -d studio_indexer_new -c \"
        CREATE TABLE IF NOT EXISTS migrations (
            name VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP NOT NULL
        );
    \"
    
    # Apply the migration
    psql -h localhost -p 5432 -U new_user -d studio_indexer_new -f /tmp/012_multi_file_contracts.sql
    
    # Update migrations table
    psql -h localhost -p 5432 -U new_user -d studio_indexer_new -c \"
        INSERT INTO migrations (name, applied_at)
        VALUES ('012_multi_file_contracts', NOW())
        ON CONFLICT (name) DO UPDATE SET applied_at = NOW();
    \"
"

echo "Starting the indexer with enhanced verification support..."
docker-compose up -d

echo "Indexer has been rebuilt and restarted with enhanced verification support."
echo "You can check the logs with: docker-compose logs -f indexer"
echo "The enhanced verification system is now ready to use."
echo "You can verify complex multi-file contracts like Uniswap v3 using the /contracts/verify-multi endpoint."
