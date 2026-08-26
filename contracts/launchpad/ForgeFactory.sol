// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

interface IForgeCloneInitializer {
    function initialize(
        string calldata name_,
        string calldata symbol_,
        address initialOwner,
        address platformTreasury_,
        address creatorTreasury_,
        address forgeSigner_,
        uint16 platformBps_,
        uint256 basePriceWei_,
        uint256 priceIncrementWei_
    ) external;
}

/// @notice Launchpad factory for cheap EIP-1167 Forge clones.
/// @dev Economics configured here apply only to newly created Forges. Existing clones keep their
///      initialization values, so changing factory settings cannot retroactively alter old Forges.
contract ForgeFactory is Ownable2Step, Pausable, ReentrancyGuard {
    using Address for address payable;

    uint16 public constant MAX_PLATFORM_BPS = 3000;

    address public immutable implementation;
    address public platformTreasury;
    uint16 public platformBps;
    uint256 public deployFeeWei;
    uint256 public accruedDeployFees;
    uint256 public forgeCount;

    mapping(address => bool) public isForge;
    mapping(address => address[]) private _creatorForges;

    error ZeroAddress();
    error InvalidPlatformBps();
    error IncorrectDeployFee(uint256 expected, uint256 received);
    error NoDeployFeesAvailable();

    event ForgeCreated(
        uint256 indexed forgeIndex,
        address indexed creator,
        address indexed forge,
        string name,
        string symbol,
        address forgeSigner,
        uint256 basePriceWei,
        uint256 priceIncrementWei,
        uint16 platformBps
    );
    event DeployFeeUpdated(uint256 previousFeeWei, uint256 newFeeWei);
    event PlatformBpsUpdated(uint16 previousBps, uint16 newBps);
    event PlatformTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event DeployFeesReleased(address indexed recipient, uint256 amount);

    constructor(
        address initialOwner,
        address implementation_,
        address platformTreasury_,
        uint16 platformBps_,
        uint256 deployFeeWei_
    ) Ownable(initialOwner) {
        if (implementation_ == address(0) || platformTreasury_ == address(0)) revert ZeroAddress();
        if (platformBps_ > MAX_PLATFORM_BPS) revert InvalidPlatformBps();

        implementation = implementation_;
        platformTreasury = platformTreasury_;
        platformBps = platformBps_;
        deployFeeWei = deployFeeWei_;
    }

    function createForge(
        string calldata name_,
        string calldata symbol_,
        address creatorTreasury,
        address forgeSigner,
        uint256 basePriceWei,
        uint256 priceIncrementWei
    ) external payable nonReentrant whenNotPaused returns (address forge) {
        if (creatorTreasury == address(0) || forgeSigner == address(0)) revert ZeroAddress();
        if (msg.value != deployFeeWei) revert IncorrectDeployFee(deployFeeWei, msg.value);

        forge = Clones.clone(implementation);
        IForgeCloneInitializer(forge).initialize(
            name_,
            symbol_,
            msg.sender,
            platformTreasury,
            creatorTreasury,
            forgeSigner,
            platformBps,
            basePriceWei,
            priceIncrementWei
        );

        accruedDeployFees += msg.value;
        forgeCount += 1;
        isForge[forge] = true;
        _creatorForges[msg.sender].push(forge);

        emit ForgeCreated(
            forgeCount,
            msg.sender,
            forge,
            name_,
            symbol_,
            forgeSigner,
            basePriceWei,
            priceIncrementWei,
            platformBps
        );
    }

    function creatorForges(address creator) external view returns (address[] memory) {
        return _creatorForges[creator];
    }

    function setDeployFee(uint256 newFeeWei) external onlyOwner {
        uint256 previous = deployFeeWei;
        deployFeeWei = newFeeWei;
        emit DeployFeeUpdated(previous, newFeeWei);
    }

    function setPlatformBps(uint16 newBps) external onlyOwner {
        if (newBps > MAX_PLATFORM_BPS) revert InvalidPlatformBps();
        uint16 previous = platformBps;
        platformBps = newBps;
        emit PlatformBpsUpdated(previous, newBps);
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address previous = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(previous, newTreasury);
    }

    function releaseDeployFees() external nonReentrant {
        uint256 amount = accruedDeployFees;
        if (amount == 0) revert NoDeployFeesAvailable();
        accruedDeployFees = 0;
        payable(platformTreasury).sendValue(amount);
        emit DeployFeesReleased(platformTreasury, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
