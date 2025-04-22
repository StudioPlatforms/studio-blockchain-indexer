# Studio Blockchain Explorer Indexer Analysis

## Overview of the Indexer

The Studio Blockchain Explorer Indexer is designed to scan the blockchain for blocks, transactions, and events, and store them in a PostgreSQL database. It provides an API for accessing this data, including endpoints for token transfers.

## Token Transfer Endpoints

Based on my analysis, the indexer has the following endpoints for token transfers:

1. `/address/{address}/token-transfers` - Returns all token transfers for an address (both incoming and outgoing)
2. `/tokens/{tokenAddress}/transfers` - Returns the transfers of a token

These endpoints are implemented in `src/services/api/tokens.ts`:

```typescript
// Get token transfers for an address
this.app.get('/address/:address/token-transfers', this.getAddressTokenTransfers.bind(this));

// Get token transfers
this.app.get('/tokens/:address/transfers', this.getTokenTransfers.bind(this));
```

## Current Behavior

When I tried to access these endpoints, they returned empty arrays:

```bash
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers?limit=5" | jq
[]

curl -s "http://localhost:3000/address/0x846C234adc6D8E74353c0c355b0c2B6a1e46634f/token-transfers?limit=5" | jq
[]
```

However, when I checked the token balances, I found that the indexer is correctly tracking token balances:

```bash
curl -s "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/holders" | jq
[
  {
    "address": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "balance": "597866780000",
    "percentage": 29.924366378523235
  },
  {
    "address": "0x7fd526dc3d193a3da6c330956813a6b358bca1ff",
    "balance": "52250000",
    "percentage": 0.0026152116083081904
  },
  {
    "address": "0x188ed01066d35cf6ce9e68c8289babb37e5bc219",
    "balance": "21400000",
    "percentage": 0.0010711105917281393
  },
  {
    "address": "0xcbb0cdf4d9a4a14d031a66de6adb4bfc2141ffb7",
    "balance": "1399985850000",
    "percentage": 70.07194729927673
  }
]
```

This suggests that the indexer is processing blocks and updating token balances, but it's not storing token transfers in the database.

## How the Indexer Processes Token Transfers

The indexer processes token transfers in the `processTokenTransfers` method in `src/services/indexer.ts`:

```typescript
private async processTokenTransfers(txHash: string, blockNumber: number, timestamp: number) {
    try {
        // Get the transaction receipt
        const receipt = await blockchain.getTransactionReceipt(txHash);
        if (!receipt) {
            logger.warn(`Receipt not found for transaction ${txHash}`);
            return;
        }
        
        // Get token transfers from the receipt
        const transfers = await blockchain.getTokenTransfersFromReceipt(receipt);
        
        // Store each token transfer
        for (const transfer of transfers) {
            try {
                await db.insertTokenTransfer({
                    transactionHash: txHash,
                    blockNumber,
                    tokenAddress: transfer.tokenAddress,
                    fromAddress: transfer.from,
                    toAddress: transfer.to,
                    value: transfer.value,
                    tokenType: transfer.tokenType,
                    tokenId: transfer.tokenId,
                    timestamp
                });
                
                // Add addresses involved in token transfers to the update queue
                if (transfer.tokenType === 'ERC20') {
                    if (transfer.from !== '0x0000000000000000000000000000000000000000') {
                        this._addressesToUpdate.add(transfer.from.toLowerCase());
                    }
                    if (transfer.to !== '0x0000000000000000000000000000000000000000') {
                        this._addressesToUpdate.add(transfer.to.toLowerCase());
                    }
                }
                
                // If this is an NFT transfer, update the NFT metadata
                if ((transfer.tokenType === 'ERC721' || transfer.tokenType === 'ERC1155') && transfer.tokenId) {
                    await this.processNFTMetadata(transfer.tokenAddress, transfer.tokenId);
                }
                
                // If this is a new token, update the token collection info
                await this.processTokenCollection(transfer.tokenAddress);
                
                logger.info(`Processed ${transfer.tokenType} transfer in transaction ${txHash}`);
            } catch (error) {
                logger.error(`Error processing token transfer in transaction ${txHash}:`, error);
            }
        }
        
        // Check if it's time to update token balances
        await this.checkAndUpdateTokenBalances();
    } catch (error) {
        logger.error(`Error processing token transfers for transaction ${txHash}:`, error);
    }
}
```

This method is called for each transaction in a block in the `processBlocks` method:

