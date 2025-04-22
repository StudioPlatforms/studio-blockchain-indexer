-- Migration: 005_contracts.sql
-- Description: Create tables for storing contract information

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    address VARCHAR(42) PRIMARY KEY,
    creator_address VARCHAR(42) NOT NULL,
    owner_address VARCHAR(42),
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    contract_type VARCHAR(10),
    name TEXT,
    symbol VARCHAR(20),
    decimals INTEGER,
    total_supply VARCHAR(78),
    balance VARCHAR(78),
    bytecode TEXT,
    holder_count INTEGER,
    transfer_count INTEGER,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on creator_address
CREATE INDEX IF NOT EXISTS idx_contracts_creator_address ON contracts(creator_address);

-- Create index on contract_type
CREATE INDEX IF NOT EXISTS idx_contracts_contract_type ON contracts(contract_type);

-- Create index on block_number
CREATE INDEX IF NOT EXISTS idx_contracts_block_number ON contracts(block_number);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON contracts
FOR EACH ROW
EXECUTE FUNCTION update_contracts_updated_at();
