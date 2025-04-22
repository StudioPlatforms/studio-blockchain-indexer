#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const INDEXER_DIR = '/root/mainnet-indexer';

function findDatabaseSchema() {
    console.log('Searching for database schema in the mainnet-indexer...');
    
    // Look for migration files
    const migrationsDir = path.join(INDEXER_DIR, 'migrations');
    if (fs.existsSync(migrationsDir)) {
        console.log('Found migrations directory:', migrationsDir);
        
        // Get all migration files
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        
        console.log(`Found ${migrationFiles.length} migration files:`);
        
        // Analyze each migration file
        for (const file of migrationFiles) {
            console.log(`\nAnalyzing migration file: ${file}`);
            
            const filePath = path.join(migrationsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Look for CREATE TABLE statements
            const createTableRegex = /CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*?)\);/gi;
            let match;
            
            while ((match = createTableRegex.exec(content)) !== null) {
                const tableName = match[1];
                const tableDefinition = match[2];
                
                console.log(`\nTable: ${tableName}`);
                
                // Parse column definitions
                const columnRegex = /(\w+)\s+([^,]+)/g;
                let columnMatch;
                
                while ((columnMatch = columnRegex.exec(tableDefinition)) !== null) {
                    const columnName = columnMatch[1];
                    const columnType = columnMatch[2].trim();
                    
                    console.log(`  Column: ${columnName} (${columnType})`);
                }
            }
            
            // Look for ALTER TABLE statements
            const alterTableRegex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+(\w+)\s+([^;]+);/gi;
            
            while ((match = alterTableRegex.exec(content)) !== null) {
                const tableName = match[1];
                const columnName = match[2];
                const columnType = match[3].trim();
                
                console.log(`\nAlter Table: ${tableName}`);
                console.log(`  Add Column: ${columnName} (${columnType})`);
            }
        }
    } else {
        console.log('Migrations directory not found.');
    }
    
    // Look for database-related code in the src directory
    const srcDir = path.join(INDEXER_DIR, 'src');
    if (fs.existsSync(srcDir)) {
        console.log('\nSearching for database-related code in the src directory...');
        
        // Look for database-related files
        const databaseDir = path.join(srcDir, 'services', 'database');
        if (fs.existsSync(databaseDir)) {
            console.log('Found database directory:', databaseDir);
            
            // Get all database-related files
            const databaseFiles = fs.readdirSync(databaseDir)
                .filter(file => file.endsWith('.ts'))
                .sort();
            
            console.log(`Found ${databaseFiles.length} database-related files:`);
            
            // Analyze each database-related file
            for (const file of databaseFiles) {
                console.log(`\nAnalyzing database file: ${file}`);
                
                const filePath = path.join(databaseDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Look for SQL queries
                const sqlQueryRegex = /`([^`]*CREATE\s+TABLE[^`]*)`/gi;
                let match;
                
                while ((match = sqlQueryRegex.exec(content)) !== null) {
                    const sqlQuery = match[1];
                    console.log(`\nSQL Query: ${sqlQuery}`);
                }
                
                // Look for table names
                const tableNameRegex = /table(?:Name)?\s*=\s*['"](\w+)['"]/gi;
                
                while ((match = tableNameRegex.exec(content)) !== null) {
                    const tableName = match[1];
                    console.log(`Table Name: ${tableName}`);
                }
            }
        } else {
            console.log('Database directory not found in src.');
        }
    } else {
        console.log('Src directory not found.');
    }
}

function main() {
    console.log('Analyzing database schema of the mainnet-indexer...');
    findDatabaseSchema();
}

main();
