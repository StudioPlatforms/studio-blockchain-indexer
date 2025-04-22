import { ethers } from 'ethers';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('blockchain');

// ERC20 Interface
const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 value) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 value) returns (bool)',
    'function transferFrom(address from, address to, uint256 value) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// ERC721 Interface
const ERC721_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function safeTransferFrom(address from, address to, uint256 tokenId)',
    'function transferFrom(address from, address to, uint256 tokenId)',
    'function approve(address to, uint256 tokenId)',
    'function getApproved(uint256 tokenId) view returns (address)',
    'function setApprovalForAll(address operator, bool _approved)',
    'function isApprovedForAll(address owner, address operator) view returns (bool)',
    'function totalSupply() view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
    'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
];

// ERC1155 Interface
const ERC1155_ABI = [
    'function uri(uint256 id) view returns (string)',
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
    'function setApprovalForAll(address operator, bool approved)',
    'function isApprovedForAll(address account, address operator) view returns (bool)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
    'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function totalSupply(uint256 id) view returns (uint256)',
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
    'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
    'event ApprovalForAll(address indexed account, address indexed operator, bool approved)',
    'event URI(string value, uint256 indexed id)'
];

export interface BlockData {
    number: number;
    hash: string;
    parentHash: string;
    timestamp: number;
    nonce: string;
    difficulty: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    gasUsed: ethers.BigNumber;
    miner: string;
    extraData: string;
    transactions: string[];
}

export interface TransactionData {
    hash: string;
    blockNumber: number;
    from: string;
    to: string | null;
    value: ethers.BigNumber;
    gasPrice: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    data: string;
    nonce: number;
    transactionIndex: number;
    status?: boolean;
    timestamp: number;
}

export interface LogFilter {
    fromBlock?: number | string;
    toBlock?: number | string;
    address?: string | string[];
    topics?: (string | string[] | null)[];
}

export interface TokenTransferData {
    tokenAddress: string;
    from: string;
    to: string;
    value: string;
    tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
    tokenId?: string;
}

