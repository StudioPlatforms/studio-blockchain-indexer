#!/usr/bin/env node

/**
 * Script to update token balances for a specific address
 * 
 * Usage: node update-token-balances.js <address>
 * 
 * Example: node update-token-balances.js 0x846C234adc6D8E74353c0c355b0c2B6a1e46634f
 */

const { blockchain } = require('../build/services/blockchain');
const { db } = require('../build/services/database');

async function updateTokenBalances(address) {
    try {
        console.log(`Updating token balances for ${address}...`);
        
        // Get known token addresses
        const knownTokenAddresses = await blockchain.getKnownTokenAddresses();
        console.log(`Found ${knownTokenAddresses.length} known token addresses`);
        
        // Get token balances directly from the blockchain
        const balances = await blockchain.getAddressTokenBalances(address, knownTokenAddresses);
        console.log(`Found ${balances.length} token balances for ${address} from blockchain`);
        
        // Update the database with the latest balances
        for (const balance of balances) {
            try {
                // Insert a token transfer to trigger the balance update
                await db.insertTokenTransfer({
                    transactionHash: `0x${Date.now().toString(16)}_${Math.random().toString(16).substring(2)}`,
                    blockNumber: 0,
                    tokenAddress: balance.tokenAddress,
                    fromAddress: '0x0000000000000000000000000000000000000000', // Zero address as placeholder
                    toAddress: address,
                    value: balance.balance,
                    tokenType: balance.tokenType,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                
                console.log(`Updated token balance for ${address} and token ${balance.tokenAddress}: ${balance.balance}`);
            } catch (error) {
                console.error(`Error updating token balance for ${address} and token ${balance.tokenAddress}:`, error);
            }
        }
        
        console.log(`Successfully updated token balances for ${address}`);
    } catch (error) {
        console.error(`Error updating token balances for ${address}:`, error);
    } finally {
        // Close the database connection
        await db.close();
        process.exit(0);
    }
}

// Get the address from the command line arguments
const address = process.argv[2];
if (!address) {
    console.error('Please provide an address as a command line argument');
    process.exit(1);
}

// Update token balances for the address
updateTokenBalances(address);
