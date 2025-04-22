#!/usr/bin/env node

/**
 * This script fixes the issue with token transfers not being inserted into the database.
 * It modifies the insertTokenTransfer method to use a different conflict resolution strategy
 * that doesn't rely on the idx_token_transfers_unique constraint.
 * 
 * This version also fixes the SQL syntax error by adding commas between column names and values.
 */

const fs = require('fs');
const path = require('path');

// Path to the tokens.ts file
const tokensFilePath = path.join(__dirname, 'mainnet-indexer', 'src', 'services', 'database', 'tokens.ts');

// Read the file
let content = fs.readFileSync(tokensFilePath, 'utf8');

// Replace the insertTokenTransfer method
const oldInsertTokenTransfer = `            await client.query(
                \`INSERT INTO token_transfers (
                    transaction_hash block_number token_address from_address to_address
                    value token_type token_id timestamp
                ) VALUES ($1 $2 $3 $4 $5 $6 $7 $8 $9)
                ON CONFLICT (transaction_hash token_address from_address to_address COALESCE(token_id ''))
                DO UPDATE SET
                    value = EXCLUDED.value
                    token_type = EXCLUDED.token_type
                    timestamp = EXCLUDED.timestamp\`,
                [
                    transfer.transactionHash,
                    transfer.blockNumber,
                    transfer.tokenAddress.toLowerCase(),
                    transfer.fromAddress.toLowerCase(),
                    transfer.toAddress.toLowerCase(),`;

const newInsertTokenTransfer = `            await client.query(
                \`INSERT INTO token_transfers (
                    transaction_hash, block_number, token_address, from_address, to_address,
                    value, token_type, token_id, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))
                DO UPDATE SET
                    value = EXCLUDED.value,
                    token_type = EXCLUDED.token_type,
                    timestamp = EXCLUDED.timestamp\`,
                [
                    transfer.transactionHash,
                    transfer.blockNumber,
                    transfer.tokenAddress.toLowerCase(),
                    transfer.fromAddress.toLowerCase(),
                    transfer.toAddress.toLowerCase(),`;

// Replace the old method with the new one
content = content.replace(oldInsertTokenTransfer, newInsertTokenTransfer);

// Write the file back
fs.writeFileSync(tokensFilePath, content, 'utf8');

console.log('Successfully modified the insertTokenTransfer method in tokens.ts');
console.log('Now you need to restart the indexer for the changes to take effect.');
console.log('You can do this by running:');
console.log('  docker restart mainnet-indexer_indexer_1');
