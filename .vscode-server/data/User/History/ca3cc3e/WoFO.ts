import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('verification:import-handler');

/**
 * Import handler for Solidity compiler
 * This class handles file imports for the Solidity compiler
 */
export class ImportHandler {
    private importMappings: Record<string, string> = {};
    private basePath: string = '';
    private importAttempts: Set<string> = new Set(); // Track import attempts to avoid infinite recursion

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
        
        for (const [from, to] of Object.entries(mappings)) {
            this.addMapping(from, to);
        }
        
        logger.info(`Added ${Object.keys(mappings).length} import mappings`);
        
        // Log all available mappings for debugging
        logger.info(`Available import paths: ${Object.keys(this.importMappings).join(', ')}`);
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
        
        return alternatives;
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

        // If we can't find the import, log available mappings and return an error
        logger.error(`Import not found: ${importPath}`);
        logger.error(`Available mappings: ${Object.keys(this.importMappings).join(', ')}`);
        return { error: `File not found: ${importPath}. Please ensure this file is included in your sourceFiles object with the exact same path as in the import statement.` };
    }
    
    /**
     * Clear all import mappings
     */
    clearMappings(): void {
        this.importMappings = {};
        this.importAttempts.clear();
        logger.info('Cleared all import mappings');
    }
}

export const importHandler = new ImportHandler();
