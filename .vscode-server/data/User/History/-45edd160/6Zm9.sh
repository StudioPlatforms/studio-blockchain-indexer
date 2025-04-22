#!/bin/bash

# Script to run the Uniswap V3 contract verification process

echo "=== Uniswap V3 Contract Verification for Studio Blockchain ==="
echo "This script will install the required dependencies and run the verification script."

# Create directory for modified contracts if it doesn't exist
mkdir -p /root/modified-contracts

# Install required dependencies
echo -e "\n=== Installing dependencies ==="
npm install axios

# Run the verification script
echo -e "\n=== Running verification script ==="
node /root/verify-uniswap-contracts.js

echo -e "\n=== Verification process completed ==="
echo "Check the output above for the verification results."
echo "You can also check the contracts on the Studio blockchain explorer:"
echo "https://studio-scan.com"
