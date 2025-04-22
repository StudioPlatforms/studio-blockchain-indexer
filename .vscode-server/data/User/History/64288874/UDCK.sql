-- Migration: 003_token_balances.sql
-- Description: Create tables for storing token balances

-- Create token_balances table
CREATE TABLE IF NOT EXISTS token_balances (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    token_type VARCHAR(10) NOT NULL,
    balance VARCHAR(78) NOT NULL,
    token_id VARCHAR(78),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(address, token_address, token_id)
);

-- Create index on address
CREATE INDEX IF NOT EXISTS idx_token_balances_address ON token_balances(address);

-- Create index on token_address
CREATE INDEX IF NOT EXISTS idx_token_balances_token_address ON token_balances(token_address);

-- Create index on token_type
CREATE INDEX IF NOT EXISTS idx_token_balances_token_type ON token_balances(token_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_token_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_token_balances_updated_at
BEFORE UPDATE ON token_balances
FOR EACH ROW
EXECUTE FUNCTION update_token_balances_updated_at();
