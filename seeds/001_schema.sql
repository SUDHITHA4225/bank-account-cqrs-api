CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    event_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    UNIQUE (aggregate_id, event_number)
);

CREATE INDEX IF NOT EXISTS idx_events_aggregate_id
ON events(aggregate_id);

-- SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id VARCHAR(255) UNIQUE NOT NULL,
    snapshot_data JSONB NOT NULL,
    last_event_number INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id
ON snapshots(aggregate_id);

-- ACCOUNT SUMMARIES PROJECTION
CREATE TABLE IF NOT EXISTS account_summaries (
    account_id VARCHAR(255) PRIMARY KEY,
    owner_name VARCHAR(255) NOT NULL,
    balance DECIMAL(19,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    version BIGINT NOT NULL
);

-- TRANSACTION HISTORY PROJECTION
CREATE TABLE IF NOT EXISTS transaction_history (
    transaction_id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    description TEXT,
    timestamp TIMESTAMPTZ NOT NULL
);
