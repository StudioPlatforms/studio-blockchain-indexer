import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger';
import solc from 'solc';

const logger = createLogger('verification:compiler-manager');

// Directory to store cached compilers
const COMPILER_CACHE_DIR = path.join(process.cwd(), 'compiler-cache');

// Maximum number of compilers to keep in memory
const MAX_MEMORY_CACHE_SIZE = 10;

// Supported EVM versions
export const SUPPORTED_EVM_VERSIONS = [
    'homestead',
    'tangerineWhistle',
    'spuriousDragon',
    'byzantium',
    'constantinople',
    'petersburg',
    'istanbul',
    'berlin',
    'london',
    'paris',
    'shanghai',
    'cancun'
];

/**
 * Compiler manager for handling Solidity compiler versions
 */
export class CompilerManager {
    private memoryCache: Map<string, any> = new Map();
    private solcVersionsUrl = 'https://binaries.soliditylang.org/bin/list.json';
    private solcBuildsUrl = 'https://binaries.soliditylang.org/bin/';
    private versionMap: Record<string, string> = {};
    private usageCount: Map<string, number> = new Map();
    private lastUsed: Map<string, number> = new Map();

    constructor() {
        // Create compiler cache directory if it doesn't exist
        if (!fs.existsSync(COMPILER_CACHE_DIR)) {
            fs.mkdirSync(COMPILER_CACHE_DIR, { recursive: true });
        }

        // Load cached compiler versions
        this.loadCachedVersions();
    }

    /**
     * Load cached compiler versions
     */
    private loadCachedVersions(): void {
        try {
            const files = fs.readdirSync(COMPILER_CACHE_DIR);
            for (const file of files) {
                if (file.startsWith('soljson-') && file.endsWith('.js')) {
                    const version = file.replace('soljson-', '').replace('.js', '');
                    this.versionMap[version.split('+')[0]] = version;
                    logger.info(`Found cached compiler version: ${version}`);
                }
            }
        } catch (error) {
            logger.error('Error loading cached compiler versions:', error);
        }
    }

    /**
     * Get the list of available compiler versions
     * @returns The list of available compiler versions
     */
    async getAvailableVersions(): Promise<string[]> {
        try {
            const response = await axios.get(this.solcVersionsUrl);
            const releases = response.data.releases;
            return Object.keys(releases);
        } catch (error) {
            logger.error('Error getting available compiler versions:', error);
            throw new Error('Failed to get available compiler versions');
        }
    }

    /**
     * Get the full version string for a compiler version
     * @param version The compiler version
     * @returns The full version string
     */
    async getFullVersionString(version: string): Promise<string> {
        // If we already have the full version string, return it
        if (this.versionMap[version]) {
            return this.versionMap[version];
        }

        try {
            // Get the list of available versions
            const response = await axios.get(this.solcVersionsUrl);
            const releases = response.data.releases;
            
            // Check if the version exists in the releases
            if (!releases[version]) {
                throw new Error(`Compiler version ${version} not found in releases`);
            }
            
            // Get the correct path with 'v' prefix from releases
            const correctPath = releases[version];
            
            // Extract the version string from the path (e.g., "v0.4.26+commit.4563c3fc")
            const versionMatch = correctPath.match(/soljson-(v[^.]+\.[^.]+\.[^+]+(?:\+commit\.[a-f0-9]+)?).js/);
            if (!versionMatch || !versionMatch[1]) {
                throw new Error(`Could not extract version from path: ${correctPath}`);
            }
            
            const fullVersion = versionMatch[1];
            
            // Cache the full version string
            this.versionMap[version] = fullVersion;
            
            return fullVersion;
        } catch (error) {
            logger.error(`Error getting full version string for ${version}:`, error);
            throw new Error(`Failed to get full version string for ${version}`);
        }
    }

    /**
     * Download a compiler version
     * @param version The compiler version
     * @returns The path to the downloaded compiler
     */
    private async downloadCompiler(version: string): Promise<string> {
        try {
            const fullVersion = await this.getFullVersionString(version);
            const compilerPath = path.join(COMPILER_CACHE_DIR, `soljson-${fullVersion}.js`);
            
            // If the compiler is already downloaded, return the path
            if (fs.existsSync(compilerPath)) {
                return compilerPath;
            }
            
            // Download the compiler
            const url = `${this.solcBuildsUrl}soljson-${fullVersion}.js`;
            logger.info(`Downloading compiler from ${url}`);
            
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            fs.writeFileSync(compilerPath, response.data);
            
            logger.info(`Downloaded compiler version ${fullVersion} to ${compilerPath}`);
            
            return compilerPath;
        } catch (error) {
            logger.error(`Error downloading compiler version ${version}:`, error);
            throw new Error(`Failed to download compiler version ${version}`);
        }
    }

