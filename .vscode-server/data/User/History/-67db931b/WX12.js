#!/usr/bin/env node

/**
 * This script imports token transfers from the token-transfers-specific.json file
 * into the database using the insertTokenTransfer method.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'studio_indexer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
};

// Create a database connection pool
const pool = new Pool(DB_CONFIG);

// Function to insert a token transfer into the database
async function insertTokenTransfer(transfer) {
    const client = await pool.connect();
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

        await client.query('COMMIT');
        console.log(`Successfully inserted token transfer: ${transfer.fromAddress} -> ${transfer.toAddress}, ${transfer.value} tokens of ${transfer.tokenAddress}`);
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error inserting token transfer:', error);
        return false;
    } finally {
        client.release();
    }
}

// Function to import token transfers from a file
async function importTokenTransfers(filePath) {
    try {
        // Read the file
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse the token transfers
        const transfers = content.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (error) {
                    console.error('Error parsing line:', error);
                    return null;
                }
            })
            .filter(transfer => transfer !== null);
        
        console.log(`Found ${transfers.length} token transfers in ${filePath}`);
        
        // Insert each token transfer into the database
        let successCount = 0;
        let failureCount = 0;
        
        for (const transfer of transfers) {
            const success = await insertTokenTransfer(transfer);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
        }
        
        console.log(`Successfully inserted ${successCount} token transfers`);
        console.log(`Failed to insert ${failureCount} token transfers`);
    } catch (error) {
        console.error('Error importing token transfers:', error);
    } finally {
        // Close the database connection pool
        await pool.end();
    }
}

// Main function
async function main() {
    try {
        // Get the file path from the command line arguments
        const filePath = process.argv[2] || '/root/token-transfers-specific.json';
        
        // Import token transfers
        await importTokenTransfers(filePath);
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Run the main function
main().catch(console.error);
