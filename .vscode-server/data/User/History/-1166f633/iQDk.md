# Frontend Integration Guide for Contract Verification

This guide provides comprehensive instructions for frontend developers on how to integrate with the Studio Blockchain Indexer's contract verification system, including how to fetch compiler versions, submit verification requests, and display verification results.

## 1. Fetching Solidity Compiler Versions

Since the API doesn't provide an endpoint for available compiler versions, you'll need to fetch them from the Solidity releases repository.

### Option 1: Fetch from Solidity Binaries Repository

```javascript
import axios from 'axios';

async function fetchCompilerVersions() {
  try {
    const response = await axios.get('https://binaries.soliditylang.org/bin/list.json');
    const data = response.data;
    
    // Extract release versions (excluding nightly builds)
    const versions = Object.keys(data.releases).map(version => ({
      value: version,
      label: version
    }));
    
    // Sort versions in descending order (newest first)
    versions.sort((a, b) => {
      const versionA = a.value.split('.').map(Number);
      const versionB = b.value.split('.').map(Number);
      
      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0;
        const numB = versionB[i] || 0;
        if (numA !== numB) {
          return numB - numA;
        }
      }
      
      return 0;
    });
    
    return versions;
  } catch (error) {
    console.error('Error fetching compiler versions:', error);
    
    // Fallback to a default list if the fetch fails
    return [
      { value: '0.8.20', label: '0.8.20' },
      { value: '0.8.19', label: '0.8.19' },
      { value: '0.8.18', label: '0.8.18' },
      { value: '0.8.17', label: '0.8.17' },
      { value: '0.8.16', label: '0.8.16' },
      { value: '0.8.15', label: '0.8.15' },
      { value: '0.8.14', label: '0.8.14' },
      { value: '0.8.13', label: '0.8.13' },
      { value: '0.8.12', label: '0.8.12' },
      { value: '0.8.11', label: '0.8.11' },
      { value: '0.8.10', label: '0.8.10' },
      { value: '0.8.9', label: '0.8.9' },
      { value: '0.8.8', label: '0.8.8' },
      { value: '0.8.7', label: '0.8.7' },
      { value: '0.8.6', label: '0.8.6' },
      { value: '0.8.5', label: '0.8.5' },
      { value: '0.8.4', label: '0.8.4' },
      { value: '0.8.3', label: '0.8.3' },
      { value: '0.8.2', label: '0.8.2' },
      { value: '0.8.1', label: '0.8.1' },
      { value: '0.8.0', label: '0.8.0' },
      { value: '0.7.6', label: '0.7.6' },
      { value: '0.7.5', label: '0.7.5' },
      { value: '0.7.4', label: '0.7.4' },
      { value: '0.7.3', label: '0.7.3' },
      { value: '0.7.2', label: '0.7.2' },
      { value: '0.7.1', label: '0.7.1' },
      { value: '0.7.0', label: '0.7.0' },
      { value: '0.6.12', label: '0.6.12' },
      { value: '0.6.11', label: '0.6.11' },
      { value: '0.6.10', label: '0.6.10' },
      { value: '0.6.9', label: '0.6.9' },
      { value: '0.6.8', label: '0.6.8' },
      { value: '0.6.7', label: '0.6.7' },
      { value: '0.6.6', label: '0.6.6' },
      { value: '0.6.5', label: '0.6.5' },
      { value: '0.6.4', label: '0.6.4' },
      { value: '0.6.3', label: '0.6.3' },
      { value: '0.6.2', label: '0.6.2' },
      { value: '0.6.1', label: '0.6.1' },
      { value: '0.6.0', label: '0.6.0' },
      { value: '0.5.17', label: '0.5.17' },
      { value: '0.5.16', label: '0.5.16' },
      { value: '0.5.15', label: '0.5.15' },
      { value: '0.5.14', label: '0.5.14' },
      { value: '0.5.13', label: '0.5.13' },
      { value: '0.5.12', label: '0.5.12' },
      { value: '0.5.11', label: '0.5.11' },
      { value: '0.5.10', label: '0.5.10' },
      { value: '0.5.9', label: '0.5.9' },
      { value: '0.5.8', label: '0.5.8' },
      { value: '0.5.7', label: '0.5.7' },
      { value: '0.5.6', label: '0.5.6' },
      { value: '0.5.5', label: '0.5.5' },
      { value: '0.5.4', label: '0.5.4' },
      { value: '0.5.3', label: '0.5.3' },
      { value: '0.5.2', label: '0.5.2' },
      { value: '0.5.1', label: '0.5.1' },
      { value: '0.5.0', label: '0.5.0' },
      { value: '0.4.26', label: '0.4.26' },
      { value: '0.4.25', label: '0.4.25' },
      { value: '0.4.24', label: '0.4.24' },
      { value: '0.4.23', label: '0.4.23' },
      { value: '0.4.22', label: '0.4.22' },
      { value: '0.4.21', label: '0.4.21' },
      { value: '0.4.20', label: '0.4.20' },
      { value: '0.4.19', label: '0.4.19' },
      { value: '0.4.18', label: '0.4.18' },
      { value: '0.4.17', label: '0.4.17' },
      { value: '0.4.16', label: '0.4.16' },
      { value: '0.4.15', label: '0.4.15' },
      { value: '0.4.14', label: '0.4.14' },
      { value: '0.4.13', label: '0.4.13' },
      { value: '0.4.12', label: '0.4.12' },
      { value: '0.4.11', label: '0.4.11' },
      { value: '0.4.10', label: '0.4.10' },
      { value: '0.4.9', label: '0.4.9' },
      { value: '0.4.8', label: '0.4.8' },
      { value: '0.4.7', label: '0.4.7' },
      { value: '0.4.6', label: '0.4.6' },
      { value: '0.4.5', label: '0.4.5' },
      { value: '0.4.4', label: '0.4.4' },
      { value: '0.4.3', label: '0.4.3' },
      { value: '0.4.2', label: '0.4.2' },
      { value: '0.4.1', label: '0.4.1' },
      { value: '0.4.0', label: '0.4.0' }
    ];
  }
}
```

