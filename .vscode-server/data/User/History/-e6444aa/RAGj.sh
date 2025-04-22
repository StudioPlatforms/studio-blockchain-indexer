#!/bin/bash

# Run the token balances migration
echo "Running token balances migration..."
psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -d ${DB_NAME:-blockchain} -f migrations/003_token_balances.sql

echo "Migration completed successfully!"
