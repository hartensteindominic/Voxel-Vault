// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockVoxelFlipParent} from "./MockVoxelFlipParent.sol";
import {VoxelForgeAtomic} from "../VoxelForgeAtomic.sol";

/// @notice Disposable Base Sepolia-only helper used by the browser test flow.
/// @dev Deploying this contract creates both the mock parent collection and Atomic Forge.
///      The externally-owned wallet that deploys this helper becomes Forge owner, signer,
///      fee recipient, and royalty recipient. This helper has no privileged runtime methods.
contract VoxelForgeTestDeployer {
    address public immutable parent;
    address public immutable forge;

    event TestStackDeployed(address indexed controller, address indexed parent, address indexed forge);

    constructor() {
        address controller = msg.sender;
        MockVoxelFlipParent parentContract = new MockVoxelFlipParent();
        VoxelForgeAtomic forgeContract = new VoxelForgeAtomic(
            controller,
            address(parentContract),
            controller,
            controller,
            500
        );

        parent = address(parentContract);
        forge = address(forgeContract);

        emit TestStackDeployed(controller, parent, forge);
    }
}
