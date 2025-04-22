import { AbiFunction, AbiParameter } from './AbiFunction';

export interface FunctionParameter {
    name: string;
    type: string;
    value?: any;
    components?: FunctionParameter[];
}

export interface FunctionInterface {
    name: string;
    signature: string;
    inputs: FunctionParameter[];
    outputs: FunctionParameter[];
    stateMutability?: string;
    type: string;
}

export interface ParsedAbiFunction {
    original: AbiFunction;
    parsed: FunctionInterface;
}

export interface FunctionCall {
    function: FunctionInterface;
    args: any[];
    encoded: string;
}

export interface DecodedFunctionCall {
    function: FunctionInterface;
    args: {
        [key: string]: any;
    };
}
