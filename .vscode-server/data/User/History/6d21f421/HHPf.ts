import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('verification:enhanced-import-handler');

/**
 * Interface for a node in the dependency graph
 */
interface DependencyNode {
    path: string;
    content: string;
    dependencies: Set<string>;
}

/**
 * Interface for the dependency graph
 */
interface DependencyGraph {
    nodes: Map<string, DependencyNode>;
    mainFile: string;
}

/**
 * Enhanced import handler for Solidity compiler
 * This class handles file imports for the Solidity compiler with improved support for complex imports
 */
export class EnhancedImportHandler {
    private importMappings: Record<string, string> = {};
    private basePath: string = '';
    private importAttempts: Set<string> = new Set(); // Track import attempts to avoid infinite recursion
    private dependencyGraph: DependencyGraph | null = null;
    private npmPackages: Set<string> = new Set(); // Track npm package imports

    /**
     * Set the base path for imports
     * @param basePath The base path for imports
     */
    setBasePath(basePath: string): void {
        this.basePath = basePath;
    }

    /**
     * Add an import mapping
     * @param from The import path
     * @param to The file content
     */
    addMapping(from: string, to: string): void {
        // Store both the original path and normalized versions
        this.importMappings[from] = to;
        
        // Also store normalized version
        const normalizedPath = this.normalizeImportPath(from);
        if (normalizedPath !== from) {
            this.importMappings[normalizedPath] = to;
        }
        
        // Store without file extension
        if (from.endsWith('.sol')) {
            const withoutExtension = from.substring(0, from.length - 4);
            this.importMappings[withoutExtension] = to;
        }
        
        // Store with file extension
        if (!from.endsWith('.sol')) {
            this.importMappings[from + '.sol'] = to;
        }
        
        // Store just the filename
        const filename = path.basename(from);
        this.importMappings[filename] = to;
        
        // Check if this is an npm package import
        if (from.startsWith('@')) {
            const packageName = from.split('/')[0];
            this.npmPackages.add(packageName);
        }
        
        logger.info(`Added import mapping for: ${from}`);
    }

    /**
     * Add multiple import mappings
     * @param mappings The import mappings
     */
    addMappings(mappings: Record<string, string>): void {
        // Clear previous mappings to avoid conflicts
        this.importMappings = {};
        this.importAttempts.clear();
        this.dependencyGraph = null;
        this.npmPackages.clear();
        
        for (const [from, to] of Object.entries(mappings)) {
            this.addMapping(from, to);
        }
        
        logger.info(`Added ${Object.keys(mappings).length} import mappings`);
        
        // Log all available mappings for debugging
        logger.info(`Available import paths: ${Object.keys(this.importMappings).join(', ')}`);
        
        // Build dependency graph
        if (Object.keys(mappings).length > 0) {
            this.buildDependencyGraph(mappings);
        }
    }

    /**
     * Normalize import path
     * @param importPath The import path
     * @returns The normalized import path
     */
    private normalizeImportPath(importPath: string): string {
        // Remove leading './' if present
        if (importPath.startsWith('./')) {
            return importPath.substring(2);
        }
        
        // Remove leading '../' and adjust path accordingly
        if (importPath.startsWith('../')) {
            return importPath.substring(3);
        }
        
        // Handle npm-style imports
        if (importPath.startsWith('@')) {
            // Keep as is, we'll handle these specially
            return importPath;
        }
        
        return importPath;
    }

