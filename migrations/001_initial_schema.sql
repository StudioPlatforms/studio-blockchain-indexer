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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_accounts_first_seen ON accounts(first_seen);
CREATE INDEX IF NOT EXISTS idx_accounts_last_seen ON accounts(last_seen);

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
