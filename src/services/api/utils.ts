import https from 'https';
import axios from 'axios';
import express from 'express';
import { createLogger } from '../../utils/logger';

const logger = createLogger('api:utils');

/**
 * Format the response to be sent to the client
 * @param res The Express response object
 * @param data The data to send in the response
 * @param status The HTTP status code
 * @returns The Express response object
 */
export function formatResponse(
    res: express.Response,
    data: any,
    status: number = 200
): express.Response {
    return res.status(status).json(data);
}

/**
 * Handle an error and send an appropriate response
 * @param res The Express response object
 * @param error The error to handle
 * @param message A custom error message
 * @param status The HTTP status code
 * @returns The Express response object
 */
export function handleError(
    res: express.Response,
    error: any,
    message: string = 'An error occurred',
    status: number = 500
): express.Response {
    logger.error(`${message}:`, error);
    
    // Include more detailed error information in the response
    const errorMessage = error instanceof Error ? error.message : String(error);
    const detailedError = {
        error: message,
        details: errorMessage,
        stack: process.env.NODE_ENV !== 'production' ? (error instanceof Error ? error.stack : undefined) : undefined
    };
    
    return formatResponse(res, detailedError, status);
}

/**
 * Make an HTTP request with the built-in https module
 * @param url The URL to make the request to
 * @param data The data to send in the request body
 * @returns A promise that resolves to the parsed response data
 */
export function makeHttpRequest(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve(parsedData);
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        // Set a timeout
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        // Write data to request body
        req.write(JSON.stringify(data));
        req.end();
    });
}

/**
 * Fetch NFT metadata from a URI
 * @param uri The URI to fetch the metadata from
 * @returns A promise that resolves to the metadata
 */
export async function fetchNFTMetadata(uri: string): Promise<any> {
    try {
        // Handle IPFS URIs
        if (uri.startsWith('ipfs://')) {
            uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        // Fetch metadata
        const response = await axios.get(uri, { timeout: 5000 });
        return response.data;
    } catch (error) {
        logger.error('Error fetching NFT metadata:', error);
        throw error;
    }
}

/**
 * Format a token transfer for API response
 * @param transfer The token transfer to format
 * @param tokenSymbol The token symbol
 * @param tokenName The token name
 * @param decimals The token decimals
 * @returns The formatted token transfer
 */
export function formatTokenTransfer(
    transfer: any,
    tokenSymbol: string,
    tokenName: string,
    decimals: number
): any {
    return {
        hash: transfer.transactionHash,
        blockNumber: transfer.blockNumber,
        timestamp: transfer.timestamp,
        from: transfer.fromAddress,
        to: transfer.toAddress,
        tokenAddress: transfer.tokenAddress,
        tokenSymbol,
        tokenName,
        value: transfer.value,
        decimals
    };
}