### Option 2: Use a Static List with Commit Hashes

For more precise verification, you might want to include commit hashes:

```javascript
const compilerVersions = [
  { value: '0.8.20+commit.a1b79de6', label: '0.8.20' },
  { value: '0.8.19+commit.7dd6d404', label: '0.8.19' },
  { value: '0.8.18+commit.87f61d96', label: '0.8.18' },
  { value: '0.8.17+commit.8df45f5f', label: '0.8.17' },
  { value: '0.8.16+commit.07a7930e', label: '0.8.16' },
  { value: '0.8.15+commit.e14f2714', label: '0.8.15' },
  { value: '0.8.14+commit.80d49f37', label: '0.8.14' },
  { value: '0.8.13+commit.abaa5c0e', label: '0.8.13' },
  { value: '0.8.12+commit.f00d7308', label: '0.8.12' },
  { value: '0.8.11+commit.d7f03943', label: '0.8.11' },
  { value: '0.8.10+commit.fc410830', label: '0.8.10' },
  { value: '0.8.9+commit.e5eed63a', label: '0.8.9' },
  { value: '0.8.8+commit.dddeac2f', label: '0.8.8' },
  { value: '0.8.7+commit.e28d00a7', label: '0.8.7' },
  { value: '0.8.6+commit.11564f7e', label: '0.8.6' },
  { value: '0.8.5+commit.a4f2e591', label: '0.8.5' },
  { value: '0.8.4+commit.c7e474f2', label: '0.8.4' },
  { value: '0.8.3+commit.8d00100c', label: '0.8.3' },
  { value: '0.8.2+commit.661d1103', label: '0.8.2' },
  { value: '0.8.1+commit.df193b15', label: '0.8.1' },
  { value: '0.8.0+commit.c7dfd78e', label: '0.8.0' },
  { value: '0.7.6+commit.7338295f', label: '0.7.6' },
  { value: '0.7.5+commit.eb77ed08', label: '0.7.5' },
  { value: '0.7.4+commit.3f05b770', label: '0.7.4' },
  { value: '0.7.3+commit.9bfce1f6', label: '0.7.3' },
  { value: '0.7.2+commit.51b20bc0', label: '0.7.2' },
  { value: '0.7.1+commit.f4a555be', label: '0.7.1' },
  { value: '0.7.0+commit.9e61f92b', label: '0.7.0' },
  { value: '0.6.12+commit.27d51765', label: '0.6.12' },
  { value: '0.6.11+commit.5ef660b1', label: '0.6.11' },
  { value: '0.6.10+commit.00c0fcaf', label: '0.6.10' },
  { value: '0.6.9+commit.3e3065ac', label: '0.6.9' },
  { value: '0.6.8+commit.0bbfe453', label: '0.6.8' },
  { value: '0.6.7+commit.b8d736ae', label: '0.6.7' },
  { value: '0.6.6+commit.6c089d02', label: '0.6.6' },
  { value: '0.6.5+commit.f956cc89', label: '0.6.5' },
  { value: '0.6.4+commit.1dca32f3', label: '0.6.4' },
  { value: '0.6.3+commit.8dda9521', label: '0.6.3' },
  { value: '0.6.2+commit.bacdbe57', label: '0.6.2' },
  { value: '0.6.1+commit.e6f7d5a4', label: '0.6.1' },
  { value: '0.6.0+commit.26b70077', label: '0.6.0' },
  { value: '0.5.17+commit.d19bba13', label: '0.5.17' },
  { value: '0.5.16+commit.9c3226ce', label: '0.5.16' },
  { value: '0.5.15+commit.6a57276f', label: '0.5.15' },
  { value: '0.5.14+commit.01f1aaa4', label: '0.5.14' },
  { value: '0.5.13+commit.5b0b510c', label: '0.5.13' },
  { value: '0.5.12+commit.7709ece9', label: '0.5.12' },
  { value: '0.5.11+commit.c082d0b4', label: '0.5.11' },
  { value: '0.5.10+commit.5a6ea5b1', label: '0.5.10' },
  { value: '0.5.9+commit.e560f70d', label: '0.5.9' },
  { value: '0.5.8+commit.23d335f2', label: '0.5.8' },
  { value: '0.5.7+commit.6da8b019', label: '0.5.7' },
  { value: '0.5.6+commit.b259423e', label: '0.5.6' },
  { value: '0.5.5+commit.47a71e8f', label: '0.5.5' },
  { value: '0.5.4+commit.9549d8ff', label: '0.5.4' },
  { value: '0.5.3+commit.10d17f24', label: '0.5.3' },
  { value: '0.5.2+commit.1df8f40c', label: '0.5.2' },
  { value: '0.5.1+commit.c8a2cb62', label: '0.5.1' },
  { value: '0.5.0+commit.1d4f565a', label: '0.5.0' },
  { value: '0.4.26+commit.4563c3fc', label: '0.4.26' },
  { value: '0.4.25+commit.59dbf8f1', label: '0.4.25' },
  { value: '0.4.24+commit.e67f0147', label: '0.4.24' },
  { value: '0.4.23+commit.124ca40d', label: '0.4.23' },
  { value: '0.4.22+commit.4cb486ee', label: '0.4.22' },
  { value: '0.4.21+commit.dfe3193c', label: '0.4.21' },
  { value: '0.4.20+commit.3155dd80', label: '0.4.20' },
  { value: '0.4.19+commit.c4cbbb05', label: '0.4.19' },
  { value: '0.4.18+commit.9cf6e910', label: '0.4.18' },
  { value: '0.4.17+commit.bdeb9e52', label: '0.4.17' },
  { value: '0.4.16+commit.d7661dd9', label: '0.4.16' },
  { value: '0.4.15+commit.bbb8e64f', label: '0.4.15' },
  { value: '0.4.14+commit.c2215d46', label: '0.4.14' },
  { value: '0.4.13+commit.0fb4cb1a', label: '0.4.13' },
  { value: '0.4.12+commit.194ff033', label: '0.4.12' },
  { value: '0.4.11+commit.68ef5810', label: '0.4.11' }
];
```

