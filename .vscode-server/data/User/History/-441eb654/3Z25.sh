#!/bin/bash

# Apply the new migration to the database
echo "Applying migration 011_add_token_transfers_unique_constraint.sql..."
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "$(cat migrations/011_add_token_transfers_unique_constraint.sql)"

# Check if the migration was successful
if [ $? -eq 0 ]; then
    echo "Migration applied successfully!"
else
    echo "Error applying migration!"
    exit 1
fi

# Restart the indexer to apply the changes
echo "Restarting the indexer..."
docker restart mainnet-indexer_indexer_1

echo "Done!"
