#!/bin/bash

# Apply the EVM version migration
echo "Applying EVM version migration..."
cd /root/mainnet-indexer
node scripts/apply-migration.js 010_add_evm_version.sql

echo "Migration applied successfully!"
