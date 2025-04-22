# API Endpoints Check for Contract Verification

After reviewing the codebase, I've identified a potential issue with the API endpoints for verified contracts. Let me explain what I found and provide a solution.

## Current Implementation

The current implementation has the following endpoints for contract verification:

1. `/contracts/verify` - POST endpoint to verify a contract
2. `/contracts/:address/abi` - GET endpoint to retrieve the ABI of a contract
3. `/contracts/:address/source` - GET endpoint to retrieve the source code of a contract
4. `/contracts/:address/interact` - POST endpoint to interact with a contract

However, there's no explicit endpoint to check if a contract is verified (`/contracts/:address/verified`), which is referenced in our frontend integration guides.

## How Verification Data is Stored

Contract verification data is stored in the `contracts` table with the following fields:

- `verified` - Boolean indicating if the contract is verified
- `source_code` - The source code of the contract
- `abi` - The ABI of the contract
- `compiler_version` - The compiler version used
- `optimization_used` - Whether optimization was used
- `runs` - The number of optimization runs
- `constructor_arguments` - The constructor arguments
- `libraries` - The libraries used
- `evm_version` - The EVM version used
- `verified_at` - When the contract was verified

## How Verification Data is Retrieved

The `getContractVerification` method in `ContractsDatabase` retrieves the verification data:

```typescript
async getContractVerification(address: string): Promise<{
    verified: boolean;
    sourceCode?: string;
    abi?: any;
    compilerVersion?: string;
    optimizationUsed?: boolean;
    runs?: number;
    constructorArguments?: string;
    libraries?: any;
    evmVersion?: string;
    verifiedAt?: Date;
} | null>
```

## The Issue

The issue is that there's no explicit endpoint to check if a contract is verified. The frontend is trying to call `/contracts/:address/verified`, but this endpoint doesn't exist in the API.

Additionally, the existing endpoints have some issues:

1. `/contracts/:address/abi` - Returns a placeholder ABI if the contract is not verified, instead of indicating that the contract is not verified
2. `/contracts/:address/source` - Returns a placeholder source code if the contract is not verified, instead of indicating that the contract is not verified

## Solution

We need to add a new endpoint to check if a contract is verified, and fix the existing endpoints to properly indicate when a contract is not verified.

### 1. Add a New Endpoint to Check if a Contract is Verified

Add the following code to the `setupRoutes` method in `ContractsApiService`:

```typescript
// Check if a contract is verified
this.app.get('/contracts/:address/verified', this.isContractVerified.bind(this));
```

And add the following method to `ContractsApiService`:

```typescript
/**
 * Check if a contract is verified
 */
private async isContractVerified(req: express.Request, res: express.Response) {
    try {
        const address = req.params.address.toLowerCase();
        
        // Check if it's a contract
        const isContract = await blockchain.isContract(address);
        
        if (!isContract) {
            return formatResponse(res, { 
                verified: false,
                error: 'Not a contract address' 
            });
        }
        
        // Get the contract verification data
        const verification = await this.database.getContractVerification(address);
        
        // Return whether the contract is verified
        return formatResponse(res, {
            verified: verification ? verification.verified : false
        });
    } catch (error) {
        return handleError(res, error, 'Error checking if contract is verified');
    }
}
```

### 2. Fix the ABI Endpoint

Modify the `getContractABI` method to return a 404 error if the contract is not verified:

```typescript
/**
 * Get the ABI of a verified contract
 */
private async getContractABI(req: express.Request, res: express.Response) {
    try {
        const address = req.params.address.toLowerCase();
        
        // Check if it's a contract
        const isContract = await blockchain.isContract(address);
        
        if (!isContract) {
            return formatResponse(res, { error: 'Not a contract address' }, 404);
        }
