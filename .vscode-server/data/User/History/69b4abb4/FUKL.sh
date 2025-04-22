#!/bin/bash

# Script to apply the multi-file contracts migration

# Set the database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-studio_indexer}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Set the migration file
MIGRATION_FILE="migrations/012_multi_file_contracts.sql"

# Check if the migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Apply the migration
echo "Applying migration: $MIGRATION_FILE"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE

# Check if the migration was successful
if [ $? -eq 0 ]; then
    echo "Migration applied successfully"
else
    echo "Migration failed"
    exit 1
fi

# Update the migration status in the database
echo "Updating migration status in the database"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    INSERT INTO migrations (name, applied_at)
    VALUES ('012_multi_file_contracts', NOW())
    ON CONFLICT (name) DO UPDATE SET applied_at = NOW();
"

echo "Migration process completed"
