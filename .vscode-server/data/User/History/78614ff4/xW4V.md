# Backend API Integration Guide for Contract Verification

This guide focuses specifically on how to connect your frontend application to the Studio Blockchain Indexer's backend API for contract verification and interaction. It covers the essential API endpoints, request/response formats, and integration patterns without delving into UI implementation details.

## Table of Contents

1. [API Base URL](#api-base-url)
2. [Contract Verification Endpoints](#contract-verification-endpoints)
3. [Contract Interaction Endpoints](#contract-interaction-endpoints)
4. [Error Handling](#error-handling)
5. [Integration Examples](#integration-examples)

## API Base URL

All API endpoints are relative to the base URL of your Studio Blockchain Indexer instance:

```javascript
const API_URL = 'http://localhost:3000'; // Change to your actual API URL
```

## Contract Verification Endpoints

### 1. Check if a Contract is Verified

```
GET /contracts/{address}/verified
```

**Parameters:**
- `address`: The contract address to check

**Response:**
```json
{
  "verified": true|false
}
```

**Example:**
```javascript
async function isContractVerified(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/verified`);
    return response.data.verified;
  } catch (error) {
    console.error('Error checking contract verification status:', error);
    return false;
  }
}
```

### 2. Verify a Contract

```
POST /contracts/verify
```

**Request Body:**
```json
{
  "address": "0x...",
  "sourceCode": "contract MyContract { ... }",
  "compilerVersion": "0.8.20",
  "contractName": "MyContract",
  "optimizationUsed": false,
  "runs": 200,
  "constructorArguments": "0x...",
  "libraries": {
    "LibraryName": "0x..."
  },
  "evmVersion": "cancun"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Contract verified successfully",
  "address": "0x...",
  "abi": [...],
  "bytecode": "0x..."
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error message"
}
```

**Example:**
```javascript
async function verifyContract(verificationData) {
  try {
    const response = await axios.post(`${API_URL}/contracts/verify`, verificationData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
}
```

### 3. Get Contract Details

```
GET /contracts/{address}
```

**Parameters:**
- `address`: The contract address

**Response:**
```json
{
  "address": "0x...",
  "name": "MyContract",
  "compilerVersion": "0.8.20",
  "optimizationUsed": false,
  "runs": 200,
  "evmVersion": "cancun",
  "verifiedAt": "2025-03-28T10:00:00Z"
}
```

**Example:**
```javascript
async function getContractDetails(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract details:', error);
    throw error;
  }
}
```

### 4. Get Contract Source Code

```
GET /contracts/{address}/source
```

**Parameters:**
- `address`: The contract address

**Response:**
```json
{
  "address": "0x...",
  "sourceCode": "contract MyContract { ... }",
  "contractName": "MyContract",
  "compilerVersion": "0.8.20",
  "optimizationUsed": false,
  "runs": 200,
  "evmVersion": "cancun"
}
```

**Example:**
```javascript
async function getContractSource(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/source`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract source:', error);
    throw error;
  }
}
```

### 5. Get Contract ABI

```
GET /contracts/{address}/abi
```

**Parameters:**
- `address`: The contract address

**Response:**
```json
[
  {
    "type": "function",
    "name": "functionName",
    "inputs": [...],
    "outputs": [...],
    "stateMutability": "view"
  },
  ...
]
```

**Example:**
```javascript
async function getContractABI(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/abi`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract ABI:', error);
    throw error;
  }
}
```

## Contract Interaction Endpoints

### 1. Call Contract Method (Read-Only)

```
POST /contracts/{address}/interact
```

**Parameters:**
- `address`: The contract address

**Request Body:**
```json
{
  "method": "functionName",
  "params": ["param1", "param2", ...]
}
```

**Response:**
```json
{
  "result": "Function result"
}
```

**Example:**
```javascript
async function callContractMethod(address, method, params = []) {
  try {
    const response = await axios.post(`${API_URL}/contracts/${address}/interact`, {
      method,
      params
    });
    
    return response.data.result;
  } catch (error) {
    console.error(`Error calling contract method ${method}:`, error);
    throw error;
  }
}
```

### 2. Get Contract Events

```
GET /contracts/{address}/events
```

**Parameters:**
- `address`: The contract address
- `fromBlock` (optional): Starting block number
- `toBlock` (optional): Ending block number
- `eventName` (optional): Filter by event name

**Response:**
```json
[
  {
    "name": "EventName",
    "blockNumber": 12345,
    "transactionHash": "0x...",
    "timestamp": 1616161616,
    "topics": ["0x...", "0x..."],
    "data": "0x..."
  },
  ...
]
```

**Example:**
```javascript
async function getContractEvents(address, options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.fromBlock) params.append('fromBlock', options.fromBlock);
    if (options.toBlock) params.append('toBlock', options.toBlock);
    if (options.eventName) params.append('eventName', options.eventName);
    
    const url = `${API_URL}/contracts/${address}/events${params.toString() ? '?' + params.toString() : ''}`;
    const response = await axios.get(url);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching contract events:', error);
    throw error;
  }
}
```

## Error Handling

The API returns standard HTTP status codes:

- `200 OK`: The request was successful
- `400 Bad Request`: The request was invalid
- `404 Not Found`: The resource was not found
- `500 Internal Server Error`: An error occurred on the server

Error responses include a JSON body with an error message:

```json
{
  "success": false,
  "error": "Error message"
}
```

Example error handling:

```javascript
try {
  const response = await axios.post(`${API_URL}/contracts/verify`, verificationData);
  // Handle success
  return response.data;
} catch (error) {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const errorMessage = error.response.data.error || 'Unknown error';
    console.error(`Verification failed: ${errorMessage}`);
    // Handle specific error cases
    if (error.response.status === 400) {
      // Handle validation errors
    } else if (error.response.status === 404) {
      // Handle not found errors
    }
  } else if (error.request) {
    // The request was made but no response was received
    console.error('No response received from server');
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Error setting up request:', error.message);
  }
  throw error;
}
```

## Integration Examples

### 1. Complete Verification Flow

```javascript
// Step 1: Check if the contract is already verified
const isVerified = await isContractVerified(contractAddress);

