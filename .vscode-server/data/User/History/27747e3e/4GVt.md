# Frontend Integration Guide for Contract Verification

This guide provides instructions for frontend developers to integrate with the contract verification system in the Studio Blockchain Indexer.

## Overview

The contract verification system allows users to verify smart contracts by submitting the source code, compiler version, and other compilation settings. The frontend should provide a form for users to input these details and submit them to the API.

## API Endpoints

The following API endpoints are available for contract verification:

- `POST /contracts/verify`: Submit a contract for verification
- `GET /contracts/:address/abi`: Get the ABI of a verified contract
- `GET /contracts/:address/source`: Get the source code of a verified contract
- `POST /contracts/:address/interact`: Interact with a verified contract

## Contract Verification Form

The contract verification form should include the following fields:

1. **Contract Address**: The address of the deployed contract
2. **Source Code**: The Solidity source code of the contract
3. **Compiler Version**: The Solidity compiler version used to compile the contract
4. **Contract Name**: The name of the contract to verify (important for files with multiple contracts)
5. **Optimization**: Whether optimization was used during compilation
6. **Optimization Runs**: The number of optimization runs (if optimization was used)
7. **Constructor Arguments**: The ABI-encoded constructor arguments used during deployment (if any)
8. **Libraries**: The addresses of any libraries used by the contract
9. **EVM Version**: The EVM version used during compilation

### Example Form Component (React)

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

// Available compiler versions
const compilerVersions = [
  { value: '0.8.20', label: '0.8.20' },
  { value: '0.8.19', label: '0.8.19' },
  { value: '0.8.18', label: '0.8.18' },
  // Add more versions as needed
];

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
  const [formData, setFormData] = useState({
    address: '',
    sourceCode: '',
    compilerVersion: '0.8.20',
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
        
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Verifying...' : 'Verify Contract'}
        </button>
      </form>
    </div>
  );
}

export default ContractVerificationForm;
```

## Contract Interaction Component

Once a contract is verified, users can interact with it using the contract's ABI. Here's an example component for interacting with a verified contract:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

function ContractInteraction({ contractAddress }) {
  const [abi, setAbi] = useState([]);
  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [params, setParams] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch the contract ABI when the component mounts
    const fetchAbi = async () => {
      try {
        const response = await axios.get(`${API_URL}/contracts/${contractAddress}/abi`);
        setAbi(response.data.abi);
        
        // Extract read methods from the ABI
        const readMethods = response.data.abi.filter(
          (item) =>
            (item.type === 'function' || item.type === undefined) &&
            (item.stateMutability === 'view' || item.stateMutability === 'pure' || item.constant)
        );
        
        setMethods(readMethods);
      } catch (error) {
        setError('Error fetching contract ABI');
      }
    };
    
    if (contractAddress) {
      fetchAbi();
    }
  }, [contractAddress]);

  const handleMethodChange = (e) => {
    const methodName = e.target.value;
    const method = methods.find((m) => m.name === methodName);
    setSelectedMethod(method);
    
    // Initialize params array based on method inputs
    if (method) {
      setParams(method.inputs.map(() => ''));
    } else {
      setParams([]);
    }
    
    // Clear previous results
    setResult(null);
    setError(null);
  };

  const handleParamChange = (index, value) => {
    const newParams = [...params];
    newParams[index] = value;
    setParams(newParams);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Convert params to appropriate types
      const convertedParams = params.map((param, index) => {
        const input = selectedMethod.inputs[index];
        
        // Handle different parameter types
        if (input.type.startsWith('uint')) {
          return param; // The API will handle conversion
        } else if (input.type === 'bool') {
          return param.toLowerCase() === 'true';
        } else if (input.type === 'address') {
          return param;
        } else {
          return param;
        }
      });

      const response = await axios.post(`${API_URL}/contracts/${contractAddress}/interact`, {
        method: selectedMethod.name,
        params: convertedParams,
      });

      setResult(response.data.result);
    } catch (error) {
      setError(
        error.response?.data?.error || 
        error.message || 
        'Error interacting with contract'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!contractAddress) {
    return <p>Please provide a contract address</p>;
  }

  return (
    <div className="contract-interaction">
      <h2>Interact with Contract</h2>
      <p>Contract Address: {contractAddress}</p>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {methods.length === 0 ? (
        <p>Loading contract methods...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="method">Method:</label>
            <select
              id="method"
              onChange={handleMethodChange}
              required
            >
              <option value="">Select a method</option>
              {methods.map((method) => (
                <option key={method.name} value={method.name}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>
          
          {selectedMethod && (
            <>
              {selectedMethod.inputs.length > 0 ? (
                <div className="form-group">
                  <label>Parameters:</label>
                  {selectedMethod.inputs.map((input, index) => (
                    <div key={index} className="param-input">
                      <label>
                        {input.name || `param${index}`} ({input.type}):
                      </label>
                      <input
                        type="text"
                        value={params[index]}
                        onChange={(e) => handleParamChange(index, e.target.value)}
                        placeholder={`${input.type}`}
                        required
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p>This method doesn't require any parameters.</p>
              )}
              
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Calling...' : 'Call Method'}
              </button>
            </>
          )}
        </form>
      )}
      
      {result !== null && (
        <div className="result">
          <h3>Result:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default ContractInteraction;
```

## Contract Source Code Viewer

To display the source code of a verified contract, you can create a component like this:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

function ContractSourceViewer({ contractAddress }) {
  const [sourceCode, setSourceCode] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSourceCode = async () => {
      if (!contractAddress) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`${API_URL}/contracts/${contractAddress}/source`);
        setSourceCode(response.data.sourceCode);
      } catch (error) {
        setError(
          error.response?.data?.error || 
          error.message || 
          'Error fetching contract source code'
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSourceCode();
  }, [contractAddress]);

  if (!contractAddress) {
    return <p>Please provide a contract address</p>;
  }

  if (isLoading) {
    return <p>Loading source code...</p>;
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="contract-source-viewer">
      <h2>Contract Source Code</h2>
      <p>Contract Address: {contractAddress}</p>
      
      <pre className="source-code">{sourceCode}</pre>
    </div>
  );
}

export default ContractSourceViewer;
```

## Integration Tips

1. **Error Handling**: Always handle errors from the API and display meaningful error messages to the user.
2. **Loading States**: Show loading indicators when making API requests to provide feedback to the user.
3. **Validation**: Validate user input before submitting to the API, especially for constructor arguments and library addresses.
4. **Responsive Design**: Ensure the form is usable on both desktop and mobile devices.
5. **Syntax Highlighting**: Consider using a code editor component like Monaco Editor or CodeMirror for the source code input and display.
6. **Persistence**: Consider saving form data to local storage to prevent data loss if the user accidentally navigates away from the page.

## Testing

Before deploying to production, test the integration thoroughly with different types of contracts:

1. Simple contracts without constructor arguments
2. Contracts with constructor arguments
3. Contracts that use libraries
4. Contracts with different optimization settings
5. Contracts compiled with different EVM versions

## Troubleshooting

Common issues and their solutions:

1. **Verification Fails**: Ensure the exact same compiler version, optimization settings, and EVM version are used as when the contract was deployed.
2. **Constructor Arguments**: Make sure constructor arguments are properly ABI-encoded. You can use web3.js or ethers.js to encode them.
3. **Libraries**: Ensure library addresses are correctly specified and in the right format.
4. **CORS Issues**: If you encounter CORS errors, make sure the API server is configured to allow requests from your frontend domain.
