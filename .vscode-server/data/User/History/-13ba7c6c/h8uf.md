# Contract Verification Persistence Guide

This guide addresses how to properly check and persist contract verification status in your frontend application, ensuring that once a contract is verified, it remains marked as verified across page reloads and navigation.

## Understanding Verification Persistence

When a contract is successfully verified, the verification data is stored in the Studio Blockchain Indexer's database. This means the contract will remain verified indefinitely unless the database is reset or the verification record is explicitly deleted.

The issue you're experiencing where the page resets and you have to verify again is likely due to one of these frontend implementation issues:

1. Not checking the verification status when loading the contract page
2. Not properly handling page navigation or reloads
3. Not persisting the verification state in the frontend

## Checking Verification Status

The first step is to always check if a contract is already verified when loading a contract page:

```javascript
// API endpoint to check verification status
const API_URL = 'http://localhost:3000';

async function isContractVerified(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/verified`);
    return response.data.verified;
  } catch (error) {
    console.error('Error checking contract verification status:', error);
    return false;
  }
}

// Example React component for a contract page
function ContractPage({ match }) {
  const { address } = match.params;
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check verification status when component mounts or address changes
  useEffect(() => {
    async function checkVerificationStatus() {
      setIsLoading(true);
      const verified = await isContractVerified(address);
      setIsVerified(verified);
      setIsLoading(false);
    }
    
    checkVerificationStatus();
  }, [address]);
  
  // Render appropriate UI based on verification status
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      {isVerified ? (
        <VerifiedContractView address={address} />
      ) : (
        <VerificationForm address={address} onVerified={() => setIsVerified(true)} />
      )}
    </div>
  );
}
```

## Handling Page Navigation and Reloads

To ensure the verification status persists across page navigation and reloads, you have several options:

### 1. Use React Router with State

If you're using React Router, you can pass state when navigating to the contract page:

```javascript
// After successful verification
history.push({
  pathname: `/address/${contractAddress}`,
  state: { verified: true }
});

// In the contract page component
function ContractPage({ location, match }) {
  const { address } = match.params;
  const [isVerified, setIsVerified] = useState(location.state?.verified || false);
  
  // Still check with the API to be sure
  useEffect(() => {
    async function checkVerificationStatus() {
      if (!isVerified) { // Only check if not already marked as verified
        const verified = await isContractVerified(address);
        setIsVerified(verified);
      }
    }
    
    checkVerificationStatus();
  }, [address, isVerified]);
  
  // Rest of the component...
}
```

### 2. Use Local Storage

You can use local storage to persist verification status across page reloads:

```javascript
// After successful verification
localStorage.setItem(`contract-verified-${contractAddress}`, 'true');

// In the contract page component
function ContractPage({ match }) {
  const { address } = match.params;
  const [isVerified, setIsVerified] = useState(
    localStorage.getItem(`contract-verified-${address}`) === 'true'
  );
  
  // Still check with the API to be sure
  useEffect(() => {
    async function checkVerificationStatus() {
      const verified = await isContractVerified(address);
      setIsVerified(verified);
      
      // Update local storage
      if (verified) {
        localStorage.setItem(`contract-verified-${address}`, 'true');
      }
    }
    
    checkVerificationStatus();
  }, [address]);
  
  // Rest of the component...
}
```

### 3. Use a Global State Management Solution

If you're using Redux, Zustand, or another state management library, you can store verification status there:

```javascript
// Redux action
const setContractVerified = (address, verified) => ({
  type: 'SET_CONTRACT_VERIFIED',
  payload: { address, verified }
});

// Redux reducer
const contractsReducer = (state = {}, action) => {
  switch (action.type) {
    case 'SET_CONTRACT_VERIFIED':
      return {
        ...state,
        [action.payload.address]: {
          ...state[action.payload.address],
          verified: action.payload.verified
        }
      };
    default:
      return state;
  }
};

