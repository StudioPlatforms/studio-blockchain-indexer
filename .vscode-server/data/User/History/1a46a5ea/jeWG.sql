-- Event logs schema for the blockchain indexer

-- Create event_logs table
CREATE TABLE IF NOT EXISTS event_logs (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER NOT NULL,
    address VARCHAR(42) NOT NULL,
    topic0 VARCHAR(66),
    topic1 VARCHAR(66),
    topic2 VARCHAR(66),
    topic3 VARCHAR(66),
    data TEXT,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_hash, log_index)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_event_logs_transaction_hash ON event_logs(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_event_logs_block_number ON event_logs(block_number);
CREATE INDEX IF NOT EXISTS idx_event_logs_address ON event_logs(address);
CREATE INDEX IF NOT EXISTS idx_event_logs_topic0 ON event_logs(topic0);
CREATE INDEX IF NOT EXISTS idx_event_logs_topic1 ON event_logs(topic1);
CREATE INDEX IF NOT EXISTS idx_event_logs_topic2 ON event_logs(topic2);
CREATE INDEX IF NOT EXISTS idx_event_logs_topic3 ON event_logs(topic3);
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp);

-- Create function to update event logs count for contracts
CREATE OR REPLACE FUNCTION update_contract_event_logs_count() RETURNS TRIGGER AS $$
BEGIN
    -- Update contract event logs count if it exists
    UPDATE contracts SET 
        event_logs_count = event_logs_count + 1
    WHERE address = NEW.address;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contract event logs count
CREATE TRIGGER update_contract_event_logs_count_trigger
    AFTER INSERT ON event_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_contract_event_logs_count();
