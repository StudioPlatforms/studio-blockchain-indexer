# Frontend Contract Interaction Guide

This guide explains how to implement the frontend UI flow for contract verification and interaction, including how to handle the transition between verification and contract interaction views.

## Table of Contents

1. [Checking if a Contract is Verified](#checking-if-a-contract-is-verified)
2. [Handling Successful Verification](#handling-successful-verification)
3. [Implementing the Contract Tabs Interface](#implementing-the-contract-tabs-interface)
4. [Fetching Contract Data](#fetching-contract-data)
5. [Complete Example Implementation](#complete-example-implementation)

## Checking if a Contract is Verified

Before displaying the verification form, you should check if the contract is already verified. This helps provide a better user experience by immediately showing the contract details if it's already verified.

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:3000';

/**
 * Check if a contract is already verified
 * @param {string} address - The contract address to check
 * @returns {Promise<boolean>} - Whether the contract is verified
 */
async function isContractVerified(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/verified`);
    return response.data.verified;
  } catch (error) {
    console.error('Error checking contract verification status:', error);
    return false;
  }
}

// Example usage in a React component
function ContractPage({ contractAddress }) {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function checkVerificationStatus() {
      setIsLoading(true);
      const verified = await isContractVerified(contractAddress);
      setIsVerified(verified);
      setIsLoading(false);
    }
    
    checkVerificationStatus();
  }, [contractAddress]);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      {isVerified ? (
        <ContractDetails address={contractAddress} />
      ) : (
        <VerificationForm address={contractAddress} onVerified={() => setIsVerified(true)} />
      )}
    </div>
  );
}
```

## Handling Successful Verification

When a contract is successfully verified, you should:

1. Show a success message
2. Update the UI to display the contract details
3. Switch from the verification form to the contract details view

```javascript
function VerificationForm({ address, onVerified }) {
  const [formData, setFormData] = useState({
    address,
    sourceCode: '',
    compilerVersion: '',
    contractName: '',
    optimizationUsed: false,
    runs: 200,
    constructorArguments: '',
    libraries: {},
    evmVersion: 'cancun',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_URL}/contracts/verify`, formData);
      
      // Show success message
      toast.success('Contract verified successfully!');
      
      // Call the onVerified callback to update the parent component
      onVerified();
      
      // You can also redirect to the contract details page
      // history.push(`/contracts/${address}`);
    } catch (error) {
      setError(
        error.response?.data?.error || 
        error.message || 
        'An error occurred during verification'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Form JSX...
}
```

## Implementing the Contract Tabs Interface

After verification, you should display a tabbed interface with:

1. Contract details tab
2. Read functions tab
3. Write functions tab
4. Contract code tab
5. Events tab

```jsx
function ContractDetails({ address }) {
  const [activeTab, setActiveTab] = useState('details');
  const [contractData, setContractData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchContractData() {
      setIsLoading(true);
      try {
        // Fetch all contract data in parallel
        const [detailsResponse, sourceResponse, abiResponse] = await Promise.all([
          axios.get(`${API_URL}/contracts/${address}`),
          axios.get(`${API_URL}/contracts/${address}/source`),
          axios.get(`${API_URL}/contracts/${address}/abi`)
        ]);
        
        setContractData({
          details: detailsResponse.data,
          source: sourceResponse.data,
          abi: abiResponse.data
        });
      } catch (error) {
        console.error('Error fetching contract data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchContractData();
  }, [address]);
  
  if (isLoading) {
    return <div>Loading contract data...</div>;
  }
  
  if (!contractData) {
    return <div>Error loading contract data</div>;
  }
  
  return (
    <div className="contract-details">
      <div className="contract-header">
        <h2>Contract: {contractData.details.name || address}</h2>
        <div className="verification-badge">
          <span className="verified-icon">✓</span> Verified
        </div>
      </div>
      
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
        <button 
          className={activeTab === 'events' ? 'active' : ''} 
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'details' && <ContractDetailsTab data={contractData.details} />}
        {activeTab === 'read' && <ReadContractTab abi={contractData.abi} address={address} />}
        {activeTab === 'write' && <WriteContractTab abi={contractData.abi} address={address} />}
        {activeTab === 'code' && <ContractCodeTab source={contractData.source} />}
        {activeTab === 'events' && <ContractEventsTab address={address} abi={contractData.abi} />}
      </div>
    </div>
  );
}
```

## Fetching Contract Data

You need to fetch different types of contract data to populate the tabs:

```javascript
/**
 * Get contract details
 * @param {string} address - The contract address
 * @returns {Promise<Object>} - The contract details
 */
async function getContractDetails(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract details:', error);
    throw error;
  }
}

/**
 * Get contract source code
 * @param {string} address - The contract address
 * @returns {Promise<Object>} - The contract source code
 */
async function getContractSource(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/source`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract source:', error);
    throw error;
  }
}

/**
 * Get contract ABI
 * @param {string} address - The contract address
 * @returns {Promise<Array>} - The contract ABI
 */
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

## Implementing the Tab Components

### Contract Details Tab

```jsx
function ContractDetailsTab({ data }) {
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

```jsx
import { ethers } from 'ethers';

function ReadContractTab({ abi, address }) {
  const [readFunctions, setReadFunctions] = useState([]);
  const [results, setResults] = useState({});
  
  useEffect(() => {
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
  
  const callReadFunction = async (func) => {
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
  };
  
  return (
    <div className="read-tab">
      <h3>Read Contract</h3>
      
      {readFunctions.length === 0 ? (
        <p>No read functions found in this contract.</p>
      ) : (
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
      )}
    </div>
  );
}
```

### Write Contract Tab

```jsx
import { ethers } from 'ethers';

function WriteContractTab({ abi, address }) {
  const [writeFunctions, setWriteFunctions] = useState([]);
  const [transactions, setTransactions] = useState({});
  const [wallet, setWallet] = useState(null);
  
  useEffect(() => {
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
  
  const connectWallet = async () => {
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
  };
  
  const callWriteFunction = async (func) => {
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
  };
  
  return (
    <div className="write-tab">
      <h3>Write Contract</h3>
      
      {!wallet ? (
        <div className="wallet-connect">
          <p>Connect your wallet to interact with the contract</p>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
      ) : writeFunctions.length === 0 ? (
        <p>No write functions found in this contract.</p>
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

```jsx
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-solidity';

function ContractCodeTab({ source }) {
  useEffect(() => {
    // Highlight code when component mounts
    Prism.highlightAll();
  }, [source]);
  
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
      
      <div className="bytecode">
        <h4>Bytecode</h4>
        <div className="bytecode-container">
          <div className="bytecode-text">{source.bytecode}</div>
          <button 
            className="copy-button"
            onClick={() => {
              navigator.clipboard.writeText(source.bytecode);
              alert('Bytecode copied to clipboard');
            }}
          >
            Copy Bytecode
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Contract Events Tab

```jsx
function ContractEventsTab({ address, abi }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`${API_URL}/contracts/${address}/events`);
        setEvents(response.data);
      } catch (error) {
        console.error('Error fetching events:', error);
        setError(error.response?.data?.error || error.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchEvents();
  }, [address]);
  
  // Find event definitions in ABI
  const eventDefinitions = abi.filter(item => item.type === 'event');
  
  // Function to format event data based on its definition
  const formatEventData = (event) => {
    const definition = eventDefinitions.find(def => def.name === event.name);
    
    if (!definition) {
      return event.data;
    }
    
    const formattedData = {};
    
    // Match indexed parameters
    event.topics.slice(1).forEach((topic, index) => {
      const param = definition.inputs.find(input => input.indexed && !formattedData[input.name]);
      if (param) {
        formattedData[param.name] = formatParameter(topic, param.type);
      }
    });
    
    // Match non-indexed parameters
    const nonIndexedParams = definition.inputs.filter(input => !input.indexed);
    if (nonIndexedParams.length > 0 && event.data !== '0x') {
      const decodedData = ethers.utils.defaultAbiCoder.decode(
        nonIndexedParams.map(param => param.type),
        ethers.utils.hexDataSlice(event.data, 0)
      );
      
      nonIndexedParams.forEach((param, index) => {
        formattedData[param.name] = decodedData[index].toString();
      });
    }
    
    return formattedData;
  };
  
  // Helper function to format parameter based on type
  const formatParameter = (value, type) => {
    if (type === 'address') {
      return ethers.utils.getAddress(ethers.utils.hexDataSlice(value, 12));
    } else if (type.startsWith('uint') || type.startsWith('int')) {
      return ethers.BigNumber.from(value).toString();
    } else if (type === 'bool') {
      return value === '0x0000000000000000000000000000000000000000000000000000000000000001';
    } else {
      return value;
    }
  };
  
  return (
    <div className="events-tab">
      <h3>Contract Events</h3>
      
      {isLoading ? (
        <div>Loading events...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : events.length === 0 ? (
        <div>No events found for this contract.</div>
      ) : (
        <div className="events-list">
          {events.map((event, index) => (
            <div key={index} className="event-item">
              <div className="event-header">
                <h4>{event.name}</h4>
                <span className="event-block">Block: {event.blockNumber}</span>
                <span className="event-timestamp">
                  {new Date(event.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              
              <div className="event-data">
                <h5>Parameters:</h5>
                <pre>{JSON.stringify(formatEventData(event), null, 2)}</pre>
              </div>
              
              <div className="event-links">
                <a 
                  href={`https://explorer.studio.blockchain/tx/${event.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Transaction
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Complete Example Implementation

Here's a complete example of how to implement the contract verification and interaction flow:

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-solidity';
import './ContractPage.css';

const API_URL = 'http://localhost:3000';

function ContractPage() {
  const { address } = useParams();
  const history = useHistory();
  
  const [isVerified, setIsVerified] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(true);
  const [activeTab, setActiveTab] = useState('verify');
  const [contractData, setContractData] = useState(null);
  
  // Check if contract is verified when component mounts
  useEffect(() => {
    async function checkVerificationStatus() {
      setIsCheckingVerification(true);
      try {
        const response = await axios.get(`${API_URL}/contracts/${address}/verified`);
        const verified = response.data.verified;
        
        setIsVerified(verified);
        
        // If verified, set active tab to 'details' and fetch contract data
        if (verified) {
          setActiveTab('details');
          fetchContractData();
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        setIsVerified(false);
      } finally {
        setIsCheckingVerification(false);
      }
    }
    
    checkVerificationStatus();
  }, [address]);
  
  // Fetch contract data when verified
  const fetchContractData = async () => {
    try {
      // Fetch all contract data in parallel
      const [detailsResponse, sourceResponse, abiResponse] = await Promise.all([
        axios.get(`${API_URL}/contracts/${address}`),
        axios.get(`${API_URL}/contracts/${address}/source`),
        axios.get(`${API_URL}/contracts/${address}/abi`)
      ]);
      
      setContractData({
        details: detailsResponse.data,
        source: sourceResponse.data,
        abi: abiResponse.data
      });
    } catch (error) {
      console.error('Error fetching contract data:', error);
    }
  };
  
  // Handle successful verification
  const handleVerificationSuccess = () => {
    setIsVerified(true);
    setActiveTab('details');
    fetchContractData();
    
    // Show success message
    toast.success('Contract verified successfully!');
    
    // Update URL to reflect the new state
    history.replace(`/contracts/${address}`);
  };
  
  if (isCheckingVerification) {
    return <div className="loading">Checking contract verification status...</div>;
  }
  
  return (
    <div className="contract-page">
      <div className="contract-header">
        <h2>Contract: {contractData?.details?.name || address}</h2>
        {isVerified && (
          <div className="verification-badge">
            <span className="verified-icon">✓</span> Verified
          </div>
        )}
      </div>
      
      <div className="tabs">
        {!isVerified && (
          <button 
            className={activeTab === 'verify' ? 'active' : ''} 
            onClick={() => setActiveTab('verify')}
          >
            Verify Contract
          </button>
        )}
        
        {isVerified && (
          <>
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
            <button 
              className={activeTab === 'events' ? 'active' : ''} 
              onClick={() => setActiveTab('events')}
            >
              Events
            </button>
          </>
        )}
      </div>
      
      <div className="tab-content">
        {activeTab === 'verify' && !isVerified && (
          <VerificationForm 
            address={address} 
            onVerified={handleVerificationSuccess} 
          />
        )}
        
        {isVerified && (
          <>
            {activeTab === 'details' && <ContractDetailsTab data={contractData.details} />}
            {activeTab === 'read' && <ReadContractTab abi={contractData.abi} address={address} />}
            {activeTab === 'write' && <WriteContractTab abi={contractData.abi} address={address} />}
            {activeTab === 'code' && <ContractCodeTab source={contractData.source} />}
            {activeTab === 'events' && <ContractEventsTab address={address} abi={contractData.abi} />}
          </>
        )}
      </div>
    </div>
  );
}

// Export the component
export default ContractPage;
```

This implementation provides a complete solution for:

1. Checking if a contract is already verified
2. Displaying the verification form if the contract is not verified
3. Handling the verification process
4. Switching to the contract details view after successful verification
5. Implementing a tabbed interface for contract interaction
6. Fetching and displaying contract data
7. Interacting with the contract's read and write functions
8. Displaying contract events

## CSS Styling

Here's a basic CSS styling for the contract page:

```css
/* ContractPage.css */

.contract-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.contract-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.verification-badge {
  background-color: #4caf50;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.verified-icon {
  margin-right: 5px;
  font-weight: bold;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #ccc;
  margin-bottom: 20px;
}

.tabs button {
  background-color: transparent;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 16px;
  border-bottom: 2px solid transparent;
}

.tabs button.active {
  border-bottom: 2px solid #2196f3;
  color: #2196f3;
}

.tab-content {
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.details-table {
  width: 100%;
  border-collapse: collapse;
}

.details-table td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

.details-table td:first-child {
  font-weight: bold;
  width: 200px;
}

.function-item {
  margin-bottom: 20px;
  padding: 15px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.function-inputs {
  margin: 10px 0;
}

.input-group {
  margin-bottom: 10px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
}

.input-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #f44336;
  margin-top: 10px;
}

.result {
  margin-top: 10px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
}

.code-container {
  max-height: 500px;
  overflow-y: auto;
  background-color: #282c34;
  border-radius: 4px;
  padding: 15px;
  margin: 10px 0;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.file-name {
  font-weight: bold;
}

.copy-button {
  background-color: #555;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.abi-container, .bytecode-container {
  max-height: 200px;
  overflow-y: auto;
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;
}

.event-item {
  margin-bottom: 15px;
  padding: 15px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.event-block, .event-timestamp {
  color: #666;
  font-size: 14px;
}

.event-data {
  margin: 10px 0;
}

.event-links {
  margin-top: 10px;
}

.event-links a {
  color: #2196f3;
  text-decoration: none;
}

.event-links a:hover {
  text-decoration: underline;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: #666;
}
```

This CSS provides a clean and user-friendly interface for the contract verification and interaction components.
