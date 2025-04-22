#!/bin/bash

# Script to rebuild and restart the indexer with the new verification system

echo "Stopping the indexer..."
docker-compose down

echo "Rebuilding the indexer..."
docker-compose build

echo "Starting the indexer..."
docker-compose up -d

echo "Indexer has been rebuilt and restarted with the new verification system."
echo "You can check the logs with: docker-compose logs -f indexer"
echo ""
echo "The new verification API endpoints are available at:"
echo "- GET  /api/v2/contracts/:address/verification"
echo "- POST /api/v2/contracts/verify"
echo "- POST /api/v2/contracts/verify-multi"
echo "- POST /api/v2/contracts/flatten"
echo "- GET  /api/v2/verification/compiler-versions"
echo "- GET  /api/v2/verification/evm-versions"
echo ""
echo "For more information, see the README-ENHANCED-VERIFICATION.md file."
