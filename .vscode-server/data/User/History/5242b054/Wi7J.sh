#!/bin/bash

# Set the working directory to the script's directory
cd "$(dirname "$0")"

echo "Rebuilding and restarting the indexer..."

# Rebuild the indexer
docker-compose build indexer

# Restart the indexer
docker-compose up -d indexer

# Wait for the indexer to start
echo "Waiting for the indexer to start..."
sleep 10

# Make the test script executable
chmod +x test-contract-verification-details.js

# Run the test script
echo "Testing the new verification details endpoint..."
node test-contract-verification-details.js

echo "Done!"
