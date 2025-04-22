# Contract Data Fetching Guide

This guide addresses how to properly fetch and display contract data (source code, ABI, read/write functions) when loading a verified contract page, especially after a page refresh.

## Understanding the Issue

When a contract is verified, the frontend correctly saves the verification status (e.g., in localStorage). However, when refreshing the page, while the contract is still marked as verified, the contract data (source code, ABI, read/write functions) is not being displayed. This is because the contract data needs to be fetched again from the backend after a page refresh.

## Fetching Contract Data on Page Load

When a contract page loads and the contract is verified, you need to fetch all the necessary contract data from the backend API. This should happen in the `useEffect` hook that runs when the component mounts.

Here's how to implement this:

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

function ContractPage({ match }) {
  const { address } = match.params;
  
  // State for verification status and contract data
  const [isVerified, setIsVerified] = useState(
    localStorage.getItem(`contract-verified-${address}`) === 'true'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [contractData, setContractData] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  
  // Fetch verification status and contract data on component mount
  useEffect(() => {
    async function loadContractData() {
      setIsLoading(true);
      
      try {
        // Step 1: Check if the contract is fully verified (has both ABI and source code)
        const verificationResponse = await axios.get(`${API_URL}/contracts/${address}/verified`);
        const isVerified = verificationResponse.data.verified;
        
        setIsVerified(isVerified);
        
        // Update localStorage
        if (isVerified) {
          localStorage.setItem(`contract-verified-${address}`, 'true');
          
          // Step 2: If verified, fetch all contract data
          await fetchContractData();
        } else {
          // If not verified, remove from localStorage
          localStorage.removeItem(`contract-verified-${address}`);
        }
      } catch (error) {
        console.error('Error loading contract data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadContractData();
  }, [address]);
  
  // Function to fetch all contract data
  async function fetchContractData() {
    try {
      try {
        // Fetch contract details, source code, and ABI in parallel
        const [detailsResponse, sourceResponse, abiResponse] = await Promise.all([
          axios.get(`${API_URL}/contracts/${address}`),
          axios.get(`${API_URL}/contracts/${address}/source`),
          axios.get(`${API_URL}/contracts/${address}/abi`)
        ]);
        
        // Check if any of the responses indicate the contract is not verified
        if (sourceResponse.data.success === false && sourceResponse.data.error === 'Contract is not verified') {
          console.error('Contract is not verified');
          setIsVerified(false);
          localStorage.removeItem(`contract-verified-${address}`);
          return;
        }
        
        if (abiResponse.data.success === false && abiResponse.data.error === 'Contract is not verified') {
          console.error('Contract is not verified');
          setIsVerified(false);
          localStorage.removeItem(`contract-verified-${address}`);
          return;
        }
        
        // Store all data in state
        setContractData({
          details: detailsResponse.data,
          source: sourceResponse.data,
          abi: abiResponse.data
        });
      } catch (error) {
        // Check if the error is because the contract is not verified
        if (error.response && error.response.data && error.response.data.error === 'Contract is not verified') {
          console.error('Contract is not verified');
          setIsVerified(false);
          localStorage.removeItem(`contract-verified-${address}`);
          return;
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error fetching contract data:', error);
    }
  }
  
  // Render loading state
  if (isLoading) {
    return <div>Loading contract data...</div>;
  }
  
  // Render verification form if not verified
  if (!isVerified) {
    return <VerificationForm address={address} onVerified={handleVerificationSuccess} />;
  }
  
  // Render contract data if verified
  return (
    <div className="contract-page">
      {/* Contract header */}
      <div className="contract-header">
        <h2>Contract: {contractData?.details?.name || address}</h2>
        <div className="verification-badge">
          <span className="verified-icon">✓</span> Verified
        </div>
      </div>
      
      {/* Tabs */}
      <div className="tabs">
        <button 
          className={activeTab === 'details' ? 'active' : ''} 
          onClick={() => setActiveTab('details')}
        >
          Contract Details
        </button>
        <button 
          className={activeTab === 'read' ? 'active' : ''} 
          onClick={() => setActiveTab('read')}
        >
          Read Contract
        </button>
        <button 
          className={activeTab === 'write' ? 'active' : ''} 
          onClick={() => setActiveTab('write')}
        >
          Write Contract
        </button>
        <button 
          className={activeTab === 'code' ? 'active' : ''} 
          onClick={() => setActiveTab('code')}
        >
          Contract Code
        </button>
      </div>
      
      {/* Tab content */}
      <div className="tab-content">
        {contractData ? (
          <>
            {activeTab === 'details' && <ContractDetailsTab data={contractData.details} />}
            {activeTab === 'read' && <ReadContractTab abi={contractData.abi} address={address} />}
            {activeTab === 'write' && <WriteContractTab abi={contractData.abi} address={address} />}
            {activeTab === 'code' && <ContractCodeTab source={contractData.source} />}
          </>
        ) : (
          <div>Error loading contract data</div>
        )}
      </div>
    </div>
  );
  
  // Handle successful verification
  async function handleVerificationSuccess() {
    setIsVerified(true);
    localStorage.setItem(`contract-verified-${address}`, 'true');
    await fetchContractData();
    setActiveTab('details');
  }
}
```

## Implementing the Tab Components

Each tab component should properly display the contract data. Here are examples for each tab:

### Contract Details Tab

```javascript
function ContractDetailsTab({ data }) {
  if (!data) return <div>No contract details available</div>;
  
  return (
    <div className="details-tab">
      <h3>Contract Information</h3>
      <table className="details-table">
        <tbody>
          <tr>
            <td>Contract Name:</td>
            <td>{data.name}</td>
          </tr>
          <tr>
            <td>Contract Address:</td>
            <td>{data.address}</td>
          </tr>
          <tr>
            <td>Compiler Version:</td>
            <td>{data.compilerVersion}</td>
          </tr>
          <tr>
            <td>Optimization:</td>
            <td>{data.optimizationUsed ? `Yes, with ${data.runs} runs` : 'No'}</td>
          </tr>
          <tr>
            <td>EVM Version:</td>
            <td>{data.evmVersion}</td>
          </tr>
          <tr>
            <td>Verification Date:</td>
            <td>{new Date(data.verifiedAt).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

### Read Contract Tab

```javascript
function ReadContractTab({ abi, address }) {
  const [readFunctions, setReadFunctions] = useState([]);
  const [results, setResults] = useState({});
  
  useEffect(() => {
    if (!abi) return;
    
    // Filter out read-only functions from the ABI
    const readOnlyFunctions = abi.filter(
      item => item.type === 'function' && 
      (item.stateMutability === 'view' || item.stateMutability === 'pure')
    );
    
    setReadFunctions(readOnlyFunctions);
    
    // Initialize results object
    const initialResults = {};
    readOnlyFunctions.forEach(func => {
      initialResults[func.name] = {
        result: null,
        loading: false,
        error: null
      };
    });
    setResults(initialResults);
  }, [abi]);
  
  if (!abi) return <div>No ABI available</div>;
  
  if (readFunctions.length === 0) {
    return <div>No read functions found in this contract</div>;
  }
  
  // Function to call a read method
  async function callReadFunction(func) {
    // Update loading state
    setResults(prev => ({
      ...prev,
      [func.name]: {
        ...prev[func.name],
        loading: true,
        error: null
      }
    }));
    
    try {
      // Get input values from form
      const inputValues = func.inputs.map(input => {
        const element = document.getElementById(`${func.name}-${input.name}`);
        return element ? element.value : '';
      });
      
      // Call the contract function
      const response = await axios.post(`${API_URL}/contracts/${address}/interact`, {
        method: func.name,
        params: inputValues
      });
      
      // Update results
      setResults(prev => ({
        ...prev,
        [func.name]: {
          result: response.data.result,
          loading: false,
          error: null
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [func.name]: {
          result: null,
          loading: false,
          error: error.response?.data?.error || error.message
        }
      }));
    }
  }
  
  return (
    <div className="read-tab">
      <h3>Read Contract</h3>
      
      <div className="functions-list">
        {readFunctions.map(func => (
          <div key={func.name} className="function-item">
            <h4>{func.name}</h4>
            
            {func.inputs.length > 0 && (
              <div className="function-inputs">
                {func.inputs.map(input => (
                  <div key={input.name} className="input-group">
                    <label htmlFor={`${func.name}-${input.name}`}>
                      {input.name} ({input.type}):
                    </label>
                    <input
                      id={`${func.name}-${input.name}`}
                      type="text"
                      placeholder={`Enter ${input.type}`}
                    />
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => callReadFunction(func)}
              disabled={results[func.name]?.loading}
            >
              {results[func.name]?.loading ? 'Loading...' : 'Query'}
            </button>
            
            {results[func.name]?.error && (
              <div className="error-message">
                {results[func.name].error}
              </div>
            )}
            
            {results[func.name]?.result !== null && (
              <div className="result">
                <h5>Result:</h5>
                <pre>{JSON.stringify(results[func.name].result, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Write Contract Tab

```javascript
function WriteContractTab({ abi, address }) {
  const [writeFunctions, setWriteFunctions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState({});
  
  useEffect(() => {
    if (!abi) return;
    
    // Filter out write functions from the ABI
    const writableFunctions = abi.filter(
      item => item.type === 'function' && 
      item.stateMutability !== 'view' && 
      item.stateMutability !== 'pure'
    );
    
    setWriteFunctions(writableFunctions);
    
    // Initialize transactions object
    const initialTransactions = {};
    writableFunctions.forEach(func => {
      initialTransactions[func.name] = {
        txHash: null,
        loading: false,
        error: null
      };
    });
    setTransactions(initialTransactions);
    
    // Check if MetaMask is available
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setWallet(provider);
    }
  }, [abi]);
  
  if (!abi) return <div>No ABI available</div>;
  
  if (writeFunctions.length === 0) {
    return <div>No write functions found in this contract</div>;
  }
  
  // Function to connect wallet
  async function connectWallet() {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setWallet(provider);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask to interact with the contract');
    }
  }
  
  // Function to call a write method
  async function callWriteFunction(func) {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }
    
    // Update loading state
    setTransactions(prev => ({
      ...prev,
      [func.name]: {
        ...prev[func.name],
        loading: true,
        error: null
      }
    }));
    
    try {
      // Get input values from form
      const inputValues = func.inputs.map(input => {
        const element = document.getElementById(`write-${func.name}-${input.name}`);
        return element ? element.value : '';
      });
      
      // Get signer
      const signer = wallet.getSigner();
      
      // Create contract instance
      const contract = new ethers.Contract(address, abi, signer);
      
      // Call the contract function
      const tx = await contract[func.name](...inputValues);
      
      // Update transactions
      setTransactions(prev => ({
        ...prev,
        [func.name]: {
          txHash: tx.hash,
          loading: false,
          error: null
        }
      }));
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Show success message
      alert(`Transaction successful: ${tx.hash}`);
    } catch (error) {
      setTransactions(prev => ({
        ...prev,
        [func.name]: {
          txHash: null,
          loading: false,
          error: error.message
        }
      }));
    }
  }
  
  return (
    <div className="write-tab">
      <h3>Write Contract</h3>
      
      {!wallet ? (
        <div className="wallet-connect">
          <p>Connect your wallet to interact with the contract</p>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
      ) : (
        <div className="functions-list">
          {writeFunctions.map(func => (
            <div key={func.name} className="function-item">
              <h4>{func.name}</h4>
              
              {func.inputs.length > 0 && (
                <div className="function-inputs">
                  {func.inputs.map(input => (
                    <div key={input.name} className="input-group">
                      <label htmlFor={`write-${func.name}-${input.name}`}>
                        {input.name} ({input.type}):
                      </label>
                      <input
                        id={`write-${func.name}-${input.name}`}
                        type="text"
                        placeholder={`Enter ${input.type}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              <button
                onClick={() => callWriteFunction(func)}
                disabled={transactions[func.name]?.loading}
              >
                {transactions[func.name]?.loading ? 'Processing...' : 'Write'}
              </button>
              
              {transactions[func.name]?.error && (
                <div className="error-message">
                  {transactions[func.name].error}
                </div>
              )}
              
              {transactions[func.name]?.txHash && (
                <div className="transaction-info">
                  <p>Transaction Hash:</p>
                  <a 
                    href={`https://explorer.studio.blockchain/tx/${transactions[func.name].txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {transactions[func.name].txHash}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Contract Code Tab

```javascript
function ContractCodeTab({ source }) {
  if (!source) return <div>No source code available</div>;
  
  return (
    <div className="code-tab">
      <h3>Contract Source Code</h3>
      
      <div className="code-header">
        <div className="file-name">{source.contractName}.sol</div>
        <button 
          className="copy-button"
          onClick={() => {
            navigator.clipboard.writeText(source.sourceCode);
            alert('Source code copied to clipboard');
          }}
        >
          Copy Code
        </button>
      </div>
      
      <pre className="code-container">
        <code className="language-solidity">
          {source.sourceCode}
        </code>
      </pre>
      
      <div className="contract-metadata">
        <h4>Contract Metadata</h4>
        <table>
          <tbody>
            <tr>
              <td>Compiler Version:</td>
              <td>{source.compilerVersion}</td>
            </tr>
            <tr>
              <td>Optimization:</td>
              <td>{source.optimizationUsed ? `Yes, with ${source.runs} runs` : 'No'}</td>
            </tr>
            <tr>
              <td>EVM Version:</td>
              <td>{source.evmVersion}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="contract-abi">
        <h4>Contract ABI</h4>
        <pre className="abi-container">
          <code>
            {JSON.stringify(source.abi, null, 2)}
          </code>
        </pre>
        <button 
          className="copy-button"
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(source.abi));
            alert('ABI copied to clipboard');
          }}
        >
          Copy ABI
        </button>
      </div>
    </div>
  );
}
```

## Debugging Contract Data Fetching

If you're still having issues with contract data not being displayed after a page refresh, here are some debugging steps:

### 1. Check API Responses

Add console logs to see the responses from the API:

```javascript
async function fetchContractData() {
  try {
    console.log('Fetching contract data for address:', address);
    
    const [detailsResponse, sourceResponse, abiResponse] = await Promise.all([
      axios.get(`${API_URL}/contracts/${address}`),
      axios.get(`${API_URL}/contracts/${address}/source`),
      axios.get(`${API_URL}/contracts/${address}/abi`)
    ]);
    
    console.log('Contract details response:', detailsResponse.data);
    console.log('Contract source response:', sourceResponse.data);
    console.log('Contract ABI response:', abiResponse.data);
    
    setContractData({
      details: detailsResponse.data,
      source: sourceResponse.data,
      abi: abiResponse.data
    });
  } catch (error) {
    console.error('Error fetching contract data:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}
```

### 2. Check Component Rendering

Add console logs to see if the components are rendering with the correct data:

```javascript
function ContractDetailsTab({ data }) {
  console.log('Rendering ContractDetailsTab with data:', data);
  
  if (!data) return <div>No contract details available</div>;
  
  // Rest of the component...
}

function ReadContractTab({ abi, address }) {
  console.log('Rendering ReadContractTab with ABI:', abi);
  
  // Rest of the component...
}
```

### 3. Check State Updates

Add console logs to see if the state is being updated correctly:

```javascript
useEffect(() => {
  console.log('contractData state updated:', contractData);
}, [contractData]);
```

### 4. Check API Endpoints

Make sure the API endpoints are correct and returning the expected data. You can test them directly in the browser or using a tool like Postman:

- `GET /contracts/{address}/verified`
- `GET /contracts/{address}`
- `GET /contracts/{address}/source`
- `GET /contracts/{address}/abi`

## Common Issues and Solutions

### 1. API Endpoints Not Returning Data

If the API endpoints are not returning data, check:

- The contract address is correct
- The contract is actually verified in the database
- The API server is running
- There are no CORS issues

### 2. Data Not Being Displayed After Fetching

If the data is being fetched but not displayed, check:

- The state is being updated correctly
- The components are rendering with the correct data
- There are no errors in the console

### 3. ABI Not Being Parsed Correctly

If the ABI is not being parsed correctly, check:

- The ABI is valid JSON
- The ABI is being passed correctly to the components
- The components are handling the ABI correctly

## Complete Solution

Here's a complete solution that fetches and displays contract data after a page refresh:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useHistory } from 'react-router-dom';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

const API_URL = 'http://localhost:3000';

function ContractPage() {
  const { address } = useParams();
  const history = useHistory();
  
  // State
  const [isVerified, setIsVerified] = useState(
    localStorage.getItem(`contract-verified-${address}`) === 'true'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [contractData, setContractData] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  
  // Check verification status and fetch data on mount
  useEffect(() => {
    async function loadContractData() {
      setIsLoading(true);
      
      try {
        // Step 1: Check if the contract is verified
        const verificationResponse = await axios.get(`${API_URL}/contracts/${address}/verified`);
        const verified = verificationResponse.data.verified;
        
        console.log('Contract verification status:', verified);
        
        setIsVerified(verified);
        
        // Update localStorage
        if (verified) {
          localStorage.setItem(`contract-verified-${address}`, 'true');
          
          // Step 2: If verified, fetch all contract data
          await fetchContractData();
        }
      } catch (error) {
        console.error('Error loading contract data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadContractData();
  }, [address]);
  
  // Function to fetch all contract data
  async function fetchContractData() {
    try {
      console.log('Fetching contract data for address:', address);
      
      try {
        // Fetch contract details, source code, and ABI in parallel
        const [detailsResponse, sourceResponse, abiResponse] = await Promise.all([
          axios.get(`${API_URL}/contracts/${address}`),
          axios.get(`${API_URL}/contracts/${address}/source`),
          axios.get(`${API_URL}/contracts/${address}/abi`)
        ]);
        
        console.log('Contract details response:', detailsResponse.data);
        console.log('Contract source response:', sourceResponse.data);
        console.log('Contract ABI response:', abiResponse.data);
        
        // Check if any of the responses indicate the contract is not verified
        if (sourceResponse.data.success === false && sourceResponse.data.error === 'Contract is not verified') {
          console.error('Contract is not verified');
          setIsVerified(false);
          localStorage.removeItem(`contract-verified-${address}`);
          return;
        }
        
        if (abiResponse.data.success === false && abiResponse.data.error === 'Contract is not verified') {
          console.error('Contract is not verified');
          setIsVerified(false);
          localStorage.removeItem(`contract-verified-${address}`);
          return;
        }
        
        // Store all data in state
        setContractData({
          details: detailsResponse.data,
          source: sourceResponse.data,
          abi: abiResponse.data
        });
      } catch (error) {
        // Check if the error is because the contract is not verified
        if (error.response && error.response.data && error.response.data.error === 'Contract is not verified') {
          console.error('Contract is not verified');
          setIsVerified(false);
          localStorage.removeItem(`contract-verified-${address}`);
          return;
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error fetching contract data:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    }
  }
  
  // Handle verification form submission
  async function handleVerificationSubmit(formData) {
    try {
      const result = await axios.post(`${API_URL}/contracts/verify`, formData);
      
      if (result.data.success) {
        // Update state and localStorage
        setIsVerified(true);
        localStorage.setItem(`contract-verified-${address}`, 'true');
        
        // Fetch contract data
        await fetchContractData();
        
        // Switch to details tab
        setActiveTab('details');
        
        // Show success message
        toast.success('Contract verified successfully!');
        
        // Update URL without reloading the page
        history.replace(`/address/${address}`);
      } else {
        toast.error(result.data.message || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Verification failed');
    }
  }
  
  // Render loading state
  if (isLoading) {
    return <div>Loading contract data...</div>;
  }
  
  // Render verification form if not verified
  if (!isVerified) {
    return (
      <VerificationForm 
        address={address} 
        onSubmit={handleVerificationSubmit} 
      />
    );
  }
  
  // Render contract data if verified
  return (
    <div className="contract-page">
      {/* Contract header */}
      <div className="contract-header">
        <h2>Contract: {contractData?.details?.name || address}</h2>
        <div className="verification-badge">
          <span className="verified-icon">✓</span> Verified
        </div>
      </div>
      
      {/* Tabs */}
      <div className="tabs">
        <button 
          className={activeTab === 'details' ? 'active' : ''} 
          onClick={() => setActiveTab('details')}
        >
          Contract Details
        </button>
        <button 
          className={activeTab === 'read' ? 'active' : ''} 
          onClick={() => setActiveTab('read')}
        >
          Read Contract
        </button>
        <button 
          className={activeTab === 'write' ? 'active' : ''} 
          onClick={() => setActiveTab('write')}
        >
          Write Contract
        </button>
        <button 
          className={activeTab === 'code' ? 'active' : ''} 
          onClick={() => setActiveTab('code')}
        >
          Contract Code
        </button>
      </div>
      
      {/* Tab content */}
      <div className="tab-content">
        {contractData ? (
          <>
            {activeTab === 'details' && <ContractDetailsTab data={contractData.details} />}
            {activeTab === 'read' && <ReadContractTab abi={contractData.abi} address={address} />}
            {activeTab === 'write' && <WriteContractTab abi={contractData.abi} address={address} />}
            {activeTab === 'code' && <ContractCodeTab source={contractData.source} />}
          </>
        ) : (
          <div>Error loading contract data. Please refresh the page.</div>
        )}
      </div>
    </div>
  );
}

export default ContractPage;
```

This implementation ensures that:

1. The verification status is checked when the page loads
2. If the contract is verified, all contract data is fetched from the backend
3. The appropriate tab is displayed based on the active tab state
4. Each tab component properly displays the contract data

By implementing this solution, the contract data will be properly displayed after a page refresh, providing a seamless user experience.
