// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMockFlashBorrower {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/// @notice Deterministic local-test stand-in for Aave V3 flashLoanSimple.
contract MockAaveV3FlashPool {
    using SafeERC20 for IERC20;

    uint256 public immutable premiumBps;

    constructor(uint256 premiumBps_) {
        require(premiumBps_ <= 1000, "premium too high");
        premiumBps = premiumBps_;
    }

    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16
    ) external {
        IERC20 token = IERC20(asset);
        uint256 balanceBefore = token.balanceOf(address(this));
        require(balanceBefore >= amount, "insufficient liquidity");

        uint256 premium = (amount * premiumBps) / 10_000;
        token.safeTransfer(receiverAddress, amount);

        bool accepted = IMockFlashBorrower(receiverAddress).executeOperation(
            asset,
            amount,
            premium,
            msg.sender,
            params
        );
        require(accepted, "callback rejected");

        token.safeTransferFrom(receiverAddress, address(this), amount + premium);
        require(token.balanceOf(address(this)) >= balanceBefore + premium, "not repaid");
    }
}
