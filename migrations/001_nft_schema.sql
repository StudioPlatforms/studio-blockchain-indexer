-- Create blocks table
CREATE TABLE IF NOT EXISTS blocks (
    number BIGINT PRIMARY KEY,
    hash VARCHAR(66) NOT NULL UNIQUE,
    parent_hash VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    transactions_count INTEGER NOT NULL DEFAULT 0,
    gas_used NUMERIC(78) NOT NULL DEFAULT 0,
    gas_limit NUMERIC(78) NOT NULL DEFAULT 0,
    base_fee_per_gas NUMERIC(78),
    nonce VARCHAR(66),
    difficulty NUMERIC(78),
    miner VARCHAR(42),
    extra_data TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    hash VARCHAR(66) PRIMARY KEY,
    block_number BIGINT NOT NULL REFERENCES blocks(number),
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value NUMERIC(78) NOT NULL DEFAULT 0,
    gas_price NUMERIC(78) NOT NULL DEFAULT 0,
    gas_limit NUMERIC(78) NOT NULL DEFAULT 0,
    gas_used NUMERIC(78) NOT NULL DEFAULT 0,
    input_data TEXT,
    status BOOLEAN,
    transaction_index INTEGER NOT NULL,
    timestamp TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nonce BIGINT NOT NULL
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    address VARCHAR(42) PRIMARY KEY,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create token_transfers table for ERC20 and ERC721 transfers
CREATE TABLE IF NOT EXISTS token_transfers (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) NOT NULL REFERENCES transactions(hash),
    block_number BIGINT NOT NULL REFERENCES blocks(number),
    token_address VARCHAR(42) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value NUMERIC(78) NOT NULL,
    token_type VARCHAR(10) NOT NULL, -- 'ERC20' or 'ERC721' or 'ERC1155'
    token_id VARCHAR(78), -- For ERC-721 and ERC-1155 tokens
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_hash, token_address, from_address, to_address, token_id)
);

-- Create nft_tokens table for NFT information
CREATE TABLE IF NOT EXISTS nft_tokens (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    metadata_uri TEXT,
    name TEXT,
    description TEXT,
    image_url TEXT,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_address, token_id)
);

-- Create nft_metadata table for cached NFT metadata
CREATE TABLE IF NOT EXISTS nft_metadata (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    metadata JSONB NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_address, token_id)
);

-- Create nft_collections table for NFT collection information
CREATE TABLE IF NOT EXISTS nft_collections (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL UNIQUE,
    name TEXT,
    symbol TEXT,
    total_supply BIGINT,
    owner_count INTEGER DEFAULT 0,
    floor_price NUMERIC(78),
    volume_traded NUMERIC(78),
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_accounts_first_seen ON accounts(first_seen);
CREATE INDEX IF NOT EXISTS idx_accounts_last_seen ON accounts(last_seen);

-- Create indexes for token_transfers
CREATE INDEX IF NOT EXISTS idx_token_transfers_transaction_hash ON token_transfers(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_token_transfers_block_number ON token_transfers(block_number);
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_address ON token_transfers(token_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_from_address ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_to_address ON token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_id ON token_transfers(token_id);
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_type ON token_transfers(token_type);

-- Create indexes for nft_tokens
CREATE INDEX IF NOT EXISTS idx_nft_tokens_token_address ON nft_tokens(token_address);
CREATE INDEX IF NOT EXISTS idx_nft_tokens_token_id ON nft_tokens(token_id);
CREATE INDEX IF NOT EXISTS idx_nft_tokens_owner_address ON nft_tokens(owner_address);

-- Create indexes for nft_metadata
CREATE INDEX IF NOT EXISTS idx_nft_metadata_token_address ON nft_metadata(token_address);
CREATE INDEX IF NOT EXISTS idx_nft_metadata_token_id ON nft_metadata(token_id);

-- Create function to update account statistics
CREATE OR REPLACE FUNCTION update_account_stats() RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert from_address account
    INSERT INTO accounts (address, first_seen, last_seen, transaction_count)
    VALUES (NEW.from_address, NEW.created_at, NEW.created_at, 1)
    ON CONFLICT (address) DO UPDATE SET
        last_seen = GREATEST(accounts.last_seen, NEW.created_at),
        transaction_count = accounts.transaction_count + 1;

    -- Update or insert to_address account if not null
    IF NEW.to_address IS NOT NULL THEN
        INSERT INTO accounts (address, first_seen, last_seen, transaction_count)
        VALUES (NEW.to_address, NEW.created_at, NEW.created_at, 1)
        ON CONFLICT (address) DO UPDATE SET
            last_seen = GREATEST(accounts.last_seen, NEW.created_at),
            transaction_count = accounts.transaction_count + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for account statistics
CREATE TRIGGER update_account_stats_trigger
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_account_stats();

-- Create function to update NFT ownership on token transfer
CREATE OR REPLACE FUNCTION update_nft_ownership() RETURNS TRIGGER AS $$
BEGIN
    -- Only process ERC721 and ERC1155 transfers
    IF NEW.token_type IN ('ERC721', 'ERC1155') AND NEW.token_id IS NOT NULL THEN
        -- Update ownership record
        INSERT INTO nft_tokens (token_address, token_id, owner_address)
        VALUES (NEW.token_address, NEW.token_id, NEW.to_address)
        ON CONFLICT (token_address, token_id) DO UPDATE SET
            owner_address = NEW.to_address,
            last_updated = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for NFT ownership updates
CREATE TRIGGER update_nft_ownership_trigger
    AFTER INSERT ON token_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_nft_ownership();
