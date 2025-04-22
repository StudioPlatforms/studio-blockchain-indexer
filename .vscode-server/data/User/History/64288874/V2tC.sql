-- Token balances schema for the blockchain indexer

-- Add balance column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(78) NOT NULL DEFAULT 0;

-- Create token_balances table
CREATE TABLE IF NOT EXISTS token_balances (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    balance NUMERIC(78) NOT NULL DEFAULT 0,
    token_type VARCHAR(10) NOT NULL, -- 'ERC20', 'ERC721', or 'ERC1155'
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address, token_address)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_balances_address ON token_balances(address);
CREATE INDEX IF NOT EXISTS idx_token_balances_token_address ON token_balances(token_address);
CREATE INDEX IF NOT EXISTS idx_token_balances_balance ON token_balances(balance DESC);

-- Create function to update token balances on token transfer
CREATE OR REPLACE FUNCTION update_token_balances() RETURNS TRIGGER AS $$
BEGIN
    -- Skip zero value transfers
    IF NEW.value = '0' THEN
        RETURN NEW;
    END IF;

    -- Update sender balance (if not zero address)
    IF NEW.from_address != '0x0000000000000000000000000000000000000000' THEN
        INSERT INTO token_balances (address, token_address, balance, token_type, last_updated)
        VALUES (NEW.from_address, NEW.token_address, 0, NEW.token_type, CURRENT_TIMESTAMP)
        ON CONFLICT (address, token_address) DO UPDATE SET
            balance = GREATEST(0, token_balances.balance - NEW.value::numeric),
            token_type = NEW.token_type,
            last_updated = CURRENT_TIMESTAMP;
    END IF;

    -- Update receiver balance
    INSERT INTO token_balances (address, token_address, balance, token_type, last_updated)
    VALUES (NEW.to_address, NEW.token_address, NEW.value::numeric, NEW.token_type, CURRENT_TIMESTAMP)
    ON CONFLICT (address, token_address) DO UPDATE SET
        balance = token_balances.balance + NEW.value::numeric,
        token_type = NEW.token_type,
        last_updated = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for token balance updates
CREATE TRIGGER update_token_balances_trigger
    AFTER INSERT ON token_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_token_balances();

-- Create function to update native token balances on transaction
CREATE OR REPLACE FUNCTION update_native_balances() RETURNS TRIGGER AS $$
BEGIN
    -- Skip zero value transfers
    IF NEW.value = 0 THEN
        RETURN NEW;
    END IF;

    -- Update sender balance
    UPDATE accounts SET 
        balance = GREATEST(0, balance - NEW.value)
    WHERE address = NEW.from_address;

    -- Update receiver balance (if not null)
    IF NEW.to_address IS NOT NULL THEN
        INSERT INTO accounts (address, first_seen, last_seen, transaction_count, balance)
        VALUES (NEW.to_address, NEW.created_at, NEW.created_at, 1, NEW.value)
        ON CONFLICT (address) DO UPDATE SET
            balance = accounts.balance + NEW.value,
            last_seen = GREATEST(accounts.last_seen, NEW.created_at),
            transaction_count = accounts.transaction_count + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for native balance updates
CREATE TRIGGER update_native_balances_trigger
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_native_balances();

-- Backfill token balances from existing transfers
DO $$
DECLARE
    transfer_record RECORD;
BEGIN
    -- Clear existing token balances to avoid duplicates
    TRUNCATE TABLE token_balances;

    -- Process all token transfers to calculate current balances
    FOR transfer_record IN 
        SELECT * FROM token_transfers ORDER BY block_number ASC, id ASC
    LOOP
        -- Update sender balance (if not zero address)
        IF transfer_record.from_address != '0x0000000000000000000000000000000000000000' THEN
            INSERT INTO token_balances (address, token_address, balance, token_type, last_updated)
            VALUES (
                transfer_record.from_address, 
                transfer_record.token_address, 
                0, 
                transfer_record.token_type, 
                transfer_record.timestamp
            )
            ON CONFLICT (address, token_address) DO UPDATE SET
                balance = GREATEST(0, token_balances.balance - transfer_record.value::numeric),
                token_type = transfer_record.token_type,
                last_updated = 
                    CASE 
                        WHEN transfer_record.timestamp > token_balances.last_updated 
                        THEN transfer_record.timestamp 
                        ELSE token_balances.last_updated 
                    END;
        END IF;

        -- Update receiver balance
        INSERT INTO token_balances (address, token_address, balance, token_type, last_updated)
        VALUES (
            transfer_record.to_address, 
            transfer_record.token_address, 
            transfer_record.value::numeric, 
            transfer_record.token_type, 
            transfer_record.timestamp
        )
        ON CONFLICT (address, token_address) DO UPDATE SET
            balance = token_balances.balance + transfer_record.value::numeric,
            token_type = transfer_record.token_type,
            last_updated = 
                CASE 
                    WHEN transfer_record.timestamp > token_balances.last_updated 
                    THEN transfer_record.timestamp 
                    ELSE token_balances.last_updated 
                END;
    END LOOP;

    -- Backfill native token balances from transactions
    UPDATE accounts SET balance = 0;
    
    FOR transfer_record IN 
        SELECT * FROM transactions ORDER BY block_number ASC, transaction_index ASC
    LOOP
        -- Update sender balance
        UPDATE accounts SET 
            balance = GREATEST(0, balance - transfer_record.value)
        WHERE address = transfer_record.from_address;

        -- Update receiver balance (if not null)
        IF transfer_record.to_address IS NOT NULL THEN
            UPDATE accounts SET 
                balance = balance + transfer_record.value
            WHERE address = transfer_record.to_address;
        END IF;
    END LOOP;
END $$;
