# Studio Blockchain Explorer Indexer Analysis

## Overview

The Studio Blockchain Explorer Indexer is designed to scan the blockchain for blocks, transactions, and events, and store them in a PostgreSQL database. It provides an API for accessing this data, including endpoints for token transfers.

## Issues Identified and Fixed

### 1. Case Sensitivity in API Endpoints

**Problem**: The API endpoints for token transfers were not converting the provided addresses to lowercase before querying the database. Since Ethereum addresses in the database are stored in lowercase, case-sensitive comparisons failed when the request used mixed-case addresses.

**Solution**: Modified all token-related API endpoints in `src/services/api/tokens.ts` to convert address parameters to lowercase before querying the database:

```typescript
// Before
const address = req.params.address;

// After
const address = req.params.address.toLowerCase();
```

This ensures that all address comparisons in database queries match the lowercase addresses stored in the database.

### 2. Token Transfer Storage Issue

**Problem**: The indexer was processing blocks and updating token balances, but it wasn't storing token transfers in the database. This was due to an issue with the conflict resolution strategy in the `insertTokenTransfer` method.

**Solution**: Applied the `fix-token-transfers.js` script, which modified the `insertTokenTransfer` method to use a different conflict resolution strategy:

```typescript
// Before
await client.query(
    `INSERT INTO token_transfers (
        transaction_hash, block_number, token_address, from_address, to_address,
        value, token_type, token_id, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT ON CONSTRAINT idx_token_transfers_unique
    DO UPDATE SET
        value = EXCLUDED.value,
        token_type = EXCLUDED.token_type,
        timestamp = EXCLUDED.timestamp`,
    [...]
);

// After
await client.query(
    `INSERT INTO token_transfers (
        transaction_hash, block_number, token_address, from_address, to_address,
        value, token_type, token_id, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (transaction_hash, token_address, from_address, to_address, COALESCE(token_id, ''))
    DO UPDATE SET
        value = EXCLUDED.value,
        token_type = EXCLUDED.token_type,
        timestamp = EXCLUDED.timestamp`,
    [...]
);
```

This change ensures that token transfers are properly stored in the database when the indexer processes blocks.

## Remaining Considerations

### 1. Database Query Validation

Ensure that database methods like `getTokenTransfers` and `getAddressTokenTransfers` use case-sensitive comparisons (PostgreSQL's default). This can be verified with:

```sql
SELECT * FROM token_transfers WHERE token_address = 'lowercaseaddress';
```

### 2. Indexer Logging

Add debug logs in the indexer's `processTokenTransfers` method to confirm transfers are detected:

```typescript
logger.debug(`Detected ${transfers.length} transfers in tx ${txHash}`);
```

### 3. Error Handling in getAddressTokens

The `getAddressTokens` method swallows errors silently. Add error statuses to help debug missing tokens:

```typescript
return {
  ...,
  error: "Failed to fetch metadata"
};
```

### 4. Pagination Limits

The `limit` parameter has no maximum cap. Add safeguards to prevent excessive database load:

```typescript
const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // Max 100
```

### 5. Token Metadata Caching

Repeated calls to `blockchain.getTokenName()`/`getTokenSymbol()` could be cached to reduce RPC calls:

```typescript
const cachedName = await cache.get(`token:${address}:name`);
```

## Resyncing the Database

If you want to ensure all historical token transfers are captured, you can reset the indexer's state and make it start processing blocks from the beginning. This can be done by:

1. Stopping the indexer
2. Deleting the database (or dropping all tables)
3. Restarting the indexer

The indexer will then start processing blocks from block 0 (or whatever starting block is configured) and will add all transactions, including token transfers, to the database.

## Testing Verification

After deploying changes:

1. **Check DB Case Matching**: Query the DB directly to ensure addresses are stored lowercase:
   ```bash
   psql -c "SELECT token_address FROM token_transfers LIMIT 1;"
   ```

2. **Test Mixed-Case Requests**: Verify mixed-case addresses return results:
   ```bash
   curl "http://localhost:3000/tokens/0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E/transfers"
   ```

3. **Monitor Indexer Logs**: Ensure transfers are logged during block processing:
   ```
   DEBUG: Detected 2 transfers in tx 0x...
   ```

The core address casing issue has been resolved, and with the fix to the token transfer storage, the indexer should now correctly store and retrieve token transfers.
