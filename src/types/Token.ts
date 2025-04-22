export interface TokenData {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply?: string;
    logo?: string;
    type?: string;
}

export interface TokenBalance {
    token: TokenData;
    balance: string;
    usdValue?: string;
}

export interface TokenTransfer {
    token: TokenData;
    from: string;
    to: string;
    value: string;
    transactionHash: string;
    blockNumber: number;
    timestamp: string;
}

export interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    owner?: string;
    implementation?: string;
}