    /**
     * Try alternative paths for an import
     * @param importPath The original import path
     * @returns Array of alternative paths to try
     */
    private getAlternativePaths(importPath: string): string[] {
        const alternatives = [];
        
        // Try without file extension
        if (importPath.endsWith('.sol')) {
            alternatives.push(importPath.substring(0, importPath.length - 4));
        }
        
        // Try with file extension
        if (!importPath.endsWith('.sol')) {
            alternatives.push(importPath + '.sol');
        }
        
        // Try with different path separators
        alternatives.push(importPath.replace(/\//g, '\\'));
        alternatives.push(importPath.replace(/\\/g, '/'));
        
        // Try with different casing
        alternatives.push(importPath.toLowerCase());
        
        // Try just the filename (without path)
        const filename = path.basename(importPath);
        alternatives.push(filename);
        
        // For npm-style imports, try different variations
        if (importPath.startsWith('@')) {
            // Try without the @ symbol
            alternatives.push(importPath.substring(1));
            
            // Try with 'node_modules/' prefix
            alternatives.push('node_modules/' + importPath);
            
            // Try with different path structures
            const parts = importPath.split('/');
            if (parts.length > 2) {
                // Try with just the package name and the file name
                alternatives.push(parts[0] + '/' + parts[parts.length - 1]);
                
                // Try with the package name and a flattened path
                alternatives.push(parts[0] + '/' + parts.slice(1).join('-'));
            }
        }
        
        // For relative imports, try different relative paths
        if (importPath.includes('/')) {
            const parts = importPath.split('/');
            const fileName = parts[parts.length - 1];
            
            // Try just the filename
            alternatives.push(fileName);
            
            // Try with different directory depths
            for (let i = 1; i < parts.length - 1; i++) {
                alternatives.push(parts.slice(parts.length - i - 1).join('/'));
            }
        }
        
        return alternatives;
    }

    /**
     * Extract imports from source code
     * @param sourceCode The source code
     * @returns Array of import paths
     */
    private extractImports(sourceCode: string): string[] {
        const imports = [];
        const importRegex = /import\s+(?:{[^}]*}\s+from\s+)?["']([^"']+)["'];/g;
        let match;
        
        while ((match = importRegex.exec(sourceCode)) !== null) {
            imports.push(match[1]);
        }
        
        return imports;
    }

    /**
     * Build dependency graph from source files
     * @param sourceFiles The source files
     */
    private buildDependencyGraph(sourceFiles: Record<string, string>): void {
        const graph: DependencyGraph = {
            nodes: new Map<string, DependencyNode>(),
            mainFile: ''
        };
        
        // Create nodes for all source files
        for (const [filePath, content] of Object.entries(sourceFiles)) {
            graph.nodes.set(filePath, {
                path: filePath,
                content,
                dependencies: new Set<string>()
            });
            
            // Extract imports
            const imports = this.extractImports(content);
            for (const importPath of imports) {
                graph.nodes.get(filePath)!.dependencies.add(importPath);
            }
        }
        
        // Set the main file (first one for now)
        if (graph.nodes.size > 0) {
            graph.mainFile = Array.from(graph.nodes.keys())[0];
        }
        
        this.dependencyGraph = graph;
        logger.info(`Built dependency graph with ${graph.nodes.size} nodes`);
    }

    /**
     * Detect the main file from source files
     * @param sourceFiles The source files
     * @param contractName The contract name
     * @returns The main file path
     */
    detectMainFile(sourceFiles: Record<string, string>, contractName: string): string {
        // First, try the file with the contract name
        const mainFileName = contractName + '.sol';
        if (sourceFiles[mainFileName]) {
            logger.info(`Found main file with name ${mainFileName}`);
            return mainFileName;
        }
        
        // Next, try to find a file that contains the contract definition
        const contractRegex = new RegExp(`contract\\s+${contractName}\\s*{`, 'i');
        for (const [filePath, content] of Object.entries(sourceFiles)) {
            if (contractRegex.test(content)) {
                logger.info(`Found main file containing contract ${contractName}: ${filePath}`);
                return filePath;
            }
        }
        
        // If we can't find it, use the first file
        const firstKey = Object.keys(sourceFiles)[0];
        logger.info(`Main file not found, using ${firstKey} as default`);
        return firstKey;
    }

    /**
     * Resolve npm-style imports
     * @param importPath The import path
     * @returns The resolved import path
     */
    private resolveNpmStyleImport(importPath: string): string | null {
        // Check if this is an npm package import
        if (!importPath.startsWith('@')) {
            return null;
        }
        
        // Extract the package name
        const parts = importPath.split('/');
        const packageName = parts[0];
        
        // Check if we have this package
        if (!this.npmPackages.has(packageName)) {
            return null;
        }
        
        // Try different variations of the import path
        const variations = [
            importPath,
            importPath + '.sol',
            parts.slice(1).join('/'),
            parts[parts.length - 1],
            parts[parts.length - 1] + '.sol'
        ];
        
        for (const variation of variations) {
            if (this.importMappings[variation]) {
                logger.info(`Resolved npm import ${importPath} to ${variation}`);
                return variation;
            }
        }
        
        // Try to find a file that matches the end of the path
        const fileName = parts[parts.length - 1];
        for (const key of Object.keys(this.importMappings)) {
            if (key.endsWith('/' + fileName) || key.endsWith('/' + fileName + '.sol')) {
                logger.info(`Resolved npm import ${importPath} to ${key}`);
                return key;
            }
        }
        
        return null;
    }

    /**
     * Find a file in the import mappings
     * @param importPath The import path
     * @returns The file content
     */
    findImport(importPath: string): { contents: string } | { error: string } {
        // Prevent infinite recursion
        if (this.importAttempts.has(importPath)) {
            logger.warn(`Circular import detected: ${importPath}`);
            return { error: `Circular import detected: ${importPath}` };
        }
        
        this.importAttempts.add(importPath);
        
        logger.info(`Finding import: ${importPath}`);

        // Check if we have a direct mapping for this import
        if (this.importMappings[importPath]) {
            logger.info(`Found direct mapping for ${importPath}`);
            return { contents: this.importMappings[importPath] };
        }

        // Try normalized path
        const normalizedPath = this.normalizeImportPath(importPath);
        if (normalizedPath !== importPath && this.importMappings[normalizedPath]) {
            logger.info(`Found mapping for normalized path ${normalizedPath}`);
            return { contents: this.importMappings[normalizedPath] };
        }

        // Try to resolve npm-style imports
        const resolvedNpmImport = this.resolveNpmStyleImport(importPath);
        if (resolvedNpmImport && this.importMappings[resolvedNpmImport]) {
            logger.info(`Found mapping for npm-style import ${importPath} -> ${resolvedNpmImport}`);
            return { contents: this.importMappings[resolvedNpmImport] };
        }

        // Try alternative paths
        const alternatives = this.getAlternativePaths(importPath);
        for (const altPath of alternatives) {
            if (this.importMappings[altPath]) {
                logger.info(`Found mapping for alternative path ${altPath}`);
                return { contents: this.importMappings[altPath] };
            }
        }

        // Try to resolve the import path relative to the base path
        if (this.basePath) {
            try {
                const fullPath = path.resolve(this.basePath, importPath);
                logger.info(`Trying to resolve ${importPath} as ${fullPath}`);
                if (fs.existsSync(fullPath)) {
                    const contents = fs.readFileSync(fullPath, 'utf8');
                    return { contents };
                }
            } catch (error) {
                logger.error(`Error resolving import ${importPath}:`, error);
            }
        }

        // Try fuzzy matching for similar file names
        const importFileName = path.basename(importPath);
        for (const [key, value] of Object.entries(this.importMappings)) {
            const keyFileName = path.basename(key);
            if (keyFileName.toLowerCase() === importFileName.toLowerCase() ||
                keyFileName.replace('.sol', '').toLowerCase() === importFileName.toLowerCase() ||
                importFileName.replace('.sol', '').toLowerCase() === keyFileName.toLowerCase()) {
                logger.info(`Found fuzzy match for ${importPath} -> ${key}`);
                return { contents: value };
            }
        }

        // If we can't find the import, log available mappings and return an error
        logger.error(`Import not found: ${importPath}`);
        logger.error(`Available mappings: ${Object.keys(this.importMappings).join(', ')}`);
        
        // Provide a more helpful error message
        let errorMessage = `File not found: ${importPath}. `;
        
        // Suggest possible fixes
        if (importPath.startsWith('@')) {
            errorMessage += `This appears to be an npm package import. Please ensure all files from the package are included in your sourceFiles object. `;
            
            // Suggest possible package structure
            const parts = importPath.split('/');
            if (parts.length > 1) {
                errorMessage += `For npm packages, try including files with paths like: ${parts[0]}/contracts/${parts[parts.length - 1]} or similar variations.`;
            }
        } else if (importPath.includes('/')) {
            errorMessage += `This is a relative import. Make sure the file exists in your sourceFiles with the exact same path, or try flattening your contract.`;
        } else {
            errorMessage += `Please ensure this file is included in your sourceFiles object with the exact same name.`;
        }
        
        return { error: errorMessage };
    }
    
    /**
     * Clear all import mappings
     */
    clearMappings(): void {
        this.importMappings = {};
        this.importAttempts.clear();
        this.dependencyGraph = null;
        this.npmPackages.clear();
        logger.info('Cleared all import mappings');
    }
}

export const enhancedImportHandler = new EnhancedImportHandler();
