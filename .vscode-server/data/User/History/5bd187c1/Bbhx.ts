interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

interface RpcConfig {
    url: string;
    chainId: number;
}

interface IndexerConfig {
    startBlock: number;
    batchSize: number;
    confirmations: number;
}

interface ServerConfig {
    port: number;
    host: string;
}

interface Config {
    db: DatabaseConfig;
    rpc: RpcConfig;
    indexer: IndexerConfig;
    server: ServerConfig;
}

const config: Config = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'studio_indexer',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
    },
    rpc: {
        url: process.env.RPC_URL || 'https://rpc.studio-blockchain.com',
        chainId: parseInt(process.env.CHAIN_ID || '240240')
    },
    indexer: {
        startBlock: parseInt(process.env.START_BLOCK || '0'),
        batchSize: parseInt(process.env.BATCH_SIZE || '10'),
        confirmations: parseInt(process.env.CONFIRMATIONS || '12')
    },
    server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0'
    }
};

export { config };
export type { Config, DatabaseConfig, RpcConfig, IndexerConfig, ServerConfig };
