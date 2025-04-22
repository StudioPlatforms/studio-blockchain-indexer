-- Migration: 006_token_balances_trigger.sql
-- Description: Create trigger to update token_balances when token_transfers are inserted

-- Create function to update token balances when a token transfer is inserted
CREATE OR REPLACE FUNCTION update_token_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sender balance (decrease)
    IF NEW.from_address != '0x0000000000000000000000000000000000000000' THEN
        INSERT INTO token_balances (address, token_address, token_type, balance, token_id)
        VALUES (
            NEW.from_address,
            NEW.token_address,
            NEW.token_type,
            '0',
            NEW.token_id
        )
        ON CONFLICT (address, token_address, COALESCE(token_id, ''))
        DO UPDATE SET
            balance = (
                CASE
                    WHEN token_balances.balance::numeric - NEW.value::numeric < 0 THEN '0'
                    ELSE (token_balances.balance::numeric - NEW.value::numeric)::text
                END
            );
    END IF;

    -- Update receiver balance (increase)
    IF NEW.to_address != '0x0000000000000000000000000000000000000000' THEN
        INSERT INTO token_balances (address, token_address, token_type, balance, token_id)
        VALUES (
            NEW.to_address,
            NEW.token_address,
            NEW.token_type,
            NEW.value,
            NEW.token_id
        )
        ON CONFLICT (address, token_address, COALESCE(token_id, ''))
        DO UPDATE SET
            balance = (token_balances.balance::numeric + NEW.value::numeric)::text;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update token balances when a token transfer is inserted
DROP TRIGGER IF EXISTS update_token_balances_trigger ON token_transfers;
CREATE TRIGGER update_token_balances_trigger
AFTER INSERT ON token_transfers
FOR EACH ROW
EXECUTE FUNCTION update_token_balances();

-- Fix the unique constraint on token_balances to handle NULL token_id values
ALTER TABLE token_balances DROP CONSTRAINT IF EXISTS token_balances_address_token_address_token_id_key;
ALTER TABLE token_balances ADD CONSTRAINT token_balances_address_token_address_token_id_key UNIQUE (address, token_address, COALESCE(token_id, ''));

-- Populate token_balances table with existing token transfers
INSERT INTO token_balances (address, token_address, token_type, balance, token_id)
SELECT 
    address,
    token_address,
    token_type,
    balance,
    token_id
FROM (
    SELECT 
        from_address as address,
        token_address,
        token_type,
        SUM(value::numeric) * -1 as balance,
        token_id
    FROM 
        token_transfers
    WHERE 
        from_address != '0x0000000000000000000000000000000000000000'
    GROUP BY 
        from_address, token_address, token_type, token_id
    
    UNION ALL
    
    SELECT 
        to_address as address,
        token_address,
        token_type,
        SUM(value::numeric) as balance,
        token_id
    FROM 
        token_transfers
    WHERE 
        to_address != '0x0000000000000000000000000000000000000000'
    GROUP BY 
        to_address, token_address, token_type, token_id
) as balances
GROUP BY 
    address, token_address, token_type, token_id
HAVING 
    SUM(balance) > 0
ON CONFLICT (address, token_address, COALESCE(token_id, ''))
DO UPDATE SET
    balance = (token_balances.balance::numeric + EXCLUDED.balance::numeric)::text;
