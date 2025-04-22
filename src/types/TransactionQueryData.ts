export interface TransactionQueryData {
    hash?: string;
    blockNumber?: number;
    from?: string;
    to?: string;
    value?: string;
    input?: string;
    status?: boolean;
    timestamp?: string;
    gasUsed?: string;
    gasPrice?: string;
    nonce?: number;
    blockHash?: string;
}

export interface TransactionQueryResponse {
    transactions: TransactionQueryData[];
    total: number;
    page: number;
    pageSize: number;
}
