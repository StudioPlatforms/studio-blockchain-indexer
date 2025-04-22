# EVM Version Support for Contract Verification

This document describes the addition of EVM version support to the contract verification system in the Studio Blockchain Indexer.

## Overview

The contract verification system now supports specifying the EVM version used when compiling the contract. This is important because different EVM versions can produce different bytecode for the same source code, and using the wrong EVM version can cause verification to fail.

## Changes Made

1. Added `evm_version` column to the `contracts` table
2. Updated the `updateContractVerification` method in `ContractsDatabase` to accept an EVM version parameter
3. Updated the `getContractVerification` method in `ContractsDatabase` to return the EVM version
4. Updated the `verifyContract` endpoint in `ContractsApiService` to accept an EVM version parameter
5. Updated the `IDatabase` interface to include the EVM version parameter in the contract verification methods

## Supported EVM Versions

The following EVM versions are supported:

| EVM Version | Ethereum Upgrade | Key Features |
|-------------|------------------|--------------|
| homestead   | Homestead        | Basic EVM functionality |
| tangerineWhistle | Tangerine Whistle | Gas cost changes |
| spuriousDragon | Spurious Dragon | State clearing |
| byzantium   | Byzantium        | REVERT opcode, static calls |
| constantinople | Constantinople | CREATE2, SHL/SHR/SAR opcodes |
| petersburg  | Petersburg       | Fixed Constantinople bugs |
| istanbul    | Istanbul         | Gas cost changes, CHAINID opcode |
| berlin      | Berlin           | Gas cost changes for state access |
| london      | London           | EIP-1559, BASEFEE opcode |
| paris       | The Merge        | Removed difficulty opcode |
| shanghai    | Shanghai         | PUSH0 opcode, warm COINBASE |
| cancun      | Cancun           | EIP-4844, TSTORE/TLOAD opcodes |

The default EVM version is `cancun` if not specified.

## API Changes

### Contract Verification Endpoint

The contract verification endpoint now accepts an `evmVersion` parameter:

```
POST /contracts/verify
```

Request body:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }",
  "compilerVersion": "0.8.0",
  "optimizationUsed": true,
  "runs": 200,
  "constructorArguments": "0x...",
  "contractName": "MyContract",
  "libraries": {
    "MyLibrary": "0x1234567890123456789012345678901234567890"
  },
  "evmVersion": "cancun"
}
```

### Contract Verification Response

The contract verification response now includes the EVM version:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "verified": true,
  "sourceCode": "pragma solidity ^0.8.0; contract MyContract { ... }",
  "compilerVersion": "0.8.0",
  "optimizationUsed": true,
  "runs": 200,
  "evmVersion": "cancun",
  "constructorArguments": "0x...",
  "libraries": {
    "MyLibrary": "0x1234567890123456789012345678901234567890"
  },
  "verifiedAt": "2025-03-27T15:53:08.000Z"
}
```

## Frontend Integration

To integrate EVM version selection in your frontend application, add a dropdown to your contract verification form:

```jsx
function ContractVerificationForm() {
  const [formData, setFormData] = useState({
    // ... other fields
    evmVersion: 'cancun'  // Default to latest
  });
  
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
    { value: 'homestead', label: 'Homestead' }
  ];
  
  return (
    <form onSubmit={handleSubmit}>
      {/* ... other form fields */}
      
      <div>
        <label>EVM Version:</label>
        <select 
          value={formData.evmVersion}
          onChange={(e) => setFormData({...formData, evmVersion: e.target.value})}
        >
          {evmVersions.map(version => (
            <option key={version.value} value={version.value}>
              {version.label}
            </option>
          ))}
        </select>
        <small>
          Select the EVM version used when deploying this contract. 
          Using the wrong version may cause verification to fail.
        </small>
      </div>
      
      {/* ... submit button */}
    </form>
  );
}
```

## Applying the Migration

To apply the migration that adds EVM version support, run the following command:

```bash
./apply-evm-version-migration.sh
```

This will add the `evm_version` column to the `contracts` table and update existing verified contracts to use `cancun` as the default EVM version.
