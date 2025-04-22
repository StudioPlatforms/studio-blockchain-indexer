#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database configuration from environment variables or use defaults
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'studio_indexer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
};

console.log('Using database configuration:');
console.log(JSON.stringify(dbConfig, null, 2));

// Create a new pool
const pool = new Pool(dbConfig);

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

async function main() {
    try {
        // Create migrations table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                name VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL
            )
        `);
        
        // Apply the migration
        await applyMigration();
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