```typescript
private async processBlocks() {
    while (this._isRunning) {
        try {
            // Get the latest block number from the chain
            const latestBlockNumber = await blockchain.getLatestBlockNumber();

            // Don't process if we're caught up
            if (this._latestProcessedBlock >= latestBlockNumber - config.indexer.confirmations) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // Process the next block
            const nextBlock = this._latestProcessedBlock + 1;
            logger.info(`Processing block ${nextBlock}`);

            const { block, transactions } = await blockchain.getBlockWithTransactions(nextBlock);
            
            // Store the block
            await db.insertBlock(block);

            // Store each transaction and process token transfers
            for (const tx of transactions) {
                try {
                    await db.insertTransaction(tx);
                    
                    // Process token transfers
                    await this.processTokenTransfers(tx.hash, tx.blockNumber, block.timestamp);
                    
                    logger.info(`Processed transaction ${tx.hash} in block ${block.number}`);
                } catch (error) {
                    logger.error(`Error processing transaction ${tx.hash}:`, error);
                }
            }
            
            // Process new contracts in this block
            await this.processNewContracts(nextBlock, nextBlock);

            this._latestProcessedBlock = nextBlock;
            
            // Log progress every 10 blocks
            if (nextBlock % 10 === 0) {
                logger.info(`Processed up to block ${nextBlock}, chain head is at ${latestBlockNumber}`);
            }

        } catch (error) {
            logger.error('Error processing blocks:', error);
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
```

## Token Transfer Database Operations

The token transfers are stored in the database using the `insertTokenTransfer` method in `src/services/database/tokens.ts`:

