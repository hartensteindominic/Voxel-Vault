// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IForgeClone {
    struct ForgeInitConfig {
        string name;
        string symbol;
        address initialOwner;
        address platformTreasury;
        address creatorTreasury;
        address forgeSigner;
        uint16 platformBps;
        uint256 basePriceWei;
        uint256 priceIncrementWei;
    }

    function initialize(ForgeInitConfig calldata config) external;
}
