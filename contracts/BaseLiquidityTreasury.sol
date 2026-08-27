// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BaseLiquidityTreasury
/// @notice Minimal custody sink for Base liquidity principal and fees.
/// @dev It intentionally performs no swaps, governance actions, lending, or automated
///      reinvestment. The owner explicitly withdraws assets to a chosen recipient.
contract BaseLiquidityTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable token0;
    address public immutable token1;

    event TreasuryWithdrawal(address indexed token, address indexed recipient, uint256 amount);
    event NativeWithdrawal(address indexed recipient, uint256 amount);

    constructor(address initialOwner, address token0_, address token1_) Ownable(initialOwner) {
        require(initialOwner != address(0), "Owner required");
        require(token0_ != address(0) && token1_ != address(0) && token0_ != token1_, "Tokens required");
        token0 = token0_;
        token1 = token1_;
    }

    function tokenBalance(address token) external view returns (uint256) {
        require(token == token0 || token == token1, "Unsupported token");
        return IERC20(token).balanceOf(address(this));
    }

    function withdrawToken(address token, uint256 amount, address recipient) external onlyOwner nonReentrant {
        require(token == token0 || token == token1, "Unsupported token");
        require(recipient != address(0), "Recipient required");
        require(amount > 0, "Amount required");
        IERC20(token).safeTransfer(recipient, amount);
        emit TreasuryWithdrawal(token, recipient, amount);
    }

    function withdrawNative(uint256 amount, address payable recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Recipient required");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        (bool sent,) = recipient.call{value: amount}("");
        require(sent, "Native withdrawal failed");
        emit NativeWithdrawal(recipient, amount);
    }

    receive() external payable {}
}
