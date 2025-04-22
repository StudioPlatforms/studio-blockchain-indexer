# Studio Blockchain Mainnet Indexer Database Schema

This document provides a summary of the database schema used by the Studio Blockchain Mainnet Indexer, with a focus on contract verification.

## Overview

The mainnet-indexer uses a PostgreSQL database to store blockchain data, including blocks, transactions, contracts, tokens, and NFTs. The database schema is defined in migration files located in the `/root/mainnet-indexer/migrations` directory.

## Database Tables

### Blocks Table

The `blocks` table stores information about blocks in the blockchain:

```sql
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
```

### Transactions Table

The `transactions` table stores information about transactions in the blockchain:

```sql
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
```

### Accounts Table

The `accounts` table stores information about accounts in the blockchain:

```sql
CREATE TABLE IF NOT EXISTS accounts (
    address VARCHAR(42) PRIMARY KEY,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Contracts Table

The `contracts` table stores information about contracts in the blockchain:

```sql
CREATE TABLE IF NOT EXISTS contracts (
    address VARCHAR(42) PRIMARY KEY,
    creator_address VARCHAR(42) NOT NULL,
    owner_address VARCHAR(42),
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    contract_type VARCHAR(10),
    name TEXT,
    symbol VARCHAR(20),
    decimals INTEGER,
    total_supply VARCHAR(78),
    balance VARCHAR(78),
    bytecode TEXT,
    holder_count INTEGER,
    transfer_count INTEGER,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    source_code TEXT,
    abi JSONB,
    compiler_version TEXT,
    optimization_used BOOLEAN,
    runs INTEGER,
    constructor_arguments TEXT,
    libraries JSONB,
    verified_at TIMESTAMP,
    evm_version TEXT
);
```

## Contract Verification

The contract verification data is stored in the `contracts` table. The following columns are used for contract verification:

- `verified`: A boolean indicating whether the contract is verified.
- `source_code`: The source code of the contract.
- `abi`: The ABI of the contract.
- `compiler_version`: The compiler version used to compile the contract.
- `optimization_used`: A boolean indicating whether optimization was used when compiling the contract.
- `runs`: The number of optimization runs.
- `constructor_arguments`: The constructor arguments used to deploy the contract.
- `libraries`: The libraries used by the contract.
- `verified_at`: The timestamp when the contract was verified.
- `evm_version`: The EVM version used for compilation.

## Contract Verification Process

The contract verification process works as follows:

1. The user submits a verification request with the contract address, source code, compiler version, and other compilation settings.
2. The system checks if the address is a valid contract on the blockchain.
3. The system validates the constructor arguments.
4. The system compiles the source code with the specified settings.
5. The system compares the compiled bytecode with the on-chain bytecode.
6. If the bytecodes match, the contract is marked as verified, and the source code, ABI, and compilation settings are stored in the database.

## Database Operations

The `ContractsDatabase` class in `/root/mainnet-indexer/src/services/database/contracts.ts` provides methods for interacting with the `contracts` table:

- `storeContract`: Store a contract in the database.
- `getContract`: Get a contract from the database.
- `getContractsByCreator`: Get contracts created by an address.
- `getTokenContracts`: Get token contracts.
- `updateContractVerification`: Update contract verification status and data.
- `getContractVerification`: Get contract verification data.
- `updateContractTokenStatus`: Update contract token status.
- `countContracts`: Count the number of contracts.
- `countTokenContracts`: Count the number of token contracts.

## Conclusion

The Studio Blockchain Mainnet Indexer uses a PostgreSQL database to store blockchain data, including contract verification data. The database schema is defined in migration files, and the `ContractsDatabase` class provides methods for interacting with the `contracts` table.
