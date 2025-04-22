#!/bin/bash

# Script to run the Uniswap V3 contract verification process with import support

echo "=== Uniswap V3 Contract Verification with Import Support ==="
echo "This script will install the required dependencies and run the verification script."

# Create directory for import files if it doesn't exist
mkdir -p /root/uniswap-imports

# Install required dependencies
echo -e "\n=== Installing dependencies ==="
npm install axios

# Apply the verification fix to the indexer
echo -e "\n=== Applying verification fix to the indexer ==="
/root/apply-verification-fix.sh

# Wait for the indexer to start
echo -e "\n=== Waiting for the indexer to start ==="
sleep 10

# Run the verification script
echo -e "\n=== Running verification script with import support ==="
node /root/verify-uniswap-with-imports.js

echo -e "\n=== Verification process completed ==="
echo "Check the output above for the verification results."
echo "You can also check the contracts on the Studio blockchain explorer:"
echo "https://studio-scan.com"
