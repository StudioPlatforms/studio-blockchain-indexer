-- Migration: 011_add_token_transfers_unique_constraint.sql
-- Description: Add a unique constraint to the token_transfers table

-- Add a unique constraint to the token_transfers table
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_transfers_unique ON token_transfers(transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''));
