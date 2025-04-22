-- Migration: 012_multi_file_contracts.sql
-- Description: Add support for multi-file contract verification

-- Add is_multi_file column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS is_multi_file BOOLEAN DEFAULT FALSE;

-- Add main_file column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS main_file TEXT;

-- Add source_files column to store all source files for multi-file contracts
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_files JSONB;

-- Add verification_metadata for additional verification info
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS verification_metadata JSONB;

-- Create index on is_multi_file column
CREATE INDEX IF NOT EXISTS idx_contracts_is_multi_file ON contracts(is_multi_file);

-- Update existing verified contracts with JSON source code
-- This will set is_multi_file to true for contracts that have JSON source code
UPDATE contracts 
SET 
    is_multi_file = TRUE,
    source_files = source_code::jsonb
WHERE 
    verified = TRUE 
    AND source_code IS NOT NULL 
    AND source_code LIKE '{%}' 
    AND is_multi_file IS NULL;
