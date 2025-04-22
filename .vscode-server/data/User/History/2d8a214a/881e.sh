#!/bin/bash
set -e

echo "Rebuilding Docker containers..."
cd "$(dirname "$0")"

# Rebuild the containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "Waiting for services to start..."
sleep 30

# Test the token balance endpoint
echo "Testing token balance endpoint..."
WALLET_ADDRESS="0x846C234adc6D8E74353c0c355b0c2B6a1e46634f"
TOKEN_ADDRESS="0xfb0ae661d04f463b43ae36f9fd2a7ce95538b5a1"

echo "Fetching token balance for wallet $WALLET_ADDRESS..."
curl -s "http://localhost:3000/account/$WALLET_ADDRESS/balances?force_blockchain=true" | grep -A 10 "$TOKEN_ADDRESS"

echo "Done!"
