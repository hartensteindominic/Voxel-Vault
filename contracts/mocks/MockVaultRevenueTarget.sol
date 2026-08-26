// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Test-only settlement target used to prove SoloForgeVault profit guards.
contract MockVaultRevenueTarget {
    using SafeERC20 for IERC20;

    function payToken(address token, address recipient, uint256 amount) external {
        IERC20(token).safeTransfer(recipient, amount);
    }

    function payEth(address payable recipient, uint256 amount) external {
        (bool sent,) = recipient.call{value: amount}("");
        require(sent, "ETH payment failed");
    }

    receive() external payable {}
}
