#!/bin/bash

# Script to install Uniswap dependencies for contract verification
echo "Installing Uniswap dependencies for contract verification..."

# Change to the indexer directory
cd /root/mainnet-indexer

# Install Uniswap v3 core
echo "Installing @uniswap/v3-core..."
npm install @uniswap/v3-core

# Install Uniswap v3 periphery
echo "Installing @uniswap/v3-periphery..."
npm install @uniswap/v3-periphery

# Install OpenZeppelin contracts (commonly used with Uniswap)
echo "Installing @openzeppelin/contracts..."
npm install @openzeppelin/contracts

echo "Dependencies installed successfully!"
echo "You can now verify Uniswap v3 contracts using the enhanced verification system."
echo "See README-LARGE-CONTRACT-VERIFICATION.md for details."
