// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

interface INonfungiblePositionManager {
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
    function factory() external view returns (address);
}

interface INonfungibleTokenPositionDescriptor {
    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId) external view returns (string memory);
}

contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor {
    address public immutable WETH9;
    bytes32 public immutable nativeCurrencyLabelBytes;

    constructor(address _WETH9, bytes32 _nativeCurrencyLabelBytes) {
        WETH9 = _WETH9;
        nativeCurrencyLabelBytes = _nativeCurrencyLabelBytes;
    }

    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId) external view override returns (string memory) {
        return "";
    }
}
