#!/bin/bash

# Apply all migrations in order
cd /root/mainnet-indexer

echo "Applying migrations..."

# Apply initial schema
echo "Applying 001_initial_schema.sql..."
node scripts/apply-migration.js 001_initial_schema.sql

# Apply NFT schema
echo "Applying 001_nft_schema.sql..."
node scripts/apply-migration.js 001_nft_schema.sql

# Apply token transfers
echo "Applying 002_token_transfers.sql..."
node scripts/apply-migration.js 002_token_transfers.sql

# Apply token balances
echo "Applying 003_token_balances.sql..."
node scripts/apply-migration.js 003_token_balances.sql

# Apply event logs
echo "Applying 004_event_logs.sql..."
node scripts/apply-migration.js 004_event_logs.sql

# Apply contracts
echo "Applying 005_contracts.sql..."
node scripts/apply-migration.js 005_contracts.sql

# Apply token balances trigger
echo "Applying 006_token_balances_trigger.sql..."
node scripts/apply-migration.js 006_token_balances_trigger.sql

# Apply fix token balances trigger
echo "Applying 007_fix_token_balances_trigger.sql..."
node scripts/apply-migration.js 007_fix_token_balances_trigger.sql

# Apply fix token balances complete
echo "Applying 008_fix_token_balances_complete.sql..."
node scripts/apply-migration.js 008_fix_token_balances_complete.sql

# Apply contract verification
echo "Applying 009_contract_verification.sql..."
node scripts/apply-migration.js 009_contract_verification.sql

# Apply EVM version
echo "Applying 010_add_evm_version.sql..."
node scripts/apply-migration.js 010_add_evm_version.sql

echo "All migrations applied successfully!"

# Restart the indexer
echo "Restarting the indexer..."
docker restart mainnet-indexer_indexer_1

echo "Done!"
