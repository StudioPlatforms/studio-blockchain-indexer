#!/usr/bin/env node

/**
 * This script simulates a minting event for a token by inserting a token transfer
 * from the zero address to a specified address.
 * 
 * Usage: node simulate-mint-event.js <token_address> <to_address> <amount> <decimals>
 * 
 * Example: node simulate-mint-event.js 0xfccc20bf4f0829e121bc99ff2222456ad4465a1e 0x846c234adc6d8e74353c0c355b0c2b6a1e46634f 1000000 6
 */

const { Client } = require('pg');
const { ethers } = require('ethers');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('Usage: node simulate-mint-event.js <token_address> <to_address> <amount> <decimals>');
  process.exit(1);
}

const tokenAddress = args[0].toLowerCase();
const toAddress = args[1].toLowerCase();
const amount = args[2];
const decimals = parseInt(args[3]);

// Convert amount to raw value based on decimals
const rawAmount = ethers.utils.parseUnits(amount, decimals).toString();

// Database connection parameters
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'studio_indexer_new',
  user: process.env.DB_USER || 'new_user',
  password: process.env.DB_PASSWORD || 'new_strong_password'
};

async function simulateMintEvent() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('Connected to database');

    // Generate a fake transaction hash
    const transactionHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    
    // Get the latest block number
    const blockResult = await client.query('SELECT MAX(block_number) as max_block FROM blocks');
    const blockNumber = (blockResult.rows[0].max_block || 0) + 1;
    
    // Current timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Insert the mint transfer (from zero address to the specified address)
    const insertQuery = `
      INSERT INTO token_transfers (
        transaction_hash, block_number, token_address, from_address, to_address,
        value, token_type, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const insertResult = await client.query(insertQuery, [
      transactionHash,
      blockNumber,
      tokenAddress,
      '0x0000000000000000000000000000000000000000', // Zero address (minting)
      toAddress,
      rawAmount,
      'ERC20',
      new Date(timestamp * 1000)
    ]);
    
    console.log(`Inserted mint event with ID: ${insertResult.rows[0].id}`);
    console.log(`Transaction Hash: ${transactionHash}`);
    console.log(`Block Number: ${blockNumber}`);
    console.log(`Token Address: ${tokenAddress}`);
    console.log(`To Address: ${toAddress}`);
    console.log(`Amount: ${amount} (${rawAmount} raw)`);
    
    // Check if the token_balances was updated correctly
    const balanceQuery = `
      SELECT * FROM token_balances 
      WHERE address = $1 AND token_address = $2
    `;
    
    const balanceResult = await client.query(balanceQuery, [toAddress, tokenAddress]);
    
    if (balanceResult.rows.length > 0) {
      console.log('\nToken Balance Updated:');
      console.log(`Address: ${balanceResult.rows[0].address}`);
      console.log(`Token Address: ${balanceResult.rows[0].token_address}`);
      console.log(`Balance: ${balanceResult.rows[0].balance}`);
      console.log(`Is Creator: ${balanceResult.rows[0].is_creator || false}`);
    } else {
      console.log('\nWarning: Token balance not found after mint event');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

simulateMintEvent().catch(console.error);
