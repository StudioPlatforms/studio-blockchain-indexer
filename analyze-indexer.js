#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const INDEXER_DIR = '/root/mainnet-indexer';

function analyzeDirectory(dir, depth = 0) {
    const indent = '  '.repeat(depth);
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
            console.log(`${indent}Directory: ${file}`);
            
            // Skip node_modules and dist directories
            if (file !== 'node_modules' && file !== 'dist') {
                analyzeDirectory(filePath, depth + 1);
            } else {
                console.log(`${indent}  (skipped)`);
            }
        } else {
            // Only analyze .ts, .js, .md, and .json files
            if (['.ts', '.js', '.md', '.json'].includes(path.extname(file))) {
                console.log(`${indent}File: ${file}`);
                
                // For .md files, print the first few lines
                if (path.extname(file) === '.md') {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split('\n').slice(0, 5);
                    console.log(`${indent}  First 5 lines:`);
                    for (const line of lines) {
                        console.log(`${indent}    ${line}`);
                    }
                }
                
                // For .ts and .js files, look for specific keywords
                if (['.ts', '.js'].includes(path.extname(file))) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Look for specific keywords
                    const keywords = ['bytecode', 'verify', 'contract', 'blockchain'];
                    const matches = {};
                    
                    for (const keyword of keywords) {
                        const regex = new RegExp(keyword, 'gi');
                        const count = (content.match(regex) || []).length;
                        if (count > 0) {
                            matches[keyword] = count;
                        }
                    }
                    
                    if (Object.keys(matches).length > 0) {
                        console.log(`${indent}  Keywords found:`);
                        for (const [keyword, count] of Object.entries(matches)) {
                            console.log(`${indent}    ${keyword}: ${count} occurrences`);
                        }
                    }
                }
            }
        }
    }
}

function main() {
    console.log(`Analyzing mainnet-indexer directory: ${INDEXER_DIR}`);
    analyzeDirectory(INDEXER_DIR);
}

main();
