/**
 * Types and interfaces for contract verification
 */

/**
 * Interface for multi-file verification options
 */
export interface MultiFileVerificationOptions {
    sourceFiles: Record<string, string>;
    contractName: string;
    compilerVersion: string;
    optimizationUsed: boolean;
    runs: number;
    evmVersion: string;
    libraries: Record<string, string>;
    constructorArguments?: string;
    autoFlatten?: boolean;
}

/**
 * Interface for compilation result
 */
export interface CompilationResult {
    abi: any;
    bytecode: string;
    deployedBytecode: string;
    metadata?: string;
}

/**
 * Interface for multi-file compilation result
 */
export interface MultiFileCompilationResult extends CompilationResult {
    mainFile: string;
    flattened?: boolean;
}

/**
 * Interface for verification result
 */
export interface VerificationResult {
    success: boolean;
    message: string;
    abi?: any;
    bytecode?: string;
    metadata?: string;
    flattened?: boolean;
}

/**
 * Interface for multi-file verification result
 */
export interface MultiFileVerificationResult extends VerificationResult {
    mainFile?: string;
}
