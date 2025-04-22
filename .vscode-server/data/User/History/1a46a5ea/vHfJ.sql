-- Migration: 004_event_logs.sql
-- Description: Create tables for storing event logs

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
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(transaction_hash, log_index)
);

-- Create index on transaction_hash
CREATE INDEX IF NOT EXISTS idx_event_logs_transaction_hash ON event_logs(transaction_hash);

-- Create index on block_number
CREATE INDEX IF NOT EXISTS idx_event_logs_block_number ON event_logs(block_number);

-- Create index on address
CREATE INDEX IF NOT EXISTS idx_event_logs_address ON event_logs(address);

-- Create index on topic0 (event signature)
CREATE INDEX IF NOT EXISTS idx_event_logs_topic0 ON event_logs(topic0);

-- Create index on topic1 (often an address)
CREATE INDEX IF NOT EXISTS idx_event_logs_topic1 ON event_logs(topic1);

-- Create index on topic2 (often an address)
CREATE INDEX IF NOT EXISTS idx_event_logs_topic2 ON event_logs(topic2);

-- Create index on timestamp
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp);
