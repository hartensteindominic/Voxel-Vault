// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title VoxelForgeRevenue
/// @notice Base-mainnet Forge that mints a new descendant from three wallet-owned,
///         approved parent NFTs and collects a configurable ETH forge fee.
/// @dev Parent NFTs are READ ONLY. This contract never calls approve, transferFrom,
///      safeTransferFrom, burn, or any mutation on a parent collection.
contract VoxelForgeRevenue is ERC721, ERC721URIStorage, ERC721Royalty, Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    uint256 public constant MAX_FORGE_FEE = 0.1 ether;
    uint96 public constant MAX_ROYALTY_BPS = 1_000;

    bytes32 public constant FORGE_TYPEHASH = keccak256(
        "ForgeRequest(address account,address parentContract0,uint256 parentTokenId0,address parentContract1,uint256 parentTokenId1,address parentContract2,uint256 parentTokenId2,bytes32 descendantUriHash,uint256 feeWei,bytes32 requestId,uint64 deadline)"
    );

    struct Parent {
        address collection;
        uint256 tokenId;
    }

    struct ForgeRequest {
        address account;
        address parentContract0;
        uint256 parentTokenId0;
        address parentContract1;
        uint256 parentTokenId1;
        address parentContract2;
        uint256 parentTokenId2;
        bytes32 descendantUriHash;
        uint256 feeWei;
        bytes32 requestId;
        uint64 deadline;
    }

    uint256 private _nextTokenId = 1;

    address public forgeSigner;
    address public treasury;
    uint256 public forgeFee;
    uint96 public royaltyBps;

    uint256 public totalFeesCollected;
    uint256 public totalFeesWithdrawn;
    uint256 public totalForges;

    mapping(address => bool) public approvedParentCollections;
    mapping(bytes32 => bool) public usedRequestIds;
    mapping(uint256 => Parent[3]) private _parents;

    event ParentCollectionUpdated(address indexed collection, bool approved);
    event ForgeSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ForgeFeeUpdated(uint256 previousFeeWei, uint256 newFeeWei);
    event RoyaltyBpsUpdated(uint96 previousRoyaltyBps, uint96 newRoyaltyBps);
    event Forged(
        uint256 indexed descendantTokenId,
        address indexed account,
        uint256 feeWei,
        bytes32 indexed requestId,
        address parentContract0,
        uint256 parentTokenId0,
        address parentContract1,
        uint256 parentTokenId1,
        address parentContract2,
        uint256 parentTokenId2,
        string descendantURI
    );
    event RevenueWithdrawn(address indexed treasury, uint256 amountWei);

    constructor(
        address initialOwner,
        address initialForgeSigner,
        address initialTreasury,
        address initialParentCollection,
        uint256 initialForgeFee,
        uint96 initialRoyaltyBps
    )
        ERC721("Voxel Forge Descendant", "VFORGE")
        Ownable(initialOwner)
        EIP712("VoxelForgeRevenue", "1")
    {
        require(initialOwner != address(0), "Owner required");
        require(initialForgeSigner != address(0), "Forge signer required");
        require(initialTreasury != address(0), "Treasury required");
        require(initialParentCollection != address(0), "Parent collection required");
        require(initialForgeFee <= MAX_FORGE_FEE, "Forge fee too high");
        require(initialRoyaltyBps <= MAX_ROYALTY_BPS, "Royalty too high");

        forgeSigner = initialForgeSigner;
        treasury = initialTreasury;
        forgeFee = initialForgeFee;
        royaltyBps = initialRoyaltyBps;
        approvedParentCollections[initialParentCollection] = true;

        emit ParentCollectionUpdated(initialParentCollection, true);
        emit ForgeSignerUpdated(address(0), initialForgeSigner);
        emit TreasuryUpdated(address(0), initialTreasury);
        emit ForgeFeeUpdated(0, initialForgeFee);
        emit RoyaltyBpsUpdated(0, initialRoyaltyBps);
    }

    /// @notice Mint one descendant after verifying payment, signer authorization,
    ///         and current ownership of all three approved parent NFTs.
    function forge(ForgeRequest calldata request, string calldata descendantURI, bytes calldata signature)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 descendantTokenId)
    {
        require(request.account == msg.sender, "Account mismatch");
        require(block.timestamp <= request.deadline, "Forge request expired");
        require(!usedRequestIds[request.requestId], "Forge request already used");
        require(request.feeWei == forgeFee, "Forge fee changed");
        require(msg.value == request.feeWei, "Incorrect forge payment");
        require(bytes(descendantURI).length > 0, "Descendant URI required");
        require(keccak256(bytes(descendantURI)) == request.descendantUriHash, "Descendant URI mismatch");

        _requireApprovedParent(request.parentContract0);
        _requireApprovedParent(request.parentContract1);
        _requireApprovedParent(request.parentContract2);
        _requireDistinctParents(request);

        require(IERC721(request.parentContract0).ownerOf(request.parentTokenId0) == msg.sender, "Parent 1 not owned");
        require(IERC721(request.parentContract1).ownerOf(request.parentTokenId1) == msg.sender, "Parent 2 not owned");
        require(IERC721(request.parentContract2).ownerOf(request.parentTokenId2) == msg.sender, "Parent 3 not owned");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    FORGE_TYPEHASH,
                    request.account,
                    request.parentContract0,
                    request.parentTokenId0,
                    request.parentContract1,
                    request.parentTokenId1,
                    request.parentContract2,
                    request.parentTokenId2,
                    request.descendantUriHash,
                    request.feeWei,
                    request.requestId,
                    request.deadline
                )
            )
        );
        require(digest.recover(signature) == forgeSigner, "Invalid Forge authorization");

        // Mark the signed request used before external ERC721 receiver callbacks.
        usedRequestIds[request.requestId] = true;

        descendantTokenId = _nextTokenId++;
        _parents[descendantTokenId][0] = Parent(request.parentContract0, request.parentTokenId0);
        _parents[descendantTokenId][1] = Parent(request.parentContract1, request.parentTokenId1);
        _parents[descendantTokenId][2] = Parent(request.parentContract2, request.parentTokenId2);

        totalForges += 1;
        totalFeesCollected += msg.value;

        _safeMint(msg.sender, descendantTokenId);
        _setTokenURI(descendantTokenId, descendantURI);
        if (royaltyBps > 0) _setTokenRoyalty(descendantTokenId, treasury, royaltyBps);

        emit Forged(
            descendantTokenId,
            msg.sender,
            msg.value,
            request.requestId,
            request.parentContract0,
            request.parentTokenId0,
            request.parentContract1,
            request.parentTokenId1,
            request.parentContract2,
            request.parentTokenId2,
            descendantURI
        );
    }

    function parentsOf(uint256 descendantTokenId) external view returns (Parent[3] memory) {
        require(_ownerOf(descendantTokenId) != address(0), "Descendant does not exist");
        return _parents[descendantTokenId];
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function pendingRevenue() external view returns (uint256) {
        return address(this).balance;
    }

    function setParentCollection(address collection, bool approved) external onlyOwner {
        require(collection != address(0), "Collection required");
        approvedParentCollections[collection] = approved;
        emit ParentCollectionUpdated(collection, approved);
    }

    function setForgeSigner(address newForgeSigner) external onlyOwner {
        require(newForgeSigner != address(0), "Forge signer required");
        address previous = forgeSigner;
        forgeSigner = newForgeSigner;
        emit ForgeSignerUpdated(previous, newForgeSigner);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury required");
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    function setForgeFee(uint256 newForgeFee) external onlyOwner {
        require(newForgeFee <= MAX_FORGE_FEE, "Forge fee too high");
        uint256 previous = forgeFee;
        forgeFee = newForgeFee;
        emit ForgeFeeUpdated(previous, newForgeFee);
    }

    function setRoyaltyBps(uint96 newRoyaltyBps) external onlyOwner {
        require(newRoyaltyBps <= MAX_ROYALTY_BPS, "Royalty too high");
        uint96 previous = royaltyBps;
        royaltyBps = newRoyaltyBps;
        emit RoyaltyBpsUpdated(previous, newRoyaltyBps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Move collected forge revenue to the configured treasury.
    /// @dev Revenue is deliberately pulled instead of forwarded during forge(), so a
    ///      treasury receiver cannot break customer forging or reenter the Forge.
    function withdrawRevenue(uint256 amountWei) external onlyOwner nonReentrant {
        require(amountWei > 0, "Amount required");
        require(amountWei <= address(this).balance, "Amount exceeds balance");
        totalFeesWithdrawn += amountWei;
        (bool sent,) = payable(treasury).call{value: amountWei}("");
        require(sent, "Treasury transfer failed");
        emit RevenueWithdrawn(treasury, amountWei);
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not descendant owner");
        _burn(tokenId);
    }

    function _requireApprovedParent(address collection) internal view {
        require(approvedParentCollections[collection], "Parent collection not approved");
    }

    function _requireDistinctParents(ForgeRequest calldata request) internal pure {
        bytes32 p0 = keccak256(abi.encode(request.parentContract0, request.parentTokenId0));
        bytes32 p1 = keccak256(abi.encode(request.parentContract1, request.parentTokenId1));
        bytes32 p2 = keccak256(abi.encode(request.parentContract2, request.parentTokenId2));
        require(p0 != p1 && p0 != p2 && p1 != p2, "Choose three different parents");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}