class Blockchain {
    private provider: ethers.providers.JsonRpcProvider;
    private currentRpcIndex: number = 0;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(config.rpc.urls[0]);
        this.setupHealthCheck();
    }

    private setupHealthCheck() {
        // Check RPC health every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.provider.getBlockNumber();
            } catch (error) {
                logger.error('RPC health check failed, switching to next RPC URL', error);
                this.switchRpcProvider();
            }
        }, 30000);
    }

    private switchRpcProvider() {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % config.rpc.urls.length;
        const newRpcUrl = config.rpc.urls[this.currentRpcIndex];
        logger.info(`Switching to RPC URL: ${newRpcUrl}`);
        this.provider = new ethers.providers.JsonRpcProvider(newRpcUrl);
    }

    async getLatestBlockNumber(): Promise<number> {
        try {
            return await this.provider.getBlockNumber();
        } catch (error) {
            logger.error('Error getting latest block number:', error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getBlock(blockNumber: number): Promise<BlockData> {
        try {
            const block = await this.provider.getBlock(blockNumber);
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }
            return {
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                nonce: block.nonce || '0x0',
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: ethers.BigNumber.from(block.gasLimit),
                gasUsed: ethers.BigNumber.from(block.gasUsed),
                miner: block.miner,
                extraData: block.extraData,
                transactions: block.transactions
            };
        } catch (error) {
            logger.error(`Error getting block ${blockNumber}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getBlockWithTransactions(blockNumber: number): Promise<{ block: BlockData, transactions: TransactionData[] }> {
        try {
            const block = await this.provider.getBlockWithTransactions(blockNumber);
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }

            const blockData: BlockData = {
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                nonce: block.nonce || '0x0',
                difficulty: ethers.BigNumber.from(block.difficulty),
                gasLimit: ethers.BigNumber.from(block.gasLimit),
                gasUsed: ethers.BigNumber.from(block.gasUsed),
                miner: block.miner,
                extraData: block.extraData,
                transactions: block.transactions.map(tx => tx.hash)
            };

            const transactions: TransactionData[] = block.transactions.map(tx => ({
                hash: tx.hash,
                blockNumber: tx.blockNumber || block.number,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                gasPrice: tx.gasPrice || ethers.BigNumber.from(0),
                gasLimit: tx.gasLimit,
                data: tx.data,
                nonce: tx.nonce,
                transactionIndex: tx.transactionIndex || 0,
                timestamp: block.timestamp
            }));

            return { block: blockData, transactions };
        } catch (error) {
            logger.error(`Error getting block with transactions ${blockNumber}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getTransaction(txHash: string): Promise<TransactionData> {
        try {
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) {
                throw new Error(`Transaction ${txHash} not found`);
            }

            const receipt = await this.provider.getTransactionReceipt(txHash);
            const block = await this.provider.getBlock(tx.blockNumber || 0);

            return {
                hash: tx.hash,
                blockNumber: tx.blockNumber || 0,
                from: tx.from,
                to: tx.to || null,
                value: tx.value,
                gasPrice: tx.gasPrice || ethers.BigNumber.from(0),
                gasLimit: tx.gasLimit,
                data: tx.data,
                nonce: tx.nonce,
                transactionIndex: tx.transactionIndex || 0,
                status: receipt ? receipt.status === 1 : undefined,
                timestamp: block ? block.timestamp : 0
            };
        } catch (error) {
            logger.error(`Error getting transaction ${txHash}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> {
        try {
            return await this.provider.getTransactionReceipt(txHash);
        } catch (error) {
            logger.error(`Error getting transaction receipt ${txHash}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getCode(address: string): Promise<string> {
        try {
            return await this.provider.getCode(address);
        } catch (error) {
            logger.error(`Error getting code for address ${address}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getBalance(address: string): Promise<ethers.BigNumber> {
        try {
            return await this.provider.getBalance(address);
        } catch (error) {
            logger.error(`Error getting balance for address ${address}:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async isContract(address: string): Promise<boolean> {
        try {
            const code = await this.getCode(address);
            return code !== '0x';
        } catch (error) {
            logger.error(`Error checking if address ${address} is contract:`, error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getLogs(filter: LogFilter): Promise<ethers.providers.Log[]> {
        try {
            return await this.provider.getLogs(filter);
        } catch (error) {
            logger.error('Error getting logs:', error);
            this.switchRpcProvider();
            throw error;
        }
    }

    async getPendingTransactions(): Promise<TransactionData[]> {
        try {
            const pendingTxs = await this.provider.send('eth_pendingTransactions', []);
            return pendingTxs.map((tx: any) => ({
                hash: tx.hash,
                blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 0,
                from: tx.from,
                to: tx.to,
                value: ethers.BigNumber.from(tx.value),
                gasPrice: ethers.BigNumber.from(tx.gasPrice),
                gasLimit: ethers.BigNumber.from(tx.gas),
                data: tx.input,
                nonce: parseInt(tx.nonce, 16),
                transactionIndex: 0,
                timestamp: Math.floor(Date.now() / 1000)
            }));
        } catch (error) {
            logger.error('Error getting pending transactions:', error);
            this.switchRpcProvider();
            return [];
        }
    }

    async getTokenTransfersFromReceipt(receipt: ethers.providers.TransactionReceipt): Promise<TokenTransferData[]> {
        const transfers: TokenTransferData[] = [];

        try {
            // Check for ERC20 Transfer events
            const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
            const erc20TransferTopic = erc20Interface.getEventTopic('Transfer');

            // Check for ERC721 Transfer events
            const erc721Interface = new ethers.utils.Interface(ERC721_ABI);
            const erc721TransferTopic = erc721Interface.getEventTopic('Transfer');

            // Check for ERC1155 TransferSingle events
            const erc1155Interface = new ethers.utils.Interface(ERC1155_ABI);
            const erc1155SingleTransferTopic = erc1155Interface.getEventTopic('TransferSingle');
            const erc1155BatchTransferTopic = erc1155Interface.getEventTopic('TransferBatch');

            for (const log of receipt.logs) {
                try {
                    if (log.topics[0] === erc20TransferTopic && log.topics.length === 3) {
                        // ERC20 Transfer
                        const parsedLog = erc20Interface.parseLog(log);
                        transfers.push({
                            tokenAddress: log.address,
                            from: ethers.utils.getAddress('0x' + log.topics[1].substring(26)),
                            to: ethers.utils.getAddress('0x' + log.topics[2].substring(26)),
                            value: parsedLog.args.value.toString(),
                            tokenType: 'ERC20'
                        });
                    } else if (log.topics[0] === erc721TransferTopic && log.topics.length === 4) {
                        // ERC721 Transfer
                        const tokenId = ethers.BigNumber.from(log.topics[3]).toString();
                        transfers.push({
                            tokenAddress: log.address,
                            from: ethers.utils.getAddress('0x' + log.topics[1].substring(26)),
                            to: ethers.utils.getAddress('0x' + log.topics[2].substring(26)),
                            value: '1',
                            tokenType: 'ERC721',
                            tokenId
                        });
                    } else if (log.topics[0] === erc1155SingleTransferTopic) {
                        // ERC1155 TransferSingle
                        const parsedLog = erc1155Interface.parseLog(log);
                        transfers.push({
                            tokenAddress: log.address,
                            from: parsedLog.args.from,
                            to: parsedLog.args.to,
                            value: parsedLog.args.value.toString(),
                            tokenType: 'ERC1155',
                            tokenId: parsedLog.args.id.toString()
                        });
                    } else if (log.topics[0] === erc1155BatchTransferTopic) {
                        // ERC1155 TransferBatch
                        const parsedLog = erc1155Interface.parseLog(log);
                        const ids = parsedLog.args.ids;
                        const values = parsedLog.args.values;

                        for (let i = 0; i < ids.length; i++) {
                            transfers.push({
                                tokenAddress: log.address,
                                from: parsedLog.args.from,
                                to: parsedLog.args.to,
                                value: values[i].toString(),
                                tokenType: 'ERC1155',
                                tokenId: ids[i].toString()
                            });
                        }
                    }
                } catch (error) {
                    logger.error(`Error parsing log in transaction ${receipt.transactionHash}:`, error);
                    continue;
                }
            }
        } catch (error) {
            logger.error(`Error getting token transfers from receipt ${receipt.transactionHash}:`, error);
        }

        return transfers;
    }

    async getTokenType(tokenAddress: string): Promise<'ERC20' | 'ERC721' | 'ERC1155' | null> {
        try {
            // Check if it's a contract
            const isContract = await this.isContract(tokenAddress);
            if (!isContract) {
                return null;
            }

            // Create contract instances with different interfaces
            const erc20Contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const erc721Contract = new ethers.Contract(tokenAddress, ERC721_ABI, this.provider);
            const erc1155Contract = new ethers.Contract(tokenAddress, ERC1155_ABI, this.provider);

            // Try ERC721 supportsInterface
            try {
                const erc721Interface = '0x80ac58cd'; // ERC721 interface id
                const erc1155Interface = '0xd9b67a26'; // ERC1155 interface id
                
                // Check for ERC165 support
                const supportsERC165 = await this.callContractMethod(
                    tokenAddress,
                    ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
                    'supportsInterface',
                    ['0x01ffc9a7'] // ERC165 interface id
                );

                if (supportsERC165) {
                    // Check for ERC721 support
                    const supportsERC721 = await this.callContractMethod(
                        tokenAddress,
                        ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
                        'supportsInterface',
                        [erc721Interface]
                    );

                    if (supportsERC721) {
                        return 'ERC721';
                    }

                    // Check for ERC1155 support
                    const supportsERC1155 = await this.callContractMethod(
                        tokenAddress,
                        ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
                        'supportsInterface',
                        [erc1155Interface]
                    );

                    if (supportsERC1155) {
                        return 'ERC1155';
                    }
                }
            } catch (error) {
                // Ignore errors, continue with other checks
            }

            // Try ERC20 methods
            try {
                // Check for basic ERC20 methods
                const [name, symbol, decimals, totalSupply] = await Promise.all([
                    this.callContractMethod(tokenAddress, ERC20_ABI, 'name', []),
                    this.callContractMethod(tokenAddress, ERC20_ABI, 'symbol', []),
                    this.callContractMethod(tokenAddress, ERC20_ABI, 'decimals', []),
                    this.callContractMethod(tokenAddress, ERC20_ABI, 'totalSupply', [])
                ]);

                // If we got here without errors, it's likely an ERC20
                return 'ERC20';
            } catch (error) {
                // Not an ERC20
            }

            // Try ERC721 methods
            try {
                // Check for basic ERC721 methods
                const [name, symbol, tokenURI] = await Promise.all([
                    this.callContractMethod(tokenAddress, ERC721_ABI, 'name', []),
                    this.callContractMethod(tokenAddress, ERC721_ABI, 'symbol', []),
                    this.callContractMethod(tokenAddress, ERC721_ABI, 'tokenURI', [0])
                ]);

                // If we got here without errors, it's likely an ERC721
                return 'ERC721';
            } catch (error) {
                // Not an ERC721
            }

            // Try ERC1155 methods
            try {
                // Check for basic ERC1155 methods
                const uri = await this.callContractMethod(tokenAddress, ERC1155_ABI, 'uri', [0]);

                // If we got here without errors, it's likely an ERC1155
                return 'ERC1155';
            } catch (error) {
                // Not an ERC1155
            }

            return null;
        } catch (error) {
            logger.error(`Error determining token type for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenName(tokenAddress: string): Promise<string | null> {
        try {
            return await this.callContractMethod(tokenAddress, ERC20_ABI, 'name', []);
        } catch (error) {
            logger.error(`Error getting token name for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenSymbol(tokenAddress: string): Promise<string | null> {
        try {
            return await this.callContractMethod(tokenAddress, ERC20_ABI, 'symbol', []);
        } catch (error) {
            logger.error(`Error getting token symbol for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenDecimals(tokenAddress: string): Promise<number | null> {
        try {
            const decimals = await this.callContractMethod(tokenAddress, ERC20_ABI, 'decimals', []);
            return parseInt(decimals);
        } catch (error) {
            logger.error(`Error getting token decimals for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenTotalSupply(tokenAddress: string, tokenId?: string): Promise<ethers.BigNumber | null> {
        try {
            const tokenType = await this.getTokenType(tokenAddress);
            
            if (tokenType === 'ERC20') {
                return await this.callContractMethod(tokenAddress, ERC20_ABI, 'totalSupply', []);
            } else if (tokenType === 'ERC721') {
                return await this.callContractMethod(tokenAddress, ERC721_ABI, 'totalSupply', []);
            } else if (tokenType === 'ERC1155' && tokenId) {
                return await this.callContractMethod(tokenAddress, ERC1155_ABI, 'totalSupply', [tokenId]);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token total supply for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getTokenURI(tokenAddress: string, tokenId: string): Promise<string | null> {
        try {
            const tokenType = await this.getTokenType(tokenAddress);
            
            if (tokenType === 'ERC721') {
                return await this.callContractMethod(tokenAddress, ERC721_ABI, 'tokenURI', [tokenId]);
            } else if (tokenType === 'ERC1155') {
                return await this.callContractMethod(tokenAddress, ERC1155_ABI, 'uri', [tokenId]);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token URI for ${tokenAddress} with ID ${tokenId}:`, error);
            return null;
        }
    }

    async getTokenMetadata(tokenAddress: string, tokenId: string): Promise<any | null> {
        try {
            const tokenURI = await this.getTokenURI(tokenAddress, tokenId);
            if (!tokenURI) {
                return null;
            }
            
            // Handle IPFS URIs
            let uri = tokenURI;
            if (uri.startsWith('ipfs://')) {
                uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
            
            // Fetch metadata
            const response = await fetch(uri);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const metadata = await response.json();
            return metadata;
        } catch (error) {
            logger.error(`Error getting token metadata for ${tokenAddress} with ID ${tokenId}:`, error);
            return null;
        }
    }

    async getTokenBalance(tokenAddress: string, ownerAddress: string, tokenId?: string): Promise<ethers.BigNumber | null> {
        try {
            const tokenType = await this.getTokenType(tokenAddress);
            
            if (tokenType === 'ERC20') {
                return await this.callContractMethod(tokenAddress, ERC20_ABI, 'balanceOf', [ownerAddress]);
            } else if (tokenType === 'ERC721') {
                return await this.callContractMethod(tokenAddress, ERC721_ABI, 'balanceOf', [ownerAddress]);
            } else if (tokenType === 'ERC1155' && tokenId) {
                return await this.callContractMethod(tokenAddress, ERC1155_ABI, 'balanceOf', [ownerAddress, tokenId]);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting token balance for ${tokenAddress} owned by ${ownerAddress}:`, error);
            return null;
        }
    }

    async getTokenHolders(tokenAddress: string): Promise<{ address: string, balance: string }[] | null> {
        try {
            // This is a complex operation that would require indexing all Transfer events
            // For now, we'll return null as this would be implemented in the indexer
            return null;
        } catch (error) {
            logger.error(`Error getting token holders for ${tokenAddress}:`, error);
            return null;
        }
    }

    private async callContractMethod(
        contractAddress: string,
        abi: string[] | ethers.ContractInterface,
        methodName: string,
        args: any[]
    ): Promise<any> {
        try {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);
            return await contract[methodName](...args);
        } catch (error) {
            throw error;
        }
    }

    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
}

export const blockchain = new Blockchain();
export type { LogFilter, TokenTransferData };
