export interface SearchResult {
    type: 'transaction' | 'block' | 'address' | 'token';
    value: string;
    label: string;
    description?: string;
}

export interface SearchResponse {
    results: SearchResult[];
    total: number;
}
