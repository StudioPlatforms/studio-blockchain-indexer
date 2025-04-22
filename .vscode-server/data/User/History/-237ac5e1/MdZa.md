# Frontend Integration Guide for Studio Blockchain Explorer

This guide provides instructions for frontend developers on how to integrate with the Studio Blockchain Explorer API, with a focus on the new token-related endpoints.

## API Base URL

The API is available at:

```
http://localhost:3000
```

For production, use:

```
https://mainnetindexer.studio-blockchain.com
```

## Authentication

The API does not require authentication.

## Error Handling

All endpoints return a JSON response. In case of an error, the response will have an `error` field with a description of the error:

```json
{
  "error": "Error message"
}
```

## Pagination

Most list endpoints support pagination using the following query parameters:

- `limit`: Number of results to return (default: 10)
- `offset`: Offset for pagination (default: 0)

Example:

```
GET /transactions?limit=20&offset=40
```

## Token-Related Endpoints

### 1. Get Account Balances

Retrieves the native balance and token balances for an address.

```
GET /account/{address}/balances
```

Example Response:

```json
{
  "native": 1.234567,
  "tokens": [
    {
      "contractAddress": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
      "symbol": "USDT",
      "name": "Tether USD",
      "balance": 1250.75,
      "decimals": 18,
      "type": "ERC20"
    }
  ]
}
```

Frontend Implementation:

```javascript
async function fetchAccountBalances(address) {
  try {
    const response = await fetch(`${API_BASE_URL}/account/${address}/balances`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error fetching account balances:', data.error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching account balances:', error);
    return null;
  }
}

// Usage
const address = '0x846c234adc6d8e74353c0c355b0c2b6a1e46634f';
const balances = await fetchAccountBalances(address);

// Display native balance
if (balances) {
  document.getElementById('native-balance').textContent = `${balances.native} STO`;
  
  // Display token balances
  const tokensList = document.getElementById('tokens-list');
  tokensList.innerHTML = '';
  
  balances.tokens.forEach(token => {
    const tokenItem = document.createElement('div');
    tokenItem.className = 'token-item';
    tokenItem.innerHTML = `
      <div class="token-symbol">${token.symbol}</div>
      <div class="token-name">${token.name}</div>
      <div class="token-balance">${token.balance}</div>
    `;
    tokensList.appendChild(tokenItem);
  });
}
```

### 2. Get Token Transfers

Retrieves token transfer history for an address.

```
GET /address/{address}/token-transfers
```

Example Response:

```json
[
  {
    "hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "blockNumber": 12345678,
    "timestamp": 1742892853,
    "from": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "to": "0x7890abcdef1234567890abcdef1234567890abcdef",
    "tokenAddress": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
    "tokenSymbol": "USDT",
    "tokenName": "Tether USD",
    "value": "100000000000000000000",
    "decimals": 18
  }
]
```

Frontend Implementation:

```javascript
async function fetchTokenTransfers(address, limit = 10, offset = 0) {
  try {
    const response = await fetch(`${API_BASE_URL}/address/${address}/token-transfers?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error fetching token transfers:', data.error);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching token transfers:', error);
    return [];
  }
}

// Usage
const address = '0x846c234adc6d8e74353c0c355b0c2b6a1e46634f';
const transfers = await fetchTokenTransfers(address);

// Display token transfers
const transfersList = document.getElementById('transfers-list');
transfersList.innerHTML = '';

