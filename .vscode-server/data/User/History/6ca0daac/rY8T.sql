-- Contracts schema for the blockchain indexer

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    address VARCHAR(42) PRIMARY KEY,
    creator_address VARCHAR(42) NOT NULL,
    creation_tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    bytecode TEXT NOT NULL,
    is_token BOOLEAN,
    token_type VARCHAR(10),
    verified BOOLEAN DEFAULT FALSE,
    event_logs_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contracts_creator_address ON contracts(creator_address);
CREATE INDEX IF NOT EXISTS idx_contracts_creation_tx_hash ON contracts(creation_tx_hash);
CREATE INDEX IF NOT EXISTS idx_contracts_block_number ON contracts(block_number);
CREATE INDEX IF NOT EXISTS idx_contracts_is_token ON contracts(is_token);
CREATE INDEX IF NOT EXISTS idx_contracts_token_type ON contracts(token_type);
CREATE INDEX IF NOT EXISTS idx_contracts_timestamp ON contracts(timestamp);

-- Create token_metadata table
CREATE TABLE IF NOT EXISTS token_metadata (
    token_address VARCHAR(42) PRIMARY KEY,
    name TEXT,
    symbol TEXT,
    decimals INTEGER,
    total_supply NUMERIC(78),
    token_type VARCHAR(10) NOT NULL,
    holder_count INTEGER DEFAULT 0,
    transfer_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_metadata_name ON token_metadata(name);
CREATE INDEX IF NOT EXISTS idx_token_metadata_symbol ON token_metadata(symbol);
CREATE INDEX IF NOT EXISTS idx_token_metadata_token_type ON token_metadata(token_type);
CREATE INDEX IF NOT EXISTS idx_token_metadata_holder_count ON token_metadata(holder_count);
CREATE INDEX IF NOT EXISTS idx_token_metadata_transfer_count ON token_metadata(transfer_count);

-- Create function to update token metadata when a contract is verified as a token
CREATE OR REPLACE FUNCTION update_token_metadata_on_contract_update() RETURNS TRIGGER AS $$
BEGIN
    -- If the contract is now identified as a token
    IF NEW.is_token = TRUE AND (OLD.is_token IS NULL OR OLD.is_token = FALSE) THEN
        -- Insert a new record in token_metadata
        INSERT INTO token_metadata (
            token_address,
            token_type,
            created_at
        ) VALUES (
            NEW.address,
            NEW.token_type,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (token_address) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for token metadata updates
CREATE TRIGGER update_token_metadata_trigger
    AFTER UPDATE ON contracts
    FOR EACH ROW
    WHEN (NEW.is_token IS DISTINCT FROM OLD.is_token)
    EXECUTE FUNCTION update_token_metadata_on_contract_update();