// In the contract page component
function ContractPage({ match, dispatch, contracts }) {
  const { address } = match.params;
  const contractData = contracts[address] || {};
  const [isVerified, setIsVerified] = useState(contractData.verified || false);
  
  useEffect(() => {
    async function checkVerificationStatus() {
      const verified = await isContractVerified(address);
      setIsVerified(verified);
      dispatch(setContractVerified(address, verified));
    }
    
    if (!contractData.verified) {
      checkVerificationStatus();
    }
  }, [address, contractData.verified, dispatch]);
  
  // Rest of the component...
}

// Connect to Redux
const mapStateToProps = (state) => ({
  contracts: state.contracts
});

export default connect(mapStateToProps)(ContractPage);
```

## Handling Successful Verification

When a contract is successfully verified, you should:

1. Update the local state to reflect the verification
2. Persist the verification status (if using local storage or state management)
3. Fetch the contract details, source code, and ABI
4. Switch to the verified contract view

```javascript
async function handleVerificationSubmit(formData) {
  try {
    setIsSubmitting(true);
    const result = await verifyContract(formData);
    
    if (result.success) {
      // Update local state
      setIsVerified(true);
      
      // Persist verification status
      localStorage.setItem(`contract-verified-${formData.address}`, 'true');
      
      // Fetch contract data
      const [details, source, abi] = await Promise.all([
        getContractDetails(formData.address),
        getContractSource(formData.address),
        getContractABI(formData.address)
      ]);
      
      // Update contract data state
      setContractData({ details, source, abi });
      
      // Switch to verified view
      setActiveView('details');
      
      // Show success message
      toast.success('Contract verified successfully!');
    } else {
      // Handle verification failure
      setError(result.message);
    }
  } catch (error) {
    setError(error.message || 'Verification failed');
  } finally {
    setIsSubmitting(false);
  }
}
```

## Implementing a Complete Solution

Here's a complete example of a React component that handles contract verification persistence properly:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

const API_URL = 'http://localhost:3000';

// API functions
async function isContractVerified(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/verified`);
    return response.data.verified;
  } catch (error) {
    console.error('Error checking contract verification status:', error);
    return false;
  }
}

async function verifyContract(verificationData) {
  try {
    const response = await axios.post(`${API_URL}/contracts/verify`, verificationData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
}

async function getContractDetails(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract details:', error);
    throw error;
  }
}

async function getContractSource(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/source`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract source:', error);
    throw error;
  }
}

async function getContractABI(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/abi`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contract ABI:', error);
    throw error;
  }
}

