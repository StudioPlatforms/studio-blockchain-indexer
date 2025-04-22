#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'studio_indexer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
};

// Create a new pool
const pool = new Pool(dbConfig);

async function applyMigration(migrationFile) {
    const client = await pool.connect();
    try {
        console.log(`Applying migration: ${migrationFile}`);
        
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Start a transaction
        await client.query('BEGIN');
        
        // Execute the migration
        await client.query(sql);
        
        // Record the migration in the migrations table
        await client.query(
            `INSERT INTO migrations (name, applied_at) VALUES ($1, NOW())
            ON CONFLICT (name) DO UPDATE SET applied_at = NOW()`,
            [migrationFile]
        );
        
        // Commit the transaction
        await client.query('COMMIT');
        
        console.log(`Migration ${migrationFile} applied successfully`);
    } catch (error) {
        // Rollback the transaction on error
        await client.query('ROLLBACK');
        console.error(`Error applying migration ${migrationFile}:`, error);
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
        
        // Get the migration file from command line arguments
        const migrationFile = process.argv[2];
        if (!migrationFile) {
            console.error('Please provide a migration file name');
            process.exit(1);
        }
        
        // Apply the migration
        await applyMigration(migrationFile);
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