    /**
     * Load a compiler version
     * @param version The compiler version
     * @returns The compiler
     */
    async loadCompiler(version: string): Promise<any> {
        try {
            // Check if we have the compiler in memory
            if (this.memoryCache.has(version)) {
                // Update usage statistics
                this.usageCount.set(version, (this.usageCount.get(version) || 0) + 1);
                this.lastUsed.set(version, Date.now());
                
                logger.info(`Using cached compiler version ${version} from memory`);
                return this.memoryCache.get(version);
            }
            
            // Get the full version string
            const fullVersion = await this.getFullVersionString(version);
            
            // Check if we have the compiler on disk
            const compilerPath = path.join(COMPILER_CACHE_DIR, `soljson-${fullVersion}.js`);
            
            if (!fs.existsSync(compilerPath)) {
                // Download the compiler
                await this.downloadCompiler(version);
            }
            
            // Load the compiler
            logger.info(`Loading compiler version ${version} from ${compilerPath}`);
            
            // Use solc.setupMethods to load the compiler from disk
            const compiler = solc.setupMethods(require(compilerPath));
            
            // Cache the compiler in memory
            this.cacheCompiler(version, compiler);
            
            return compiler;
        } catch (error) {
            logger.error(`Error loading compiler version ${version}:`, error);
            throw new Error(`Failed to load compiler version ${version}`);
        }
    }

    /**
     * Cache a compiler in memory
     * @param version The compiler version
     * @param compiler The compiler
     */
    private cacheCompiler(version: string, compiler: any): void {
        // If we've reached the maximum cache size, remove the least recently used compiler
        if (this.memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
            let leastRecentlyUsed = '';
            let oldestTime = Infinity;
            
            for (const [cachedVersion, _] of this.memoryCache.entries()) {
                const lastUsedTime = this.lastUsed.get(cachedVersion) || 0;
                if (lastUsedTime < oldestTime) {
                    oldestTime = lastUsedTime;
                    leastRecentlyUsed = cachedVersion;
                }
            }
            
            if (leastRecentlyUsed) {
                logger.info(`Removing least recently used compiler version ${leastRecentlyUsed} from memory cache`);
                this.memoryCache.delete(leastRecentlyUsed);
                this.usageCount.delete(leastRecentlyUsed);
                this.lastUsed.delete(leastRecentlyUsed);
            }
        }
        
        // Cache the compiler
        this.memoryCache.set(version, compiler);
        this.usageCount.set(version, 1);
        this.lastUsed.set(version, Date.now());
        
        logger.info(`Cached compiler version ${version} in memory`);
    }

    /**
     * Get the appropriate EVM version for a compiler version
     * @param compilerVersion The compiler version
     * @param requestedEvmVersion The requested EVM version
     * @returns The appropriate EVM version
     */
    getAppropriateEvmVersion(compilerVersion: string, requestedEvmVersion: string): string {
        // Extract the major, minor, and patch version numbers
        const versionMatch = compilerVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!versionMatch) {
            return requestedEvmVersion; // Default to requested version if parsing fails
        }
        
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const patch = parseInt(versionMatch[3]);
        
        // For Solidity 0.4.x, use 'byzantium'
        if (major === 0 && minor <= 4) {
            logger.info(`Using 'byzantium' EVM version for Solidity ${compilerVersion}`);
            return 'byzantium';
        }
        
        // For Solidity 0.5.x, use 'petersburg'
        if (major === 0 && minor === 5) {
            logger.info(`Using 'petersburg' EVM version for Solidity ${compilerVersion}`);
            return 'petersburg';
        }
        
        // For Solidity 0.6.x, use 'istanbul'
        if (major === 0 && minor === 6) {
            logger.info(`Using 'istanbul' EVM version for Solidity ${compilerVersion}`);
            return 'istanbul';
        }
        
        // For Solidity 0.7.x, use 'berlin'
        if (major === 0 && minor === 7) {
            logger.info(`Using 'berlin' EVM version for Solidity ${compilerVersion}`);
            return 'berlin';
        }
        
