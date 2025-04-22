#!/bin/bash

# Stop the indexer service
echo "Stopping the indexer service..."
systemctl stop mainnet-indexer

# Wait for the service to stop
sleep 5

# Start the indexer service
echo "Starting the indexer service..."
systemctl start mainnet-indexer

# Check the status of the service
echo "Checking the status of the indexer service..."
systemctl status mainnet-indexer

echo "Indexer service has been restarted."
