-- Add verified column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Add source_code column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_code TEXT;

-- Add abi column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS abi JSONB;

-- Add compiler_version column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS compiler_version TEXT;

-- Add optimization_used column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS optimization_used BOOLEAN;

-- Add runs column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS runs INTEGER;

-- Add constructor_arguments column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS constructor_arguments TEXT;

-- Add libraries column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS libraries JSONB;

-- Add verified_at column to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- Create index on verified column
CREATE INDEX IF NOT EXISTS idx_contracts_verified ON contracts(verified);