        // For Solidity 0.8.x
        if (major === 0 && minor === 8) {
            // 0.8.0 defaults to 'istanbul'
            if (patch === 0) {
                logger.info(`Using 'istanbul' EVM version for Solidity ${compilerVersion}`);
                return 'istanbul';
            }
            // 0.8.1 - 0.8.5 can accept 'berlin' or 'istanbul'
            else if (patch < 6) {
                logger.info(`Using 'berlin' EVM version for Solidity ${compilerVersion}`);
                return 'berlin';
            }
            // 0.8.6 - 0.8.9 accept 'london'
            else if (patch < 10) {
                logger.info(`Using 'london' EVM version for Solidity ${compilerVersion}`);
                return 'london';
            }
            // 0.8.10 - 0.8.19 accept 'paris'
            else if (patch < 20) {
                logger.info(`Using 'paris' EVM version for Solidity ${compilerVersion}`);
                return 'paris';
            }
            // 0.8.20+ accept 'shanghai'
            else if (patch < 24) {
                logger.info(`Using 'shanghai' EVM version for Solidity ${compilerVersion}`);
                return 'shanghai';
            }
            // 0.8.24+ accept 'cancun'
            else {
                logger.info(`Using 'cancun' EVM version for Solidity ${compilerVersion}`);
                return 'cancun';
            }
        }
        
        // For Solidity 0.9.x+, use the latest EVM version
        if (major === 0 && minor >= 9) {
            logger.info(`Using 'cancun' EVM version for Solidity ${compilerVersion}`);
            return 'cancun';
        }
        
        // For newer versions, return the requested version
        return requestedEvmVersion;
    }

    /**
     * Check if an EVM version is supported by a compiler version
     * @param compilerVersion The compiler version
     * @param evmVersion The EVM version
     * @returns Whether the EVM version is supported
     */
    isEvmVersionSupported(compilerVersion: string, evmVersion: string): boolean {
        // Extract the major, minor, and patch version numbers
        const versionMatch = compilerVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!versionMatch) {
            return true; // Default to true if parsing fails
        }
        
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const patch = parseInt(versionMatch[3]);
        
        // Check if the EVM version is supported by the compiler version
        switch (evmVersion) {
            case 'homestead':
            case 'tangerineWhistle':
            case 'spuriousDragon':
            case 'byzantium':
                return true; // Supported by all compiler versions
                
            case 'constantinople':
            case 'petersburg':
                return !(major === 0 && minor <= 4 && patch < 21); // Not supported by 0.4.x < 0.4.21
                
            case 'istanbul':
                return !(major === 0 && ((minor <= 4) || (minor === 5 && patch < 5))); // Not supported by 0.4.x and 0.5.x < 0.5.5
                
            case 'berlin':
                return !(major === 0 && ((minor <= 5) || (minor === 6 && patch < 8) || (minor === 7 && patch < 1))); // Not supported by 0.5.x and below, 0.6.x < 0.6.8, 0.7.x < 0.7.1
                
            case 'london':
                return !(major === 0 && ((minor <= 7) || (minor === 8 && patch < 7))); // Not supported by 0.7.x and below, 0.8.x < 0.8.7
                
            case 'paris':
                return !(major === 0 && ((minor <= 7) || (minor === 8 && patch < 11))); // Not supported by 0.7.x and below, 0.8.x < 0.8.11
                
            case 'shanghai':
                return !(major === 0 && ((minor <= 7) || (minor === 8 && patch < 20))); // Not supported by 0.7.x and below, 0.8.x < 0.8.20
                
            case 'cancun':
                return !(major === 0 && ((minor <= 7) || (minor === 8 && patch < 24))); // Not supported by 0.7.x and below, 0.8.x < 0.8.24
                
            default:
                return false; // Unknown EVM version
        }
    }

    /**
     * Get the usage statistics for cached compilers
     * @returns The usage statistics
     */
    getUsageStatistics(): { version: string, usageCount: number, lastUsed: number }[] {
        const stats = [];
        
        for (const [version, _] of this.memoryCache.entries()) {
            stats.push({
                version,
                usageCount: this.usageCount.get(version) || 0,
                lastUsed: this.lastUsed.get(version) || 0
            });
        }
        
        return stats.sort((a, b) => b.usageCount - a.usageCount);
    }

    /**
     * Clear the compiler cache
     */
    clearCache(): void {
        this.memoryCache.clear();
        this.usageCount.clear();
        this.lastUsed.clear();
        
        logger.info('Cleared compiler cache');
    }
}

export const compilerManager = new CompilerManager();
