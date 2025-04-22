#!/bin/bash

# Script to run the Uniswap V3 contract verification process with minimal output

echo "=== Uniswap V3 Contract Verification for Studio Blockchain ==="
echo "Running with minimal logging. Full logs will be saved to verification.log"

# Create directory for modified contracts if it doesn't exist
mkdir -p /root/modified-contracts &> /dev/null

# Install required dependencies silently
echo "Installing dependencies..."
npm install axios --silent &> /dev/null

# Run the verification script and save logs to file
echo "Verifying contracts... (this may take a few minutes)"
node /root/verify-uniswap-contracts.js 2>&1 | tee verification.log

echo -e "\n=== Verification process completed ==="
echo "Detailed logs saved to verification.log"
echo "You can check the contracts on the Studio blockchain explorer:"
echo "https://studio-scan.com"