```typescript
async insertTokenTransfer(transfer: TokenTransfer): Promise<void> {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO token_transfers (
                transaction_hash, block_number, token_address, from_address, to_address,
                value, token_type, token_id, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))
            DO UPDATE SET
                value = EXCLUDED.value,
                token_type = EXCLUDED.token_type,
                timestamp = EXCLUDED.timestamp`,
            [
                transfer.transactionHash,
                transfer.blockNumber,
                transfer.tokenAddress.toLowerCase(),
                transfer.fromAddress.toLowerCase(),
                transfer.toAddress.toLowerCase(),
                transfer.value,
                transfer.tokenType,
                transfer.tokenId || null,
                new Date(transfer.timestamp * 1000),
            ]
        );

        // Update ERC20 balances for from and to addresses
        if (transfer.tokenType === 'ERC20') {
            // Only deduct balance from sender if it's not the zero address (minting)
            if (transfer.fromAddress !== '0x0000000000000000000000000000000000000000') {
                await client.query(
                    `INSERT INTO token_balances (address, token_address, token_type, balance, updated_at)
                    VALUES ($1, $2, $3, '0', NOW())
                    ON CONFLICT (address, token_address, COALESCE(token_id, '')) 
                    DO UPDATE SET
                        balance = (
                            CASE
                                WHEN token_balances.balance::numeric - $4::numeric < 0 THEN '0'
                                ELSE (token_balances.balance::numeric - $4::numeric)::text
                            END
                        ),
                        updated_at = NOW()`,
                    [
                        transfer.fromAddress.toLowerCase(),
                        transfer.tokenAddress.toLowerCase(),
                        transfer.tokenType,
                        transfer.value
                    ]
                );
            }

            // Only add balance to receiver if it's not the zero address (burning)
            if (transfer.toAddress !== '0x0000000000000000000000000000000000000000') {
                await client.query(
                    `INSERT INTO token_balances (address, token_address, token_type, balance, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (address, token_address, COALESCE(token_id, '')) 
                    DO UPDATE SET
                        balance = (token_balances.balance::numeric + $4::numeric)::text,
                        updated_at = NOW()`,
                    [
                        transfer.toAddress.toLowerCase(),
                        transfer.tokenAddress.toLowerCase(),
                        transfer.tokenType,
                        transfer.value
                    ]
                );
            }
            
            // Update is_creator flag for minting events
            if (transfer.fromAddress === '0x0000000000000000000000000000000000000000' && 
                transfer.toAddress !== '0x0000000000000000000000000000000000000000') {
                await client.query(
                    `UPDATE token_balances
                    SET is_creator = TRUE, updated_at = NOW()
                    WHERE address = $1 AND token_address = $2`,
                    [
                        transfer.toAddress.toLowerCase(),
                        transfer.tokenAddress.toLowerCase()
                    ]
                );
                
                // Try to update the contract record with the creator address
                await client.query(
                    `UPDATE contracts 
                    SET creator_address = $1, updated_at = NOW()
                    WHERE address = $2 AND creator_address = '0x0000000000000000000000000000000000000000'`,
                    [
                        transfer.toAddress.toLowerCase(),
                        transfer.tokenAddress.toLowerCase()
                    ]
                );
            }
        }

        // If this is an NFT transfer, update the NFT token record
        if ((transfer.tokenType === 'ERC721' || transfer.tokenType === 'ERC1155') && transfer.tokenId) {
            await this.updateNFTOwnership(
                client,
                transfer.tokenAddress,
                transfer.tokenId,
                transfer.toAddress,
                transfer.timestamp
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error inserting token transfer:', error);
        throw error;
    } finally {
        client.release();
    }
}
```

## Token Transfer Database Schema

The token transfers are stored in the `token_transfers` table, which is created in the `002_token_transfers.sql` migration:

```sql
-- Create token_transfers table
CREATE TABLE IF NOT EXISTS token_transfers (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value NUMERIC(78) NOT NULL,
    token_type VARCHAR(10) NOT NULL, -- 'ERC20' or 'ERC721'
    token_id VARCHAR(78), -- For ERC-721 tokens
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_transfers_transaction_hash ON token_transfers(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_token_transfers_block_number ON token_transfers(block_number);
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_address ON token_transfers(token_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_from_address ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_to_address ON token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_id ON token_transfers(token_id);
```

A unique constraint is added to the `token_transfers` table in the `011_add_token_transfers_unique_constraint.sql` migration:

```sql
-- Migration: 011_add_token_transfers_unique_constraint.sql
-- Description: Add a unique constraint to the token_transfers table

-- Add a unique constraint to the token_transfers table
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_transfers_unique ON token_transfers(transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''));
```

## Potential Issues

Based on my analysis, there are several potential issues that could be causing the token transfers to not be stored in the database:

1. **Unique Constraint Issue**: The `insertTokenTransfer` method uses `ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))` for conflict resolution, but this requires the unique constraint to be present in the database. If the `011_add_token_transfers_unique_constraint.sql` migration hasn't been applied, this could cause issues.

2. **Error Handling**: The `processTokenTransfers` method catches errors when inserting token transfers, but it doesn't retry or log the specific error. This could hide the root cause of the issue.

3. **Token Transfer Detection**: The `getTokenTransfersFromReceipt` method in the blockchain service might not be correctly detecting token transfers from transaction receipts.

4. **Database Connection**: There might be issues with the database connection or permissions that prevent the indexer from inserting token transfers.

5. **Transaction Rollback**: If there's an error in any part of the `insertTokenTransfer` method, the entire transaction is rolled back, which would prevent the token transfer from being stored.

## Fix Attempts

I found several scripts in the repository that seem to be related to fixing issues with token transfers:

1. `fix-token-transfers.js`: This script modifies the `insertTokenTransfer` method to use a different conflict resolution strategy:

```javascript
// Replace the insertTokenTransfer method
const oldInsertTokenTransfer = `            await client.query(
                \`INSERT INTO token_transfers (
                    transaction_hash, block_number, token_address, from_address, to_address,
                    value, token_type, token_id, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT ON CONSTRAINT idx_token_transfers_unique
                DO UPDATE SET
                    value = EXCLUDED.value,
                    token_type = EXCLUDED.token_type,
                    timestamp = EXCLUDED.timestamp\`,
                [
                    transfer.transactionHash,
                    transfer.blockNumber,
                    transfer.tokenAddress.toLowerCase(),
                    transfer.fromAddress.toLowerCase(),
                    transfer.toAddress.toLowerCase(),
                    transfer.value,
                    transfer.tokenType,
                    transfer.tokenId || null,
                    new Date(transfer.timestamp * 1000),
                ]
            );`;

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
                    transfer.toAddress.toLowerCase(),
                    transfer.value,
                    transfer.tokenType,
                    transfer.tokenId || null,
                    new Date(transfer.timestamp * 1000),
                ]
            );`;
```

This suggests that there was an issue with the conflict resolution strategy, where it was using `ON CONFLICT ON CONSTRAINT idx_token_transfers_unique` instead of `ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))`.

2. `apply-token-transfers-migration.sh`: This script applies the `011_add_token_transfers_unique_constraint.sql` migration to add the unique constraint to the `token_transfers` table:

```bash
#!/bin/bash

# Apply the new migration to the database
echo "Applying migration 011_add_token_transfers_unique_constraint.sql..."
docker exec -it mainnet-indexer_postgres_1 psql -U new_user -d studio_indexer_new -c "$(cat migrations/011_add_token_transfers_unique_constraint.sql)"

# Check if the migration was successful
if [ $? -eq 0 ]; then
    echo "Migration applied successfully!"
else
    echo "Error applying migration!"
    exit 1
fi

# Restart the indexer to apply the changes
echo "Restarting the indexer..."
docker restart mainnet-indexer_indexer_1

echo "Done!"
```

