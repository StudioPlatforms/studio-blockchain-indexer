#!/bin/bash

# Test script for Studio Blockchain Explorer API endpoints
BASE_URL="https://mainnetindexer.studio-blockchain.com"
TEST_ADDRESS="0x846c234adc6d8e74353c0c355b0c2b6a1e46634f"
TEST_TOKEN="0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E"

echo "Testing Studio Blockchain Explorer API endpoints..."
echo "=================================================="
echo

# Test account balances endpoint
echo "1. Testing /account/{address}/balances endpoint"
curl -s "$BASE_URL/account/$TEST_ADDRESS/balances" | jq .
echo
echo

# Test address tokens endpoint
echo "2. Testing /address/{address}/tokens endpoint"
curl -s "$BASE_URL/address/$TEST_ADDRESS/tokens" | jq .
echo
echo

# Test token transfers endpoint
echo "3. Testing /address/{address}/token-transfers endpoint"
curl -s "$BASE_URL/address/$TEST_ADDRESS/token-transfers" | jq .
echo
echo

# Test token information endpoint
echo "4. Testing /tokens/{tokenAddress} endpoint"
curl -s "$BASE_URL/tokens/$TEST_TOKEN" | jq .
echo
echo

# Test token holders endpoint
echo "5. Testing /tokens/{tokenAddress}/holders endpoint"
curl -s "$BASE_URL/tokens/$TEST_TOKEN/holders" | jq .
echo
echo

# Test token transfers endpoint
echo "6. Testing /tokens/{address}/transfers endpoint"
curl -s "$BASE_URL/tokens/$TEST_TOKEN/transfers" | jq .
echo
echo

# Test contract detection endpoint
echo "7. Testing /contracts/detect endpoint"
curl -s "$BASE_URL/contracts/detect?fromBlock=1000000&toBlock=1000100" | jq .
echo
echo

# Test health endpoint
echo "8. Testing /health endpoint"
curl -s "$BASE_URL/health" | jq .
echo
echo

# Test blocks endpoint
echo "9. Testing /blocks endpoint"
curl -s "$BASE_URL/blocks?limit=2" | jq .
echo
echo

# Test transactions endpoint
echo "10. Testing /transactions endpoint"
curl -s "$BASE_URL/transactions?limit=2" | jq .
echo
echo

# Test search endpoint
echo "11. Testing /search endpoint with address"
curl -s "$BASE_URL/search?q=$TEST_ADDRESS" | jq .
echo
echo

echo "API testing completed."
