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
        this.importMappings[from] = to;
    }

    /**
     * Add multiple import mappings
     * @param mappings The import mappings
     */
    addMappings(mappings: Record<string, string>): void {
        for (const [from, to] of Object.entries(mappings)) {
            this.addMapping(from, to);
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
        return importPath;
    }

    /**
     * Find a file in the import mappings
     * @param importPath The import path
     * @returns The file content
     */
    findImport(importPath: string): { contents: string } | { error: string } {
        logger.info(`Finding import: ${importPath}`);

        // Check if we have a direct mapping for this import
        if (this.importMappings[importPath]) {
            logger.info(`Found direct mapping for ${importPath}`);
            return { contents: this.importMappings[importPath] };
        }

        // Try normalized path
        const normalizedPath = this.normalizeImportPath(importPath);
        if (this.importMappings[normalizedPath]) {
            logger.info(`Found direct mapping for normalized path ${normalizedPath}`);
            return { contents: this.importMappings[normalizedPath] };
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

        // If we can't find the import, return an error
        logger.error(`Import not found: ${importPath}`);
        return { error: `File not found: ${importPath}` };
    }
}

export const importHandler = new ImportHandler();
