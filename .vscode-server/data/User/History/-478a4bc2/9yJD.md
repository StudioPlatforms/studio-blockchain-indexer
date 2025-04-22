# Studio Blockchain Mainnet Indexer Upgrade Plan

## Overview

This document outlines the plan for upgrading the Studio Blockchain Mainnet Indexer to support new features for the blockchain explorer, including automatic detection of new deployed contract addresses and fetching contract information such as name, symbol, and supply.

## Database Schema Upgrades

We've added the following new database tables:

1. **token_balances** (migration: 003_token_balances.sql)
   - Stores token balances for addresses
   - Includes token type, balance, and token ID (for NFTs)
   - Indexed by address and token address

2. **event_logs** (migration: 004_event_logs.sql)
   - Stores event logs from the blockchain
   - Includes transaction hash, block number, log index, address, topics, and data
   - Indexed by transaction hash, block number, address, and topics

3. **contracts** (migration: 005_contracts.sql)
   - Stores contract information
   - Includes creator address, contract type, name, symbol, decimals, and total supply
   - Indexed by creator address, contract type, and block number

## New API Endpoints

We've added the following new API endpoints:

1. **Account Balances**
   - Endpoint: `/account/{address}/balances`
   - Returns native balance and token balances for an address
   - Includes token contract address, symbol, name, balance, decimals, and type

2. **Address Tokens**
   - Endpoint: `/address/{address}/tokens`
   - Returns token balances for an address
   - Includes token contract address, symbol, name, balance, decimals, and type

3. **Token Transfers**
   - Endpoint: `/address/{address}/token-transfers`
   - Returns token transfers for an address
   - Includes transaction hash, block number, timestamp, from address, to address, token address, token symbol, token name, value, and decimals

4. **Token Information**
   - Endpoint: `/tokens/{tokenAddress}`
   - Returns detailed information about a token
   - Includes token address, symbol, name, decimals, total supply, type, holders count, and transfers count

5. **Token Holders**
   - Endpoint: `/tokens/{tokenAddress}/holders`
   - Returns holders of a token
   - Includes address, balance, and percentage of total supply

6. **Contract Information**
   - Endpoint: `/contracts/{address}`
   - Returns detailed information about a contract
   - Includes creator address, contract type, name, symbol, decimals, and total supply

7. **Contracts by Creator**
   - Endpoint: `/address/{address}/contracts`
   - Returns contracts created by an address
   - Includes contract address, contract type, name, symbol, and creation information

## New Indexer Features

We've added the following new indexer features:

1. **Contract Detection**
   - Automatically detects new deployed contracts
   - Determines contract type (ERC20, ERC721, ERC1155, or unknown)
   - Fetches contract information such as name, symbol, and supply

2. **Event Log Indexing**
   - Indexes event logs from the blockchain
   - Stores event logs in the database for querying
   - Used for detecting token transfers and other events

3. **Token Balance Tracking**
   - Tracks token balances for addresses
   - Updates token balances when tokens are transferred
   - Stores token balances in the database for querying

## Deployment Plan

1. **Database Migration**
   - Run the new migrations to create the new tables
   - Use the `run-all-migrations.sh` script to run all migrations in order

2. **Code Deployment**
   - Deploy the updated code to the server
   - Restart the indexer service

3. **Indexer Restart**
   - Restart the indexer to start indexing new contracts and event logs
   - Monitor the indexer to ensure it's working correctly

4. **Verification**
   - Verify that the new API endpoints are working correctly
   - Test with known addresses and contracts

## Security Considerations

1. **Database Security**
   - The database is protected by the ransomware honeypot
   - The honeypot will continue to protect the database during the upgrade

2. **API Security**
   - The API endpoints are protected by rate limiting
   - The API endpoints are protected by authentication

3. **Indexer Security**
   - The indexer is protected by the monitor service
   - The monitor service will restart the indexer if it crashes

## Monitoring

1. **Database Monitoring**
   - Monitor the database for any signs of ransomware activity
   - Use the `db-healthcheck.sh` script to check the database health

2. **Indexer Monitoring**
   - Monitor the indexer for any signs of crashes or errors
   - Use the `monitor-indexer.sh` script to monitor the indexer

3. **API Monitoring**
   - Monitor the API for any signs of errors or performance issues
   - Use the `enhanced-monitor.sh` script to monitor the API

## Rollback Plan

1. **Database Rollback**
   - If the database migration fails, roll back to the previous schema
   - Use the `restore-honeypot.sh` script to restore the database

2. **Code Rollback**
   - If the code deployment fails, roll back to the previous code
   - Use the `fix-and-start.sh` script to roll back and restart the indexer

3. **Indexer Rollback**
   - If the indexer fails to start, roll back to the previous version
   - Use the `restart-indexer.sh` script to restart the indexer
