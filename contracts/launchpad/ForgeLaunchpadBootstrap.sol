// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ForgeClone} from "./ForgeClone.sol";
import {ForgeFactory} from "./ForgeFactory.sol";

/// @notice One-transaction bootstrap for the Forge launchpad infrastructure.
/// @dev Deploying this contract creates one locked Forge implementation and one ForgeFactory.
///      The bootstrap never owns either child and does not retain ETH.
contract ForgeLaunchpadBootstrap {
    address public immutable implementation;
    address public immutable factory;

    event LaunchpadBootstrapped(
        address indexed deployer,
        address indexed initialOwner,
        address indexed factory,
        address implementation,
        address platformTreasury,
        uint16 platformBps,
        uint256 deployFeeWei
    );

    constructor(
        address initialOwner,
        address platformTreasury,
        uint16 platformBps,
        uint256 deployFeeWei
    ) {
        ForgeClone implementationContract = new ForgeClone();
        ForgeFactory factoryContract = new ForgeFactory(
            initialOwner,
            address(implementationContract),
            platformTreasury,
            platformBps,
            deployFeeWei
        );

        implementation = address(implementationContract);
        factory = address(factoryContract);

        emit LaunchpadBootstrapped(
            msg.sender,
            initialOwner,
            address(factoryContract),
            address(implementationContract),
            platformTreasury,
            platformBps,
            deployFeeWei
        );
    }
}
