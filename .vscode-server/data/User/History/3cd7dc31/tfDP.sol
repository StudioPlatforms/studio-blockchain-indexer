// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

abstract contract PeripheryImmutableState {
    address public immutable factory;
    address public immutable WETH9;
    
    constructor(address _factory, address _WETH9) {
        factory = _factory;
        WETH9 = _WETH9;
    }
}

abstract contract PeripheryValidation {}
abstract contract PeripheryPaymentsWithFee {}
abstract contract Multicall {}
abstract contract SelfPermit {}

contract SwapRouter is ISwapRouter, PeripheryImmutableState, PeripheryValidation, PeripheryPaymentsWithFee, Multicall, SelfPermit, IUniswapV3SwapCallback {
    constructor(address _factory, address _WETH9) PeripheryImmutableState(_factory, _WETH9) {}
    
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {}
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
        return 0;
    }
}