## 2. Implementing the Contract Verification Form

Here's an enhanced version of the contract verification form that includes fetching compiler versions:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

// Available EVM versions
const evmVersions = [
  { value: 'cancun', label: 'Cancun (Default)' },
  { value: 'shanghai', label: 'Shanghai' },
  { value: 'paris', label: 'Paris (The Merge)' },
  { value: 'london', label: 'London' },
  { value: 'berlin', label: 'Berlin' },
  { value: 'istanbul', label: 'Istanbul' },
  { value: 'petersburg', label: 'Petersburg' },
  { value: 'constantinople', label: 'Constantinople' },
  { value: 'byzantium', label: 'Byzantium' },
  { value: 'spuriousDragon', label: 'Spurious Dragon' },
  { value: 'tangerineWhistle', label: 'Tangerine Whistle' },
  { value: 'homestead', label: 'Homestead' },
];

function ContractVerificationForm() {
  const [compilerVersions, setCompilerVersions] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  
  const [formData, setFormData] = useState({
    address: '',
    sourceCode: '',
    compilerVersion: '',
    contractName: '',
    optimizationUsed: false,
    runs: 200,
    constructorArguments: '',
    libraries: {},
    evmVersion: 'cancun',
  });

  const [libraryInputs, setLibraryInputs] = useState([{ name: '', address: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch compiler versions when component mounts
  useEffect(() => {
    async function loadCompilerVersions() {
      setIsLoadingVersions(true);
      try {
        const response = await axios.get('https://binaries.soliditylang.org/bin/list.json');
        const data = response.data;
        
        // Extract release versions (excluding nightly builds)
        const versions = Object.keys(data.releases).map(version => ({
          value: version,
          label: version
        }));
        
        // Sort versions in descending order (newest first)
        versions.sort((a, b) => {
          const versionA = a.value.split('.').map(Number);
          const versionB = b.value.split('.').map(Number);
          
          for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
            const numA = versionA[i] || 0;
            const numB = versionB[i] || 0;
            if (numA !== numB) {
              return numB - numA;
            }
          }
          
          return 0;
        });
        
        setCompilerVersions(versions);
        
        // Set default compiler version to the newest one
        if (versions.length > 0) {
          setFormData(prev => ({
            ...prev,
            compilerVersion: versions[0].value
          }));
        }
      } catch (error) {
        console.error('Error fetching compiler versions:', error);
        // Fallback to a minimal list
        const fallbackVersions = [
          { value: '0.8.20', label: '0.8.20' },
          { value: '0.8.19', label: '0.8.19' },
          { value: '0.8.18', label: '0.8.18' },
          { value: '0.8.0', label: '0.8.0' },
          { value: '0.7.6', label: '0.7.6' },
          { value: '0.6.12', label: '0.6.12' },
          { value: '0.5.17', label: '0.5.17' },
          { value: '0.4.26', label: '0.4.26' },
          { value: '0.4.17', label: '0.4.17' },
        ];
        setCompilerVersions(fallbackVersions);
        setFormData(prev => ({
          ...prev,
          compilerVersion: '0.8.20'
        }));
      } finally {
        setIsLoadingVersions(false);
      }
    }
    
    loadCompilerVersions();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleLibraryChange = (index, field, value) => {
    const newLibraryInputs = [...libraryInputs];
    newLibraryInputs[index][field] = value;
    setLibraryInputs(newLibraryInputs);

    // Update libraries object in formData
    const libraries = {};
    newLibraryInputs.forEach((lib) => {
      if (lib.name && lib.address) {
        libraries[lib.name] = lib.address;
      }
    });
    setFormData({ ...formData, libraries });
  };

  const addLibraryInput = () => {
    setLibraryInputs([...libraryInputs, { name: '', address: '' }]);
  };

  const removeLibraryInput = (index) => {
    const newLibraryInputs = [...libraryInputs];
    newLibraryInputs.splice(index, 1);
    setLibraryInputs(newLibraryInputs);

    // Update libraries object in formData
    const libraries = {};
    newLibraryInputs.forEach((lib) => {
      if (lib.name && lib.address) {
        libraries[lib.name] = lib.address;
      }
    });
    setFormData({ ...formData, libraries });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${API_URL}/contracts/verify`, formData);
      setResult(response.data);
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

  return (
    <div className="contract-verification-form">
      <h2>Verify Contract</h2>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="success-message">
          <h3>Contract Verified Successfully!</h3>
          <p>Address: {result.address}</p>
          {result.abi && (
            <div>
              <h4>Contract ABI:</h4>
              <pre>{JSON.stringify(result.abi, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="address">Contract Address:</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            placeholder="0x..."
          />
          <small>The address of the deployed contract</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="contractName">Contract Name:</label>
          <input
            type="text"
            id="contractName"
            name="contractName"
            value={formData.contractName}
            onChange={handleChange}
            required
            placeholder="MyContract"
          />
          <small>The name of the contract to verify (case-sensitive)</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="compilerVersion">Compiler Version:</label>
          {isLoadingVersions ? (
            <p>Loading compiler versions...</p>
          ) : (
            <select
              id="compilerVersion"
              name="compilerVersion"
              value={formData.compilerVersion}
              onChange={handleChange}
              required
            >
              {compilerVersions.map((version) => (
                <option key={version.value} value={version.value}>
                  {version.label}
                </option>
              ))}
            </select>
          )}
          <small>The Solidity compiler version used to compile the contract</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="evmVersion">EVM Version:</label>
          <select
            id="evmVersion"
            name="evmVersion"
            value={formData.evmVersion}
            onChange={handleChange}
          >
            {evmVersions.map((version) => (
              <option key={version.value} value={version.value}>
                {version.label}
              </option>
            ))}
          </select>
          <small>The EVM version used during compilation</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="optimizationUsed">Optimization:</label>
          <input
            type="checkbox"
            id="optimizationUsed"
            name="optimizationUsed"
            checked={formData.optimizationUsed}
            onChange={handleChange}
          />
          <small>Whether optimization was used during compilation</small>
        </div>
        
        {formData.optimizationUsed && (
          <div className="form-group">
            <label htmlFor="runs">Optimization Runs:</label>
            <input
              type="number"
              id="runs"
              name="runs"
              value={formData.runs}
              onChange={handleChange}
              min="1"
              required={formData.optimizationUsed}
            />
            <small>The number of optimization runs</small>
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="constructorArguments">Constructor Arguments (ABI-encoded):</label>
          <input
            type="text"
            id="constructorArguments"
            name="constructorArguments"
            value={formData.constructorArguments}
            onChange={handleChange}
            placeholder="0x..."
          />
          <small>The ABI-encoded constructor arguments used during deployment (if any)</small>
        </div>
        
        <div className="form-group">
          <label>Libraries:</label>
          {libraryInputs.map((lib, index) => (
            <div key={index} className="library-input">
              <input
                type="text"
                placeholder="Library Name"
                value={lib.name}
                onChange={(e) => handleLibraryChange(index, 'name', e.target.value)}
              />
              <input
                type="text"
                placeholder="Library Address (0x...)"
                value={lib.address}
                onChange={(e) => handleLibraryChange(index, 'address', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeLibraryInput(index)}
                disabled={libraryInputs.length === 1 && !lib.name && !lib.address}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addLibraryInput}>
            Add Library
          </button>
          <small>The addresses of any libraries used by the contract</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="sourceCode">Source Code:</label>
          <textarea
            id="sourceCode"
            name="sourceCode"
            value={formData.sourceCode}
            onChange={handleChange}
            required
            rows="15"
            placeholder="// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    // Your contract code here
}"
          ></textarea>
          <small>The Solidity source code of the contract</small>
        </div>
        
        <button type="submit" disabled={isSubmitting || isLoadingVersions}>
          {isSubmitting ? 'Verifying...' : 'Verify Contract'}
        </button>
      </form>
    </div>
  );
}

export default ContractVerificationForm;
```

## 3. Encoding Constructor Arguments

For contracts with constructor arguments, you'll need to ABI-encode them. Here's a utility function using ethers.js:

```javascript
import { ethers } from 'ethers';

/**
 * Encode constructor arguments for contract verification
 * @param {Array} types - Array of parameter types (e.g., ['uint256', 'string', 'address'])
 * @param {Array} values - Array of parameter values (e.g., [100, 'Hello', '0x1234...'])
 * @returns {string} - ABI-encoded constructor arguments as a hex string
 */
function encodeConstructorArgs(types, values) {
  if (types.length !== values.length) {
    throw new Error('Types and values arrays must have the same length');
  }
  
  // Create ABI coder instance
  const abiCoder = new ethers.utils.AbiCoder();
