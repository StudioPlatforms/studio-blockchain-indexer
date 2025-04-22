export interface AbiParameter {
    name: string;
    type: string;
    components?: AbiParameter[];
    indexed?: boolean;
    internalType?: string;
}

export interface AbiFunction {
    type: string;
    name: string;
    inputs: AbiParameter[];
    outputs: AbiParameter[];
    stateMutability?: string;
    constant?: boolean;
    payable?: boolean;
    anonymous?: boolean;
}

export interface DecodedFunctionData {
    name: string;
    params: {
        name: string;
        value: any;
        type: string;
    }[];
}
