import { createLogger } from '../../utils/logger';
import path from 'path';
import { enhancedImportHandler } from './enhanced-import-handler';

const logger = createLogger('verification:flattener');

/**
 * Service for flattening Solidity source code
 */
export class SourceCodeFlattener {
    private processedFiles: Set<string> = new Set();
    private importMappings: Record<string, string> = {};
    private pragmaStatements: Set<string> = new Set();
    private licenseStatements: Set<string> = new Set();
    private importedContracts: Set<string> = new Set();

    /**
     * Set the import mappings
     * @param importMappings The import mappings
     */
    setImportMappings(importMappings: Record<string, string>): void {
        this.importMappings = importMappings;
        this.processedFiles.clear();
        this.pragmaStatements.clear();
        this.licenseStatements.clear();
        this.importedContracts.clear();
    }

    /**
     * Extract pragma statements from source code
     * @param sourceCode The source code
     */
    private extractPragmaStatements(sourceCode: string): void {
        const pragmaRegex = /pragma\s+.*?;/g;
        const matches = sourceCode.match(pragmaRegex);
        if (matches) {
            matches.forEach(match => this.pragmaStatements.add(match));
        }
    }

    /**
     * Extract license statements from source code
     * @param sourceCode The source code
     */
    private extractLicenseStatements(sourceCode: string): void {
        const licenseRegex = /\/\/\s*SPDX-License-Identifier:.*$/gm;
        const matches = sourceCode.match(licenseRegex);
        if (matches) {
            matches.forEach(match => this.licenseStatements.add(match));
        }
    }

    /**
     * Remove import statements from source code
     * @param sourceCode The source code
     * @returns The source code without import statements
     */
    private removeImportStatements(sourceCode: string): string {
        return sourceCode.replace(/import\s+(?:{[^}]*}\s+from\s+)?["'][^"']+["'];/g, '');
    }

    /**
     * Remove pragma statements from source code
     * @param sourceCode The source code
     * @returns The source code without pragma statements
     */
    private removePragmaStatements(sourceCode: string): string {
        return sourceCode.replace(/pragma\s+.*?;/g, '');
    }

    /**
     * Remove license statements from source code
     * @param sourceCode The source code
     * @returns The source code without license statements
     */
    private removeLicenseStatements(sourceCode: string): string {
        return sourceCode.replace(/\/\/\s*SPDX-License-Identifier:.*$/gm, '');
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
     * Process a file and its imports recursively
     * @param filePath The file path
     * @returns The flattened source code
     */
    private processFile(filePath: string): string {
        // If we've already processed this file, skip it
        if (this.processedFiles.has(filePath)) {
            return '';
        }
        
        // Mark this file as processed
        this.processedFiles.add(filePath);
        
        // Get the file content
        const fileContent = this.importMappings[filePath];
        if (!fileContent) {
            logger.error(`File not found: ${filePath}`);
            throw new Error(`File not found: ${filePath}`);
        }
        
        // Extract pragma and license statements
        this.extractPragmaStatements(fileContent);
        this.extractLicenseStatements(fileContent);
        
        // Extract imports
        const imports = this.extractImports(fileContent);
        
        // Process imports recursively
        let flattenedImports = '';
        for (const importPath of imports) {
            // Try to resolve the import
            const resolvedImport = this.resolveImport(importPath, filePath);
            if (resolvedImport) {
                flattenedImports += this.processFile(resolvedImport);
            } else {
                logger.error(`Could not resolve import: ${importPath} from ${filePath}`);
                throw new Error(`Could not resolve import: ${importPath} from ${filePath}`);
            }
        }
        
        // Remove import, pragma, and license statements
        let processedContent = this.removeImportStatements(fileContent);
        processedContent = this.removePragmaStatements(processedContent);
        processedContent = this.removeLicenseStatements(processedContent);
        
        // Return the flattened content
        return flattenedImports + processedContent;
    }

    /**
     * Resolve an import path
     * @param importPath The import path
     * @param fromFile The file that imports it
     * @returns The resolved import path
     */
    private resolveImport(importPath: string, fromFile: string): string | null {
        // Try direct mapping
        if (this.importMappings[importPath]) {
            return importPath;
        }
        
        // Try to resolve using the enhanced import handler
        const result = enhancedImportHandler.findImport(importPath);
        if ('contents' in result) {
            // Find the key in importMappings that has this content
            for (const [key, value] of Object.entries(this.importMappings)) {
                if (value === result.contents) {
                    return key;
                }
            }
            
            // If we can't find it, add it to the import mappings
            this.importMappings[importPath] = result.contents;
            return importPath;
        }
        
        // Try to resolve relative to the importing file
        const fromDir = path.dirname(fromFile);
        const resolvedPath = path.join(fromDir, importPath);
        if (this.importMappings[resolvedPath]) {
            return resolvedPath;
        }
        
        // Try with .sol extension
        if (!importPath.endsWith('.sol')) {
            const withExtension = importPath + '.sol';
            if (this.importMappings[withExtension]) {
                return withExtension;
            }
            
            // Try relative with extension
            const resolvedWithExt = path.join(fromDir, withExtension);
            if (this.importMappings[resolvedWithExt]) {
                return resolvedWithExt;
            }
        }
        
        // Try just the filename
        const filename = path.basename(importPath);
        if (this.importMappings[filename]) {
            return filename;
        }
        
        // Try filename with .sol extension
        if (!filename.endsWith('.sol')) {
            const filenameWithExt = filename + '.sol';
            if (this.importMappings[filenameWithExt]) {
                return filenameWithExt;
            }
        }
        
        return null;
    }

    /**
     * Flatten source code
     * @param mainFile The main file path
     * @param importMappings The import mappings
     * @returns The flattened source code
     */
    flatten(mainFile: string, importMappings: Record<string, string>): string {
        try {
            // Set up the flattener
            this.setImportMappings(importMappings);
            
            // Process the main file
            const flattenedContent = this.processFile(mainFile);
            
            // Add pragma and license statements at the top
            let result = '';
            
            // Add license statements
            this.licenseStatements.forEach(license => {
                result += license + '\n';
            });
            
            // Add pragma statements
            this.pragmaStatements.forEach(pragma => {
                result += pragma + '\n';
            });
            
            // Add a separator
            result += '\n';
            
            // Add the flattened content
            result += flattenedContent;
            
            return result;
        } catch (error) {
            logger.error('Error flattening source code:', error);
            throw error;
        }
    }

    /**
     * Flatten multiple source files into a single file
     * @param sourceFiles The source files
     * @param mainFile The main file path (optional, will be detected if not provided)
     * @returns The flattened source code
     */
    flattenFiles(sourceFiles: Record<string, string>, mainFile?: string): string {
        try {
            // Set up the import mappings
            this.setImportMappings(sourceFiles);
            
            // Detect the main file if not provided
            if (!mainFile) {
                // Try to find a file that contains a contract definition
                for (const [filePath, content] of Object.entries(sourceFiles)) {
                    if (content.includes('contract ') || content.includes('library ') || content.includes('interface ')) {
                        mainFile = filePath;
                        break;
                    }
                }
                
                // If we still don't have a main file, use the first file
                if (!mainFile) {
                    mainFile = Object.keys(sourceFiles)[0];
                }
            }
            
            // Flatten the source code
            return this.flatten(mainFile, sourceFiles);
        } catch (error) {
            logger.error('Error flattening source files:', error);
            throw error;
        }
    }
}

export const sourceCodeFlattener = new SourceCodeFlattener();
