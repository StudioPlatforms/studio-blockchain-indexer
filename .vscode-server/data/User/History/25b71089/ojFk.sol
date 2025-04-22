// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MyToken
 * @dev A simple ERC20 Token example for verification demonstration
 * 
 * This contract implements the ERC20 standard.
 * The constructor takes name, symbol, decimals, and initialSupply as parameters.
 * These parameters must be provided in the same order during verification.
 */
contract MyToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _decimals The number of decimals the token uses
     * @param _initialSupply The initial token supply
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
