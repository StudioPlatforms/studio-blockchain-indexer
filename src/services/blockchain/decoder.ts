import { ethers } from 'ethers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('blockchain:decoder');

/**
 * Service for decoding transaction data
 */
export class TransactionDecoder {
    /**
     * Decode transaction data using the contract ABI
     * @param data The transaction data to decode
     * @param abi The contract ABI
     * @returns The decoded transaction data
     */
    decodeTransactionData(data: string, abi: any[]): {
        functionName: string;
        functionSignature: string;
        params: any[];
        paramTypes: string[];
        paramNames: string[];
    } | null {
        try {
            if (!data || data === '0x' || data.length < 10) {
                return null;
            }

            // Get the function selector (first 4 bytes of the data)
            const functionSelector = data.slice(0, 10);

            // Find the function in the ABI that matches the selector
            const functionAbi = abi.find((item) => {
                if (item.type !== 'function') {
                    return false;
                }

                // Create the function signature
                const signature = `${item.name}(${item.inputs.map((input: any) => input.type).join(',')})`;
                
                // Calculate the function selector
                const calculatedSelector = '0x' + ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature)).slice(2, 10);
                
                return calculatedSelector === functionSelector;
            });

            if (!functionAbi) {
                return null;
            }

            // Create the function signature
            const functionSignature = `${functionAbi.name}(${functionAbi.inputs.map((input: any) => input.type).join(',')})`;

            // Create the interface
            const iface = new ethers.utils.Interface([functionAbi]);

            // Decode the data
            const decodedData = iface.decodeFunctionData(functionAbi.name, data);

            // Get the parameter types and names
            const paramTypes = functionAbi.inputs.map((input: any) => input.type);
            const paramNames = functionAbi.inputs.map((input: any) => input.name);

            // Convert the decoded data to an array
            const params = functionAbi.inputs.map((input: any, index: number) => {
                const value = decodedData[index];
                
                // Handle BigNumber values
                if (ethers.BigNumber.isBigNumber(value)) {
                    return value.toString();
                }
                
                return value;
            });

            return {
                functionName: functionAbi.name,
                functionSignature,
                params,
                paramTypes,
                paramNames
            };
        } catch (error) {
            logger.error('Error decoding transaction data:', error);
            return null;
        }
    }

    /**
     * Format decoded transaction data for display
     * @param decodedData The decoded transaction data
     * @returns The formatted transaction data
     */
    formatDecodedData(decodedData: {
        functionName: string;
        functionSignature: string;
        params: any[];
        paramTypes: string[];
        paramNames: string[];
    }): {
        functionName: string;
        functionSignature: string;
        params: {
            name: string;
            type: string;
            value: any;
        }[];
    } {
        return {
            functionName: decodedData.functionName,
            functionSignature: decodedData.functionSignature,
            params: decodedData.params.map((param, index) => ({
                name: decodedData.paramNames[index],
                type: decodedData.paramTypes[index],
                value: param
            }))
        };
    }

    /**
     * Get a human-readable description of the transaction
     * @param decodedData The decoded transaction data
     * @param contractName The name of the contract
     * @param contractType The type of contract (e.g., ERC20, ERC721)
     * @returns A human-readable description of the transaction
     */
    getTransactionDescription(
        decodedData: {
            functionName: string;
            functionSignature: string;
            params: any[];
            paramTypes: string[];
            paramNames: string[];
        },
        contractName?: string,
        contractType?: string
    ): string {
        const { functionName, params, paramNames } = decodedData;
        
        // Handle common ERC20 functions
        if (contractType === 'ERC20') {
            if (functionName === 'transfer') {
                const to = params[0];
                const value = params[1];
                return `Transfer ${value} ${contractName || 'tokens'} to ${to}`;
            }
            
            if (functionName === 'approve') {
                const spender = params[0];
                const value = params[1];
                return `Approve ${spender} to spend ${value} ${contractName || 'tokens'}`;
            }
            
            if (functionName === 'transferFrom') {
                const from = params[0];
                const to = params[1];
                const value = params[2];
                return `Transfer ${value} ${contractName || 'tokens'} from ${from} to ${to}`;
            }
            
            if (functionName === 'issue') {
                const amount = params[0];
                return `Issue ${amount} new ${contractName || 'tokens'}`;
            }
            
            if (functionName === 'redeem') {
                const amount = params[0];
                return `Redeem ${amount} ${contractName || 'tokens'}`;
            }
        }
        
        // Handle common ERC721 functions
        if (contractType === 'ERC721') {
            if (functionName === 'transferFrom' || functionName === 'safeTransferFrom') {
                const from = params[0];
                const to = params[1];
                const tokenId = params[2];
                return `Transfer NFT #${tokenId} from ${from} to ${to}`;
            }
            
            if (functionName === 'approve') {
                const to = params[0];
                const tokenId = params[1];
                return `Approve ${to} to transfer NFT #${tokenId}`;
            }
            
            if (functionName === 'mint') {
                const to = params[0];
                const tokenId = params.length > 1 ? params[1] : 'new';
                return `Mint NFT #${tokenId} to ${to}`;
            }
        }
        
        // Handle common ERC1155 functions
        if (contractType === 'ERC1155') {
            if (functionName === 'safeTransferFrom') {
                const from = params[0];
                const to = params[1];
                const id = params[2];
                const value = params[3];
                return `Transfer ${value} of token #${id} from ${from} to ${to}`;
            }
            
            if (functionName === 'safeBatchTransferFrom') {
                const from = params[0];
                const to = params[1];
                return `Batch transfer tokens from ${from} to ${to}`;
            }
        }
        
        // Generic description for other functions
        return `Call ${functionName}(${params.map((param, index) => `${paramNames[index]}: ${param}`).join(', ')})`;
    }
}

export const transactionDecoder = new TransactionDecoder();
