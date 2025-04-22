-- Migration: 008_fix_token_balances_complete.sql
-- Description: Comprehensive fix for token balances calculation and retrieval

-- Ensure the token_balances table has all required columns
ALTER TABLE token_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE token_balances ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE;

-- Create or replace the function to update token balances
CREATE OR REPLACE FUNCTION update_token_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sender balance (decrease) if not a minting event
    IF NEW.from_address != '0x0000000000000000000000000000000000000000' THEN
        INSERT INTO token_balances (address, token_address, token_type, balance, token_id, updated_at)
        VALUES (
            NEW.from_address,
            NEW.token_address,
            NEW.token_type,
            '0',
            NEW.token_id,
            NOW()
        )
        ON CONFLICT (address, token_address, COALESCE(token_id, ''))
        DO UPDATE SET
            balance = (
                CASE
                    WHEN token_balances.balance::numeric - NEW.value::numeric < 0 THEN '0'
                    ELSE (token_balances.balance::numeric - NEW.value::numeric)::text
                END
            ),
            updated_at = NOW();
    END IF;

    -- Update receiver balance (increase) if not a burning event
    IF NEW.to_address != '0x0000000000000000000000000000000000000000' THEN
        INSERT INTO token_balances (address, token_address, token_type, balance, token_id, updated_at)
        VALUES (
            NEW.to_address,
            NEW.token_address,
            NEW.token_type,
            NEW.value,
            NEW.token_id,
            NOW()
        )
        ON CONFLICT (address, token_address, COALESCE(token_id, ''))
        DO UPDATE SET
            balance = (token_balances.balance::numeric + NEW.value::numeric)::text,
            updated_at = NOW();
    END IF;

    -- Update is_creator flag for minting events
    IF NEW.from_address = '0x0000000000000000000000000000000000000000' AND NEW.to_address != '0x0000000000000000000000000000000000000000' THEN
        UPDATE token_balances
        SET is_creator = TRUE, updated_at = NOW()
        WHERE address = NEW.to_address AND token_address = NEW.token_address;
        
        -- Try to update the contract record with the creator address
        UPDATE contracts 
        SET creator_address = NEW.to_address, updated_at = NOW()
        WHERE address = NEW.token_address AND creator_address = '0x0000000000000000000000000000000000000000';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS update_token_balances_trigger ON token_transfers;
CREATE TRIGGER update_token_balances_trigger
AFTER INSERT ON token_transfers
FOR EACH ROW
EXECUTE FUNCTION update_token_balances();

-- Ensure the unique constraint on token_balances is correct
DROP INDEX IF EXISTS idx_token_balances_unique;
CREATE UNIQUE INDEX idx_token_balances_unique ON token_balances (address, token_address, COALESCE(token_id, ''));

-- Recalculate token balances based on all transfers
-- This will fix any balances that were incorrectly calculated
WITH token_balance_changes AS (
    -- Outgoing transfers (negative balance change)
    SELECT 
        from_address as address,
        token_address,
        token_type,
        token_id,
        SUM(value::numeric) * -1 as balance_change
    FROM 
        token_transfers
    WHERE 
        from_address != '0x0000000000000000000000000000000000000000'
    GROUP BY 
        from_address, token_address, token_type, token_id
    
    UNION ALL
    
    -- Incoming transfers (positive balance change)
    SELECT 
        to_address as address,
        token_address,
        token_type,
        token_id,
        SUM(value::numeric) as balance_change
    FROM 
        token_transfers
    WHERE 
        to_address != '0x0000000000000000000000000000000000000000'
    GROUP BY 
        to_address, token_address, token_type, token_id
),
aggregated_balances AS (
    SELECT 
        address,
        token_address,
        token_type,
        token_id,
        SUM(balance_change) as balance
    FROM 
        token_balance_changes
    GROUP BY 
        address, token_address, token_type, token_id
)
INSERT INTO token_balances (address, token_address, token_type, balance, token_id, updated_at)
SELECT 
    address,
    token_address,
    token_type,
    CASE WHEN balance < 0 THEN '0' ELSE balance::text END,
    token_id,
    NOW()
FROM 
    aggregated_balances
ON CONFLICT (address, token_address, COALESCE(token_id, ''))
DO UPDATE SET
    balance = CASE WHEN EXCLUDED.balance::numeric < 0 THEN '0' ELSE EXCLUDED.balance::text END,
    updated_at = NOW();

-- Update the is_creator flag for addresses that have received tokens from the zero address
UPDATE token_balances tb
SET is_creator = TRUE
WHERE EXISTS (
    SELECT 1 FROM token_transfers tt
    WHERE tt.from_address = '0x0000000000000000000000000000000000000000'
    AND tt.to_address = tb.address
    AND tt.token_address = tb.token_address
);