3. `apply-token-transfers-migration-to-current-db.js`: This script applies the `011_add_token_transfers_unique_constraint.sql` migration to the current database:

```javascript
async function applyMigration() {
    const client = await pool.connect();
    try {
        console.log('Applying migration: 011_add_token_transfers_unique_constraint.sql');
        
        // Read the migration file
        const migrationPath = path.join(__dirname, 'mainnet-indexer', 'migrations', '011_add_token_transfers_unique_constraint.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Start a transaction
        await client.query('BEGIN');
        
        // Execute the migration
        await client.query(sql);
        
        // Record the migration in the migrations table
        await client.query(
            `INSERT INTO migrations (name, applied_at) VALUES ($1, NOW())
            ON CONFLICT (name) DO UPDATE SET applied_at = NOW()`,
            ['011_add_token_transfers_unique_constraint.sql']
        );
        
        // Commit the transaction
        await client.query('COMMIT');
        
        console.log('Migration applied successfully');
    } catch (error) {
        // Rollback the transaction on error
        await client.query('ROLLBACK');
        console.error('Error applying migration:', error);
        throw error;
    } finally {
        client.release();
    }
}
```

4. `process-token-transfer.js`: This script manually processes a token transfer for a specific transaction:

```javascript
async function processTokenTransfer() {
    try {
        // Get the transaction receipt
        const receipt = await getTransactionReceipt();
        
        // Get the transaction details
        const tx = await getTransactionDetails();
        
        // Check if the receipt has logs
        if (!receipt.logs || receipt.logs.length === 0) {
            console.log('No logs found in the receipt');
            return;
        }
        
        // Check for ERC20 Transfer events
        const erc20TransferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        
        for (const log of receipt.logs) {
            if (log.topics[0] === erc20TransferTopic) {
                console.log('Found ERC20 Transfer event:');
                console.log(JSON.stringify(log, null, 2));
                
                // Extract transfer details
                const from = ethers.utils.getAddress('0x' + log.topics[1].substring(26));
                const to = ethers.utils.getAddress('0x' + log.topics[2].substring(26));
                const value = ethers.BigNumber.from(log.data).toString();
                
                console.log(`From: ${from}`);
                console.log(`To: ${to}`);
                console.log(`Value: ${value}`);
                
                // Create a token transfer object
                const tokenTransfer = {
                    transactionHash: TRANSACTION_HASH,
                    blockNumber: receipt.blockNumber,
                    tokenAddress: log.address,
                    fromAddress: from,
                    toAddress: to,
                    value,
                    tokenType: 'ERC20',
                    timestamp: tx.timestamp
                };
                
                // Insert the token transfer into the database
                console.log('Inserting token transfer into the database...');
                
                try {
                    const response = await axios.post(`${API_URL}/admin/token-transfers`, tokenTransfer);
                    console.log('Token transfer inserted successfully:');
                    console.log(JSON.stringify(response.data, null, 2));
                } catch (error) {
                    console.error('Error inserting token transfer:');
                    if (error.response) {
                        console.error(JSON.stringify(error.response.data, null, 2));
                    } else {
                        console.error(error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing token transfer:', error);
    }
}
```

This script tries to insert a token transfer using an admin endpoint (`/admin/token-transfers`), but when I ran it, it failed with:

```
Error inserting token transfer:
"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /admin/token-transfers</pre>\n</body>\n</html>\n"
```

This suggests that the admin endpoint doesn't exist or isn't accessible.

## Conclusion

Based on my analysis, the most likely issue is that the unique constraint for the `token_transfers` table hasn't been applied correctly, or there's an issue with the conflict resolution strategy in the `insertTokenTransfer` method. The fix scripts suggest that there was a change from using `ON CONFLICT ON CONSTRAINT idx_token_transfers_unique` to `ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))`, but it's not clear if this change was applied to the running indexer.

To fix the issue, I would suggest:

1. Check if the `011_add_token_transfers_unique_constraint.sql` migration has been applied to the database.
2. Apply the `fix-token-transfers.js` script to update the conflict resolution strategy in the `insertTokenTransfer` method.
3. Restart the indexer to apply the changes.
4. Monitor the logs to see if token transfers are being inserted into the database.

If these steps don't resolve the issue, I would suggest looking at the logs to see if there are any specific errors when inserting token transfers, and checking if the `getTokenTransfersFromReceipt` method is correctly detecting token transfers from transaction receipts.