// Contract page component
function ContractPage() {
  const { address } = useParams();
  const history = useHistory();
  
  // State
  const [isVerified, setIsVerified] = useState(
    localStorage.getItem(`contract-verified-${address}`) === 'true'
  );
  const [isCheckingVerification, setIsCheckingVerification] = useState(true);
  const [activeView, setActiveView] = useState('verify');
  const [contractData, setContractData] = useState(null);
  
  // Check verification status on mount
  useEffect(() => {
    async function checkVerificationStatus() {
      setIsCheckingVerification(true);
      try {
        const verified = await isContractVerified(address);
        
        // Update state and localStorage
        setIsVerified(verified);
        if (verified) {
          localStorage.setItem(`contract-verified-${address}`, 'true');
          setActiveView('details');
          await fetchContractData();
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
      } finally {
        setIsCheckingVerification(false);
      }
    }
    
    checkVerificationStatus();
  }, [address]);
  
  // Fetch contract data
  async function fetchContractData() {
    try {
      const [details, source, abi] = await Promise.all([
        getContractDetails(address),
        getContractSource(address),
        getContractABI(address)
      ]);
      
      setContractData({ details, source, abi });
    } catch (error) {
      console.error('Error fetching contract data:', error);
      toast.error('Error loading contract data');
    }
  }
  
  // Handle verification form submission
  async function handleVerificationSubmit(formData) {
    try {
      const result = await verifyContract(formData);
      
      if (result.success) {
        // Update state and localStorage
        setIsVerified(true);
        localStorage.setItem(`contract-verified-${address}`, 'true');
        
        // Fetch contract data
        await fetchContractData();
        
        // Switch view
        setActiveView('details');
        
        // Show success message
        toast.success('Contract verified successfully!');
        
        // Update URL without reloading the page
        history.replace(`/address/${address}`);
      } else {
        toast.error(result.message || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.message || 'Verification failed');
    }
  }
  
  // Loading state
  if (isCheckingVerification) {
    return <div>Checking contract verification status...</div>;
  }
  
  // Render
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
            className={activeView === 'verify' ? 'active' : ''} 
            onClick={() => setActiveView('verify')}
          >
            Verify Contract
          </button>
        )}
        
        {isVerified && (
          <>
            <button 
              className={activeView === 'details' ? 'active' : ''} 
              onClick={() => setActiveView('details')}
            >
              Contract Details
            </button>
            <button 
              className={activeView === 'read' ? 'active' : ''} 
              onClick={() => setActiveView('read')}
            >
              Read Contract
            </button>
            <button 
              className={activeView === 'write' ? 'active' : ''} 
              onClick={() => setActiveView('write')}
            >
              Write Contract
            </button>
            <button 
              className={activeView === 'code' ? 'active' : ''} 
              onClick={() => setActiveView('code')}
            >
              Contract Code
            </button>
            <button 
              className={activeView === 'events' ? 'active' : ''} 
              onClick={() => setActiveView('events')}
            >
              Events
            </button>
          </>
        )}
      </div>
      
      <div className="tab-content">
        {!isVerified && activeView === 'verify' && (
          <VerificationForm 
            address={address} 
            onSubmit={handleVerificationSubmit} 
          />
        )}
        
        {isVerified && (
          <>
            {activeView === 'details' && contractData && (
              <ContractDetailsView data={contractData.details} />
            )}
            {activeView === 'read' && contractData && (
              <ReadContractView abi={contractData.abi} address={address} />
            )}
            {activeView === 'write' && contractData && (
              <WriteContractView abi={contractData.abi} address={address} />
            )}
            {activeView === 'code' && contractData && (
              <ContractCodeView source={contractData.source} />
            )}
            {activeView === 'events' && contractData && (
              <ContractEventsView address={address} abi={contractData.abi} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ContractPage;
```

## Troubleshooting Common Issues

### 1. Page Resets After Verification

If the page resets after verification, it could be due to:

- **Full Page Reload**: Using `window.location.href` instead of React Router's `history.push`
- **Form Submission**: Not preventing the default form submission behavior with `e.preventDefault()`
- **API Error Handling**: Not properly handling API errors, causing the page to reset

Solution:
```javascript
const handleSubmit = async (e) => {
  e.preventDefault(); // Prevent default form submission
  
  try {
    const result = await verifyContract(formData);
    // Handle success...
  } catch (error) {
    // Handle error...
  }
};
```

### 2. Verification Status Not Persisting

If the verification status is not persisting across page reloads, check:

- **Local Storage**: Make sure you're correctly storing and retrieving from localStorage
- **API Calls**: Ensure the API call to check verification status is working correctly
- **State Management**: If using Redux or similar, make sure the state is being properly updated and persisted

Solution:
```javascript
// After successful verification
localStorage.setItem(`contract-verified-${address}`, 'true');

// When loading the page
const storedVerification = localStorage.getItem(`contract-verified-${address}`);
const initialVerified = storedVerification === 'true';
```

### 3. API Endpoint Not Responding

If the API endpoint to check verification status is not responding:

- **Server Running**: Make sure the Studio Blockchain Indexer is running
- **API URL**: Check that the API URL is correct
- **CORS**: Ensure CORS is properly configured if the frontend and backend are on different domains

Solution:
```javascript
// Add error handling to API calls
async function isContractVerified(address) {
  try {
    const response = await axios.get(`${API_URL}/contracts/${address}/verified`);
    return response.data.verified;
  } catch (error) {
    console.error('Error checking contract verification status:', error);
    // Log detailed error information
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    return false; // Default to not verified on error
  }
}
```

## Conclusion

By implementing these patterns, you can ensure that contract verification status persists across page reloads and navigation. The key points are:

1. Always check the verification status when loading a contract page
2. Persist the verification status using localStorage, state management, or URL parameters
3. Handle page navigation properly to avoid full page reloads
4. Implement proper error handling for API calls

This approach ensures that once a contract is verified, it remains marked as verified in your frontend application, providing a seamless user experience.