transfers.forEach(transfer => {
  // Convert value from wei to token units
  const valueInTokens = ethers.utils.formatUnits(transfer.value, transfer.decimals);
  
  // Format timestamp
  const date = new Date(transfer.timestamp * 1000);
  const formattedDate = date.toLocaleString();
  
  // Determine if it's an incoming or outgoing transfer
  const isIncoming = transfer.to.toLowerCase() === address.toLowerCase();
  const transferType = isIncoming ? 'incoming' : 'outgoing';
  
  const transferItem = document.createElement('div');
  transferItem.className = `transfer-item ${transferType}`;
  transferItem.innerHTML = `
    <div class="transfer-hash">
      <a href="#/tx/${transfer.hash}" title="${transfer.hash}">${transfer.hash.substring(0, 10)}...${transfer.hash.substring(58)}</a>
    </div>
    <div class="transfer-date">${formattedDate}</div>
    <div class="transfer-addresses">
      <div class="transfer-from">
        <span class="label">From:</span>
        <a href="#/address/${transfer.from}" title="${transfer.from}">${transfer.from.substring(0, 10)}...${transfer.from.substring(32)}</a>
      </div>
      <div class="transfer-to">
        <span class="label">To:</span>
        <a href="#/address/${transfer.to}" title="${transfer.to}">${transfer.to.substring(0, 10)}...${transfer.to.substring(32)}</a>
      </div>
    </div>
    <div class="transfer-token">
      <span class="token-value">${valueInTokens}</span>
      <span class="token-symbol">${transfer.tokenSymbol}</span>
    </div>
  `;
  transfersList.appendChild(transferItem);
});
```

### 3. Get Token Information

Retrieves detailed information about a token.

```
GET /tokens/{tokenAddress}
```

Example Response:

```json
{
  "address": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
  "symbol": "USDT",
  "name": "Tether USD",
  "decimals": 18,
  "totalSupply": "1000000000000000000000000000",
  "type": "ERC20",
  "holders": 12345,
  "transfers": 67890
}
```

Frontend Implementation:

```javascript
async function fetchTokenInfo(tokenAddress) {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/${tokenAddress}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error fetching token info:', data.error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}

// Usage
const tokenAddress = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E';
const tokenInfo = await fetchTokenInfo(tokenAddress);

// Display token information
if (tokenInfo) {
  // Convert total supply from wei to token units
  const totalSupply = ethers.utils.formatUnits(tokenInfo.totalSupply, tokenInfo.decimals);
  
  document.getElementById('token-name').textContent = tokenInfo.name;
  document.getElementById('token-symbol').textContent = tokenInfo.symbol;
  document.getElementById('token-address').textContent = tokenInfo.address;
  document.getElementById('token-decimals').textContent = tokenInfo.decimals;
  document.getElementById('token-total-supply').textContent = totalSupply;
  document.getElementById('token-type').textContent = tokenInfo.type;
  document.getElementById('token-holders').textContent = tokenInfo.holders.toLocaleString();
  document.getElementById('token-transfers').textContent = tokenInfo.transfers.toLocaleString();
}
```

### 4. Get Token Holders

Retrieves the holders of a token.

```
GET /tokens/{tokenAddress}/holders
```

Example Response:

```json
[
  {
    "address": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "balance": "1250750000000000000000",
    "percentage": 0.00125
  }
]
```

Frontend Implementation:

```javascript
async function fetchTokenHolders(tokenAddress, limit = 10, offset = 0) {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/${tokenAddress}/holders?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error fetching token holders:', data.error);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching token holders:', error);
    return [];
  }
}

// Usage
const tokenAddress = '0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E';
const tokenInfo = await fetchTokenInfo(tokenAddress); // Get token info first to get decimals
const holders = await fetchTokenHolders(tokenAddress);

// Display token holders
const holdersList = document.getElementById('holders-list');
holdersList.innerHTML = '';

