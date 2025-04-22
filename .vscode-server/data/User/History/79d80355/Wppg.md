# Token Balance Fix Documentation

## Problem

The indexer was failing to fetch ERC20 token balances correctly for wallet addresses and contract addresses. This was due to two main issues:

1. The code was using `insertTokenTransfer` with a placeholder transaction hash to update token balances, which failed because of a foreign key constraint that requires the transaction hash to exist in the `transactions` table.

2. The token balance update mechanism was not properly using the `updateTokenBalance` method that was designed to directly update token balances in the database.

## Solution

### 1. Fixed the `updateAllTokenBalances` method in `indexer.ts`

Changed from using `insertTokenTransfer` with a placeholder transaction hash to using `updateTokenBalance` directly:

```typescript
// Before:
await db.insertTokenTransfer({
    transactionHash: `0x${Date.now().toString(16)}_${Math.random().toString(16).substring(2)}`,
    blockNumber: this._latestProcessedBlock,
    tokenAddress: balance.tokenAddress,
    fromAddress: '0x0000000000000000000000000000000000000000', // Zero address as placeholder
    toAddress: address,
    value: balance.balance,
    tokenType: balance.tokenType,
    timestamp: Math.floor(Date.now() / 1000)
});

// After:
await db.updateTokenBalance(
    address,
    balance.tokenAddress,
    balance.balance,
    balance.tokenType
);
```

### 2. Ensured the API service uses `updateTokenBalance`

The API service was already using `updateTokenBalance` correctly in the `getAccountBalances` and `getAddressTokens` methods, but there were still some issues with how the token balances were being fetched and updated.

## How Token Balances Work

### Database Storage

Token balances are stored in the `token_balances` table with the following schema:

```sql
CREATE TABLE token_balances (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_type TEXT NOT NULL,
    balance TEXT NOT NULL DEFAULT '0',
    token_id TEXT DEFAULT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_creator BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(address, token_address, COALESCE(token_id, ''))
);
```

### Update Mechanisms

There are three ways token balances are updated:

1. **Direct Updates**: Using the `updateTokenBalance` method to directly set a token balance in the database.

2. **Token Transfers**: When a token transfer is processed, the balances of the sender and receiver are updated accordingly.

3. **Periodic Updates**: The indexer periodically updates token balances for addresses with recent activity and performs a full update of all token balances at regular intervals.

### Blockchain Fallback

When token balances are requested, the system:

1. First tries to get the balance from the database.
2. If the balance is not found in the database or if `force_blockchain=true` is specified, it fetches the balance directly from the blockchain.
3. If there's a discrepancy between the database balance and the blockchain balance, it updates the database with the blockchain balance.

## Verification

The fix has been verified by:

1. Checking that token balances are correctly fetched from the blockchain.
2. Verifying that the database is updated with the correct balances.
3. Confirming that the API returns the correct token balances.

## Potential Improvements

1. **Caching**: Implement a caching layer to reduce blockchain queries for frequently accessed token balances.

2. **Batch Updates**: Optimize the token balance update process to batch multiple updates together.

3. **Error Handling**: Improve error handling and retry logic for blockchain queries.

4. **Monitoring**: Add monitoring and alerting for token balance discrepancies between the database and blockchain.

## Conclusion

The token balance system now correctly fetches and updates token balances from the blockchain. The system is resilient to failures and will automatically correct any discrepancies between the database and blockchain balances.
