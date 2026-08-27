// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPropertyInterestToken {
    function isAllowed(address account) external view returns (bool);
}

/// @notice Pull-based distribution vault for approved net-property-income epochs.
/// @dev Allocation roots should be generated from a compliance-approved cap-table
///      snapshot after property expenses and reserves are finalized off-chain.
contract PropertyDistributionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct DistributionEpoch {
        IERC20 asset;
        bytes32 merkleRoot;
        bytes32 statementHash;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint64 createdAt;
    }

    IPropertyInterestToken public immutable interestToken;
    uint256 public nextEpochId = 1;
    mapping(uint256 epochId => DistributionEpoch epoch) public epochs;
    mapping(uint256 epochId => mapping(address account => bool claimed)) public hasClaimed;

    error InvalidAsset();
    error InvalidInterestToken();
    error InvalidMerkleRoot();
    error InvalidStatementHash();
    error InvalidAmount();
    error EpochNotFound();
    error AlreadyClaimed();
    error ClaimantNotAllowed(address account);
    error InvalidProof();

    event DistributionCreated(
        uint256 indexed epochId,
        address indexed asset,
        uint256 totalAmount,
        bytes32 merkleRoot,
        bytes32 statementHash
    );
    event DistributionClaimed(uint256 indexed epochId, address indexed account, uint256 amount);

    constructor(address initialOwner, IPropertyInterestToken interestToken_) Ownable(initialOwner) {
        if (address(interestToken_) == address(0)) revert InvalidInterestToken();
        interestToken = interestToken_;
    }

    function createDistribution(
        IERC20 asset,
        bytes32 merkleRoot,
        uint256 totalAmount,
        bytes32 statementHash
    ) external onlyOwner returns (uint256 epochId) {
        if (address(asset) == address(0)) revert InvalidAsset();
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (statementHash == bytes32(0)) revert InvalidStatementHash();
        if (totalAmount == 0) revert InvalidAmount();

        epochId = nextEpochId++;
        epochs[epochId] = DistributionEpoch({
            asset: asset,
            merkleRoot: merkleRoot,
            statementHash: statementHash,
            totalAmount: totalAmount,
            claimedAmount: 0,
            createdAt: uint64(block.timestamp)
        });

        asset.safeTransferFrom(msg.sender, address(this), totalAmount);
        emit DistributionCreated(epochId, address(asset), totalAmount, merkleRoot, statementHash);
    }

    function claim(uint256 epochId, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        DistributionEpoch storage epoch = epochs[epochId];
        if (address(epoch.asset) == address(0)) revert EpochNotFound();
        if (hasClaimed[epochId][msg.sender]) revert AlreadyClaimed();
        if (!interestToken.isAllowed(msg.sender)) revert ClaimantNotAllowed(msg.sender);
        if (amount == 0) revert InvalidAmount();

        bytes32 leaf = keccak256(abi.encode(epochId, msg.sender, amount));
        if (!MerkleProof.verifyCalldata(proof, epoch.merkleRoot, leaf)) revert InvalidProof();

        hasClaimed[epochId][msg.sender] = true;
        epoch.claimedAmount += amount;
        require(epoch.claimedAmount <= epoch.totalAmount, "DISTRIBUTION_OVERALLOCATED");

        epoch.asset.safeTransfer(msg.sender, amount);
        emit DistributionClaimed(epochId, msg.sender, amount);
    }
}