if (isVerified) {
  // Step 2a: If verified, fetch contract data
  const [details, source, abi] = await Promise.all([
    getContractDetails(contractAddress),
    getContractSource(contractAddress),
    getContractABI(contractAddress)
  ]);
  
  // Display contract data to the user
  displayContractData(details, source, abi);
} else {
  // Step 2b: If not verified, show verification form
  showVerificationForm(contractAddress);
}

// Step 3: Handle form submission
async function handleVerificationSubmit(formData) {
  try {
    const result = await verifyContract(formData);
    
    if (result.success) {
      // Step 4: On successful verification, fetch and display contract data
      const [details, source, abi] = await Promise.all([
        getContractDetails(contractAddress),
        getContractSource(contractAddress),
        getContractABI(contractAddress)
      ]);
      
      displayContractData(details, source, abi);
    } else {
      // Handle verification failure
      showError(result.message);
    }
  } catch (error) {
    showError(error.message || 'Verification failed');
  }
}
```

### 2. Contract Interaction Flow

```javascript
// Step 1: Fetch contract ABI
const abi = await getContractABI(contractAddress);

// Step 2: Parse ABI to find read and write functions
const readFunctions = abi.filter(item => 
  item.type === 'function' && 
  (item.stateMutability === 'view' || item.stateMutability === 'pure')
);

const writeFunctions = abi.filter(item => 
  item.type === 'function' && 
  item.stateMutability !== 'view' && 
  item.stateMutability !== 'pure'
);

// Step 3: Call a read function
async function callReadFunction(functionName, params) {
  try {
    const result = await callContractMethod(contractAddress, functionName, params);
    return result;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw error;
  }
}

// Step 4: Call a write function (requires web3 provider like MetaMask)
async function callWriteFunction(functionName, params) {
  try {
    // This requires a web3 provider and cannot be done through the API
    // You need to use ethers.js or web3.js directly
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    
    const tx = await contract[functionName](...params);
    await tx.wait();
    
    return tx.hash;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw error;
  }
}

// Step 5: Get contract events
async function getEvents() {
  try {
    const events = await getContractEvents(contractAddress);
    return events;
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
}
```

### 3. Handling the Verification-to-Interaction Transition

```javascript
// Initial state
const [isVerified, setIsVerified] = useState(false);
const [activeView, setActiveView] = useState('verify');
const [contractData, setContractData] = useState(null);

// Check verification status on load
useEffect(() => {
  async function checkStatus() {
    const verified = await isContractVerified(contractAddress);
    setIsVerified(verified);
    
    if (verified) {
      setActiveView('details');
      await fetchContractData();
    }
  }
  
  checkStatus();
}, [contractAddress]);

// Fetch contract data
async function fetchContractData() {
  const [details, source, abi] = await Promise.all([
    getContractDetails(contractAddress),
    getContractSource(contractAddress),
    getContractABI(contractAddress)
  ]);
  
  setContractData({ details, source, abi });
}

// Handle successful verification
function handleVerificationSuccess() {
  setIsVerified(true);
  setActiveView('details');
  fetchContractData();
}

// Render appropriate view
function renderView() {
  if (!isVerified && activeView === 'verify') {
    return <VerificationForm 
      address={contractAddress} 
      onSuccess={handleVerificationSuccess} 
    />;
  }
  
  if (isVerified) {
    switch (activeView) {
      case 'details':
        return <ContractDetails data={contractData.details} />;
      case 'read':
        return <ReadFunctions abi={contractData.abi} address={contractAddress} />;
      case 'write':
        return <WriteFunctions abi={contractData.abi} address={contractAddress} />;
      case 'code':
        return <SourceCode source={contractData.source} />;
      case 'events':
        return <Events address={contractAddress} abi={contractData.abi} />;
      default:
        return <ContractDetails data={contractData.details} />;
    }
  }
  
  return <div>Loading...</div>;
}
```

This guide focuses on the API integration aspects without delving into UI implementation details. You can adapt these examples to your specific frontend framework and UI design.
