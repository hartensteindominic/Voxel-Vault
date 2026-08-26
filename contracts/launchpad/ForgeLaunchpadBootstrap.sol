// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ForgeClone} from "./ForgeClone.sol";
import {ForgeFactory} from "./ForgeFactory.sol";

/// @notice One-transaction bootstrap for the Forge launchpad infrastructure.
/// @dev Deploying this contract creates one locked Forge implementation and one ForgeFactory.
///      The caller supplies the owner/treasury economics; this bootstrap never owns either child.
contract ForgeLaunchpadBootstrap {
    uint16 public constant MAX_PLATFORM_BPS = 3000;

    address public immutable implementation;
