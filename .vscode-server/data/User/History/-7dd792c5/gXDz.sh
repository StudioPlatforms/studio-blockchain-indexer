#!/bin/bash

# Navigate to the mainnet-indexer directory
cd /root/mainnet-indexer

# Build the project to apply the changes
echo "Building the project..."
npm run build

# Restart the indexer service
echo "Restarting the indexer service..."
npm run restart

echo "Verification fix has been applied and the indexer service has been restarted."
