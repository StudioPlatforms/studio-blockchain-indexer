const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API endpoint for contract verification
const API_ENDPOINT = 'https://mainnetindexer.studio-blockchain.com/contracts/verify';

// Function to verify a contract
async function verifyContract(address, sourceCode, compilerVersion, contractName, optimizationUsed, runs, constructorArguments, evmVersion) {
    try {
        console.log(`Verifying contract ${contractName} at ${address}...`);
        
        const response = await axios.post(API_ENDPOINT, {
            address,
            sourceCode,
            compilerVersion,
            contractName,
            optimizationUsed,
            runs,
            constructorArguments,
            evmVersion
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Verification response for ${contractName}:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error verifying contract ${contractName}:`, error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}

// Function to check if a contract is verified
async function isContractVerified(address) {
    try {
        const response = await axios.get(`https://mainnetindexer.studio-blockchain.com/contracts/${address}/verified`);
        return response.data.verified;
    } catch (error) {
        console.error(`Error checking if contract ${address} is verified:`, error.response ? error.response.data : error.message);
        return false;
    }
}

// Sample contract source code for testing
const sampleSourceCode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;
    
    event ValueChanged(uint256 newValue);
    
    constructor(uint256 initialValue) {
        value = initialValue;
    }
    
    function setValue(uint256 newValue) public {
        value = newValue;
        emit ValueChanged(newValue);
    }
    
    function getValue() public view returns (uint256) {
        return value;
    }
}
`;

// Function to load source code from file or use sample code
function loadSourceCode(filePath) {
    try {
        
        // Constructor arguments
        const presaleArgs = '0x000000000000000000000000fccc20bf4f0829e121bc99ff2222456ad4465a1e000000000000000000000000000000000000000000000000000000000000ea600000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000000001176592e000000000000000000000000000000000000000000000108b2a2c28029094000000';
        const rateLimiterArgs = '0x';
        const bridgeArgs = '0x000000000000000000000000000000000000000000000000000000000003aa71000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a4eae86bc4172fa68dbf56140a3a7eb2fadf53b7';
        const erc20HandlerFixedArgs = '0x0000000000000000000000007fd526dc3d193a3da6c330956813a6b358bca1ff0000000000000000000000000000000000000000000000000000000000000064';
        const nativeHandlerArgs = '0x0000000000000000000000007fd526dc3d193a3da6c330956813a6b358bca1ff0000000000000000000000000000000000000000000000000000000000000064';
        const stoRecoveryArgs = '0x';
        
        // Verify StudioPresale contract
        const isPresaleVerified = await isContractVerified(presaleAddress);
        if (!isPresaleVerified) {
            await verifyContract(
                presaleAddress,
                presaleSourceCode,
                '0.8.0',
                'StudioPresale',
                true,
                200,
                presaleArgs,
                'istanbul'
            );
        } else {
            console.log(`StudioPresale contract at ${presaleAddress} is already verified.`);
        }
        
        // Verify RateLimiter contract
        const isRateLimiterVerified = await isContractVerified(rateLimiterAddress);
        if (!isRateLimiterVerified) {
            await verifyContract(
                rateLimiterAddress,
                rateLimiterSourceCode,
                '0.8.0',
                'RateLimiter',
                true,
                200,
                rateLimiterArgs,
                'istanbul'
            );
        } else {
            console.log(`RateLimiter contract at ${rateLimiterAddress} is already verified.`);
        }
        
        // Verify Bridge contract
        const isBridgeVerified = await isContractVerified(bridgeAddress);
        if (!isBridgeVerified) {
            await verifyContract(
                bridgeAddress,
                bridgeSourceCode,
                '0.8.0',
                'Bridge',
                true,
                200,
                bridgeArgs,
                'istanbul'
            );
        } else {
            console.log(`Bridge contract at ${bridgeAddress} is already verified.`);
        }
        
        // Verify ERC20HandlerFixed contract
        const isERC20HandlerFixedVerified = await isContractVerified(erc20HandlerFixedAddress);
        if (!isERC20HandlerFixedVerified) {
            await verifyContract(
                erc20HandlerFixedAddress,
                erc20HandlerFixedSourceCode,
                '0.8.0',
                'ERC20HandlerFixed',
                true,
                200,
                erc20HandlerFixedArgs,
                'istanbul'
            );
        } else {
            console.log(`ERC20HandlerFixed contract at ${erc20HandlerFixedAddress} is already verified.`);
        }
        
        // Verify NativeHandler contract
        const isNativeHandlerVerified = await isContractVerified(nativeHandlerAddress);
        if (!isNativeHandlerVerified) {
            await verifyContract(
                nativeHandlerAddress,
                nativeHandlerSourceCode,
                '0.8.0',
                'NativeHandler',
                true,
                200,
                nativeHandlerArgs,
                'istanbul'
            );
        } else {
            console.log(`NativeHandler contract at ${nativeHandlerAddress} is already verified.`);
        }
        
        // Verify STORecovery contract
        const isSTORecoveryVerified = await isContractVerified(stoRecoveryAddress);
        if (!isSTORecoveryVerified) {
            await verifyContract(
                stoRecoveryAddress,
                stoRecoverySourceCode,
                '0.8.0',
                'STORecovery',
                true,
                200,
                stoRecoveryArgs,
                'istanbul'
            );
        } else {
            console.log(`STORecovery contract at ${stoRecoveryAddress} is already verified.`);
        }
        
        console.log('Contract verification process completed!');
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Run the main function
main().catch(console.error);
