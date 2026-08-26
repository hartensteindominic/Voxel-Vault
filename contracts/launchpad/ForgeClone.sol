// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IForgeClone} from "./IForgeClone.sol";

/// @notice Clone-safe 3-to-1 NFT Forge with a linear merge-price curve.
/// @dev Each clone is its own ERC721 collection. Common -> Rare and Rare -> Legendary.
///      Descendant metadata must be authorized by the configured Forge signer.
contract ForgeClone is
    Initializable,
    ERC721URIStorageUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    IForgeClone
{
    using Address for address payable;
    using ECDSA for bytes32;

    uint8 public constant TIER_COMMON = 0;
    uint8 public constant TIER_RARE = 1;
    uint8 public constant TIER_LEGENDARY = 2;
    uint256 public constant MAX_BATCH_MERGES = 33;
    uint16 public constant MAX_PLATFORM_BPS = 3000;

    bytes32 public constant FORGE_REQUEST_TYPEHASH = keccak256(
        "ForgeRequest(address account,uint256 parentTokenId0,uint256 parentTokenId1,uint256 parentTokenId2,uint8 outputTier,bytes32 descendantUriHash,uint256 feeWei,bytes32 requestId,uint64 deadline)"
    );

    struct ForgeRequest {
        address account;
        uint256 parentTokenId0;
        uint256 parentTokenId1;
        uint256 parentTokenId2;
        uint8 outputTier;
        bytes32 descendantUriHash;
        uint256 feeWei;
        bytes32 requestId;
        uint64 deadline;
    }

    struct SignedMerge {
        ForgeRequest request;
        string descendantURI;
        bytes signature;
    }

    address public platformTreasury;
    address public creatorTreasury;
    address public forgeSigner;
    uint16 public platformBps;
    uint256 public basePriceWei;
    uint256 public priceIncrementWei;
    uint256 public mergeCount;
    uint256 public nextTokenId;
    uint256 public platformAccrued;
    uint256 public creatorAccrued;

    mapping(uint256 => uint8) private _tierOf;
    mapping(bytes32 => bool) public usedRequests;

    error ZeroAddress();
    error InvalidPlatformBps();
    error InvalidTier(uint8 tier);
    error InvalidOutputTier(uint8 inputTier, uint8 outputTier);
    error InvalidForgeAccount();
    error ParentNotOwned(uint256 tokenId);
    error ParentTierMismatch(uint256 tokenId, uint8 expectedTier, uint8 actualTier);
    error DuplicateParent();
    error RequestExpired();
    error RequestAlreadyUsed();
    error InvalidDescendantURI();
    error InvalidForgeSignature();
    error IncorrectForgeFee(uint256 expected, uint256 received);
    error InvalidBatchSize(uint256 size);
    error NoFeesAvailable();

    event SeedMinted(uint256 indexed tokenId, address indexed recipient, uint8 indexed tier, string uri);
    event Forged(
        uint256 indexed descendantTokenId,
        address indexed account,
        uint8 indexed outputTier,
        uint256 parentTokenId0,
        uint256 parentTokenId1,
        uint256 parentTokenId2,
        uint256 feeWei,
        bytes32 requestId
    );
    event ForgeSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event CreatorTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event PlatformFeesReleased(address indexed recipient, uint256 amount);
    event CreatorFeesReleased(address indexed recipient, uint256 amount);

    /// @dev Locks the standalone implementation. EIP-1167 clones can still initialize once.
    constructor() {
        _disableInitializers();
    }

    function initialize(IForgeClone.ForgeInitConfig calldata config) external initializer override {
        if (
            config.initialOwner == address(0)
                || config.platformTreasury == address(0)
                || config.creatorTreasury == address(0)
                || config.forgeSigner == address(0)
        ) revert ZeroAddress();
        if (config.platformBps > MAX_PLATFORM_BPS) revert InvalidPlatformBps();

        __ERC721_init(config.name, config.symbol);
        __ERC721URIStorage_init();
        __Ownable_init(config.initialOwner);
        __Ownable2Step_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("VoxelForgeClone", "1");

        platformTreasury = config.platformTreasury;
        creatorTreasury = config.creatorTreasury;
        forgeSigner = config.forgeSigner;
        platformBps = config.platformBps;
        basePriceWei = config.basePriceWei;
        priceIncrementWei = config.priceIncrementWei;
        nextTokenId = 1;
    }

    function currentMergePrice() public view returns (uint256) {
        return basePriceWei + (priceIncrementWei * mergeCount);
    }

    function tierOf(uint256 tokenId) external view returns (uint8) {
        _requireOwned(tokenId);
        return _tierOf[tokenId];
    }

    function requestDigest(ForgeRequest calldata request) external view returns (bytes32) {
        return _hashTypedDataV4(_requestStructHash(request));
    }

    /// @notice Test/demo inventory mint. A creator may seed Common, Rare, or Legendary supply.
    function seedMint(address recipient, uint8 tier, string calldata uri)
        external
        onlyOwner
        whenNotPaused
        returns (uint256 tokenId)
    {
        tokenId = _seedMint(recipient, tier, uri);
    }

    function seedMintBatch(address recipient, uint8 tier, string[] calldata uris)
        external
        onlyOwner
        whenNotPaused
        returns (uint256[] memory tokenIds)
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (tier > TIER_LEGENDARY) revert InvalidTier(tier);
        uint256 length = uris.length;
        if (length == 0 || length > 99) revert InvalidBatchSize(length);

        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            tokenIds[i] = _seedMint(recipient, tier, uris[i]);
        }
    }

    function forge(ForgeRequest calldata request, string calldata descendantURI, bytes calldata signature)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 descendantTokenId)
    {
        uint256 expectedFee = currentMergePrice();
        if (msg.value != expectedFee) revert IncorrectForgeFee(expectedFee, msg.value);
        if (request.feeWei != expectedFee) revert IncorrectForgeFee(expectedFee, request.feeWei);

        descendantTokenId = _forgeOne(request, descendantURI, signature, expectedFee);
    }

    /// @notice Batch several merges owned by the same account into one transaction.
    /// @dev Cross-user ERC-4337 batching happens at EntryPoint.handleOps, not inside this function.
    function batchForge(SignedMerge[] calldata merges)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256[] memory descendantTokenIds)
    {
        uint256 length = merges.length;
        if (length == 0 || length > MAX_BATCH_MERGES) revert InvalidBatchSize(length);

        uint256 expectedTotal;
        uint256 startingCount = mergeCount;
        for (uint256 i = 0; i < length; ++i) {
            uint256 expectedFee = basePriceWei + (priceIncrementWei * (startingCount + i));
            if (merges[i].request.feeWei != expectedFee) {
                revert IncorrectForgeFee(expectedFee, merges[i].request.feeWei);
            }
            expectedTotal += expectedFee;
        }
        if (msg.value != expectedTotal) revert IncorrectForgeFee(expectedTotal, msg.value);

        descendantTokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            descendantTokenIds[i] = _forgeOne(
                merges[i].request,
                merges[i].descendantURI,
                merges[i].signature,
                merges[i].request.feeWei
            );
        }
    }

    function setForgeSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address previous = forgeSigner;
        forgeSigner = newSigner;
        emit ForgeSignerUpdated(previous, newSigner);
    }

    function setCreatorTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address previous = creatorTreasury;
        creatorTreasury = newTreasury;
        emit CreatorTreasuryUpdated(previous, newTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Anyone may trigger payment, but platform fees can only go to platformTreasury.
    function releasePlatformFees() external nonReentrant {
        uint256 amount = platformAccrued;
        if (amount == 0) revert NoFeesAvailable();
        platformAccrued = 0;
        payable(platformTreasury).sendValue(amount);
        emit PlatformFeesReleased(platformTreasury, amount);
    }

    /// @notice Anyone may trigger payment, but creator fees can only go to creatorTreasury.
    function releaseCreatorFees() external nonReentrant {
        uint256 amount = creatorAccrued;
        if (amount == 0) revert NoFeesAvailable();
        creatorAccrued = 0;
        payable(creatorTreasury).sendValue(amount);
        emit CreatorFeesReleased(creatorTreasury, amount);
    }

    function _forgeOne(
        ForgeRequest calldata request,
        string calldata descendantURI,
        bytes calldata signature,
        uint256 expectedFee
    ) internal returns (uint256 descendantTokenId) {
        _validateRequest(request, descendantURI, signature, expectedFee);

        uint8 inputTier = _verifyParents(request);
        if (inputTier >= TIER_LEGENDARY || request.outputTier != inputTier + 1) {
            revert InvalidOutputTier(inputTier, request.outputTier);
        }

        usedRequests[request.requestId] = true;

        _burn(request.parentTokenId0);
        _burn(request.parentTokenId1);
        _burn(request.parentTokenId2);

        descendantTokenId = nextTokenId++;
        _safeMint(request.account, descendantTokenId);
        _setTokenURI(descendantTokenId, descendantURI);
        _tierOf[descendantTokenId] = request.outputTier;

        mergeCount += 1;
        uint256 platformFee = (expectedFee * platformBps) / 10_000;
        platformAccrued += platformFee;
        creatorAccrued += expectedFee - platformFee;

        _emitForged(descendantTokenId, request, expectedFee);
    }

    function _emitForged(uint256 descendantTokenId, ForgeRequest calldata request, uint256 expectedFee) internal {
        emit Forged(
            descendantTokenId,
            request.account,
            request.outputTier,
            request.parentTokenId0,
            request.parentTokenId1,
            request.parentTokenId2,
            expectedFee,
            request.requestId
        );
    }

    function _validateRequest(
        ForgeRequest calldata request,
        string calldata descendantURI,
        bytes calldata signature,
        uint256 expectedFee
    ) internal view {
        if (request.account != msg.sender) revert InvalidForgeAccount();
        if (
            request.parentTokenId0 == request.parentTokenId1
                || request.parentTokenId0 == request.parentTokenId2
                || request.parentTokenId1 == request.parentTokenId2
        ) revert DuplicateParent();
        if (block.timestamp > request.deadline) revert RequestExpired();
        if (usedRequests[request.requestId]) revert RequestAlreadyUsed();
        if (request.feeWei != expectedFee) revert IncorrectForgeFee(expectedFee, request.feeWei);
        if (keccak256(bytes(descendantURI)) != request.descendantUriHash) revert InvalidDescendantURI();

        bytes32 digest = _hashTypedDataV4(_requestStructHash(request));
        if (digest.recover(signature) != forgeSigner) revert InvalidForgeSignature();
    }

    function _verifyParents(ForgeRequest calldata request) internal view returns (uint8 inputTier) {
        if (ownerOf(request.parentTokenId0) != request.account) revert ParentNotOwned(request.parentTokenId0);
        if (ownerOf(request.parentTokenId1) != request.account) revert ParentNotOwned(request.parentTokenId1);
        if (ownerOf(request.parentTokenId2) != request.account) revert ParentNotOwned(request.parentTokenId2);

        inputTier = _tierOf[request.parentTokenId0];
        uint8 tier1 = _tierOf[request.parentTokenId1];
        uint8 tier2 = _tierOf[request.parentTokenId2];
        if (tier1 != inputTier) revert ParentTierMismatch(request.parentTokenId1, inputTier, tier1);
        if (tier2 != inputTier) revert ParentTierMismatch(request.parentTokenId2, inputTier, tier2);
    }

    function _seedMint(address recipient, uint8 tier, string calldata uri) internal returns (uint256 tokenId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (tier > TIER_LEGENDARY) revert InvalidTier(tier);

        tokenId = nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);
        _tierOf[tokenId] = tier;
        emit SeedMinted(tokenId, recipient, tier, uri);
    }

    function _requestStructHash(ForgeRequest calldata request) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                FORGE_REQUEST_TYPEHASH,
                request.account,
                request.parentTokenId0,
                request.parentTokenId1,
                request.parentTokenId2,
                request.outputTier,
                request.descendantUriHash,
                request.feeWei,
                request.requestId,
                request.deadline
            )
        );
    }
}