holders.forEach(holder => {
  // Convert balance from wei to token units
  const balanceInTokens = ethers.utils.formatUnits(holder.balance, tokenInfo.decimals);
  
  // Format percentage
  const percentage = (holder.percentage * 100).toFixed(4);
  
  const holderItem = document.createElement('div');
  holderItem.className = 'holder-item';
  holderItem.innerHTML = `
    <div class="holder-address">
      <a href="#/address/${holder.address}" title="${holder.address}">${holder.address.substring(0, 10)}...${holder.address.substring(32)}</a>
    </div>
    <div class="holder-balance">${balanceInTokens} ${tokenInfo.symbol}</div>
    <div class="holder-percentage">${percentage}%</div>
  `;
  holdersList.appendChild(holderItem);
});
```

### 5. Detect New Contracts

Detects new contracts deployed in a specified block range.

```
GET /contracts/detect?fromBlock={fromBlock}&toBlock={toBlock}
```

Example Response:

```json
[
  {
    "address": "0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E",
    "blockNumber": 12345678,
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "timestamp": 1742892853,
    "creator": "0x846c234adc6d8e74353c0c355b0c2b6a1e46634f",
    "type": "ERC20",
    "name": "Tether USD",
    "symbol": "USDT",
    "decimals": 18,
    "totalSupply": "1000000000000000000000000000"
  }
]
```

Frontend Implementation:

```javascript
async function detectNewContracts(fromBlock, toBlock) {
  try {
    const response = await fetch(`${API_BASE_URL}/contracts/detect?fromBlock=${fromBlock}&toBlock=${toBlock}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error detecting new contracts:', data.error);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error detecting new contracts:', error);
    return [];
  }
}

// Usage
const latestBlock = 147551; // Get this from the API
const fromBlock = latestBlock - 1000;
const toBlock = latestBlock;
const newContracts = await detectNewContracts(fromBlock, toBlock);

// Display new contracts
const contractsList = document.getElementById('new-contracts-list');
contractsList.innerHTML = '';

newContracts.forEach(contract => {
  // Format timestamp
  const date = new Date(contract.timestamp * 1000);
  const formattedDate = date.toLocaleString();
  
  // Convert total supply from wei to token units if it's a token
  let totalSupply = '';
  if (contract.type === 'ERC20' && contract.totalSupply && contract.decimals) {
    totalSupply = ethers.utils.formatUnits(contract.totalSupply, contract.decimals);
  }
  
  const contractItem = document.createElement('div');
  contractItem.className = 'contract-item';
  contractItem.innerHTML = `
    <div class="contract-address">
      <a href="#/address/${contract.address}" title="${contract.address}">${contract.address.substring(0, 10)}...${contract.address.substring(32)}</a>
    </div>
    <div class="contract-date">${formattedDate}</div>
    <div class="contract-creator">
      <span class="label">Creator:</span>
      <a href="#/address/${contract.creator}" title="${contract.creator}">${contract.creator.substring(0, 10)}...${contract.creator.substring(32)}</a>
    </div>
    <div class="contract-type">${contract.type}</div>
    ${contract.name ? `<div class="contract-name">${contract.name}</div>` : ''}
    ${contract.symbol ? `<div class="contract-symbol">${contract.symbol}</div>` : ''}
    ${totalSupply ? `<div class="contract-supply">${totalSupply}</div>` : ''}
  `;
  contractsList.appendChild(contractItem);
});
```

## Best Practices

1. **Error Handling**: Always check for errors in API responses and provide appropriate feedback to users.

2. **Loading States**: Show loading indicators while fetching data from the API.

3. **Pagination**: Implement pagination controls for list views to improve performance and user experience.

4. **Caching**: Consider caching API responses to reduce the number of requests and improve performance.

5. **Responsive Design**: Ensure that your UI is responsive and works well on different screen sizes.

6. **Accessibility**: Make sure your UI is accessible to all users, including those with disabilities.

7. **Testing**: Test your integration thoroughly to ensure it works as expected.

## Example: Token Balance Page

Here's a complete example of a token balance page that displays an address's native balance and token balances:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Balances</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .balance-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .balance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .balance-value {
      font-size: 24px;
      font-weight: bold;
    }
    .token-list {
      border-top: 1px solid #ddd;
      padding-top: 16px;
    }
    .token-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .token-info {
      display: flex;
      flex-direction: column;
    }
    .token-symbol {
      font-weight: bold;
    }
    .token-name {
      color: #666;
      font-size: 14px;
    }
    .token-balance {
      font-weight: bold;
      text-align: right;
    }
    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
    .error {
      color: red;
      padding: 10px;
      border: 1px solid red;
      border-radius: 4px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <h1>Token Balances</h1>
  
  <div class="address-input">
    <input type="text" id="address-input" placeholder="Enter address">
    <button id="fetch-button">Fetch Balances</button>
  </div>
  
  <div id="error-container" class="error" style="display: none;"></div>
  
  <div id="loading-container" class="loading" style="display: none;">Loading...</div>
  
  <div id="balances-container" style="display: none;">
    <div class="balance-card">
      <div class="balance-header">
        <h2>Native Balance</h2>
        <div class="balance-value" id="native-balance">0 STO</div>
      </div>
    </div>
    
    <div class="balance-card">
      <div class="balance-header">
        <h2>Token Balances</h2>
      </div>
      <div class="token-list" id="tokens-list">
        <!-- Token items will be added here -->
      </div>
    </div>
  </div>
  
  <script src="https://cdn.ethers.io/lib/ethers-5.2.umd.min.js" type="application/javascript"></script>
  <script>
    const API_BASE_URL = 'http://localhost:3000';
    
    async function fetchAccountBalances(address) {
      try {
        const response = await fetch(`${API_BASE_URL}/account/${address}/balances`);
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        return data;
      } catch (error) {
        throw error;
      }
    }
    
    document.getElementById('fetch-button').addEventListener('click', async () => {
      const addressInput = document.getElementById('address-input');
      const address = addressInput.value.trim();
      
      if (!address) {
        showError('Please enter an address');
        return;
      }
      
      // Show loading
      document.getElementById('error-container').style.display = 'none';
      document.getElementById('balances-container').style.display = 'none';
      document.getElementById('loading-container').style.display = 'block';
      
      try {
        const balances = await fetchAccountBalances(address);
        
        // Display native balance
        document.getElementById('native-balance').textContent = `${balances.native} STO`;
        
        // Display token balances
        const tokensList = document.getElementById('tokens-list');
        tokensList.innerHTML = '';
        
        if (balances.tokens.length === 0) {
          tokensList.innerHTML = '<div class="token-item">No tokens found</div>';
        } else {
          balances.tokens.forEach(token => {
            const tokenItem = document.createElement('div');
            tokenItem.className = 'token-item';
            tokenItem.innerHTML = `
              <div class="token-info">
                <div class="token-symbol">${token.symbol}</div>
                <div class="token-name">${token.name}</div>
              </div>
              <div class="token-balance">${token.balance}</div>
            `;
            tokensList.appendChild(tokenItem);
          });
        }
        
        // Show balances
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('balances-container').style.display = 'block';
      } catch (error) {
        showError(error.message);
        document.getElementById('loading-container').style.display = 'none';
      }
    });
    
    function showError(message) {
      const errorContainer = document.getElementById('error-container');
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
    }
  </script>
</body>
</html>
```

## Conclusion

This guide provides the basics for integrating with the Studio Blockchain Explorer API. For more complex use cases or additional features, please refer to the API documentation or contact the development team.
