-- Migration: 010_add_evm_version.sql
-- Description: Add EVM version support to contract verification

-- Add evm_version column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS evm_version TEXT;

-- Create index on evm_version column
CREATE INDEX IF NOT EXISTS idx_contracts_evm_version ON contracts(evm_version);

-- Update existing verified contracts to use 'cancun' as default EVM version
UPDATE contracts SET evm_version = 'cancun' WHERE verified = TRUE AND evm_version IS NULL;
