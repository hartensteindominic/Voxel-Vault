// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IVoxelForgeParent is IERC721 {
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function burn(uint256 tokenId) external;
}

/// @notice Atomic 3-to-1 Forge for VoxelFlip parents.
/// @dev Parents are transferred to this contract and burned before a descendant is minted.
///      Any failure reverts the entire transaction, including earlier parent transfers/burns.
contract VoxelForgeAtomic is ERC721, ERC721URIStorage, ERC721Royalty, Ownable, Pausable, ReentrancyGuard, EIP712 {
    using Address for address payable;
    using ECDSA for bytes32;

    uint96 public constant MAX_ROYALTY_BPS = 1000;

    bytes32 public constant FORGE_VOUCHER_TYPEHASH = keccak256(
        "ForgeVoucher(address account,uint256 parentTokenId0,uint256 parentTokenId1,uint256 parentTokenId2,bytes32 parentMetadataHash0,bytes32 parentMetadataHash1,bytes32 parentMetadataHash2,bytes32 recipeHash,bytes32 descendantUriHash,uint256 feeWei,bytes32 voucherId,uint64 deadline)"
    );

    struct ForgeVoucher {
        address account;
        uint256 parentTokenId0;
        uint256 parentTokenId1;
        uint256 parentTokenId2;
        bytes32 parentMetadataHash0;
        bytes32 parentMetadataHash1;
        bytes32 parentMetadataHash2;
        bytes32 recipeHash;
        bytes32 descendantUriHash;
        uint256 feeWei;
        bytes32 voucherId;
        uint64 deadline;
    }

    struct Lineage {
        uint256[3] parentTokenIds;
        bytes32[3] parentMetadataHashes;
        bytes32 recipeHash;
        bytes32 voucherId;
    }

    IVoxelForgeParent public immutable parentCollection;
    address public forgeSigner;
    address public feeRecipient;
    uint256 private _nextTokenId = 1;

    mapping(bytes32 => bool) public usedVouchers;
    mapping(uint256 => Lineage) private _lineage;

    error ZeroAddress();
    error InvalidRoyalty();
    error InvalidForgeAccount();
    error DuplicateParent();
    error VoucherExpired();
    error VoucherAlreadyUsed();
    error IncorrectForgeFee();
    error InvalidDescendantURI();
    error InvalidRecipe();
    error InvalidForgeSignature();
    error ParentNotOwned(uint256 tokenId);
    error ParentMetadataChanged(uint256 tokenId);
    error ParentTransferFailed(uint256 tokenId);
    error NoFeesAvailable();

    event Forged(
        uint256 indexed descendantTokenId,
        address indexed account,
        bytes32 indexed recipeHash,
        uint256 parentTokenId0,
        uint256 parentTokenId1,
        uint256 parentTokenId2,
        bytes32 voucherId,
        uint256 feeWei
    );
    event ForgeSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event FeeRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    event ForgeFeesReleased(address indexed recipient, uint256 amount);

    constructor(
        address initialOwner,
        address parentCollectionAddress,
        address initialForgeSigner,
        address initialFeeRecipient,
        uint96 defaultRoyaltyBps
    )
        ERC721("VoxelForge Descendant", "VFORGE")
        EIP712("VoxelForge", "1")
        Ownable(initialOwner)
    {
        if (
            initialOwner == address(0)
                || parentCollectionAddress == address(0)
                || initialForgeSigner == address(0)
                || initialFeeRecipient == address(0)
        ) revert ZeroAddress();
        if (defaultRoyaltyBps > MAX_ROYALTY_BPS) revert InvalidRoyalty();

        parentCollection = IVoxelForgeParent(parentCollectionAddress);
        forgeSigner = initialForgeSigner;
        feeRecipient = initialFeeRecipient;
        _setDefaultRoyalty(initialFeeRecipient, defaultRoyaltyBps);
    }

    function forge(ForgeVoucher calldata voucher, string calldata descendantURI, bytes calldata signature)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 descendantTokenId)
    {
        if (voucher.account != msg.sender) revert InvalidForgeAccount();
        if (
            voucher.parentTokenId0 == voucher.parentTokenId1
                || voucher.parentTokenId0 == voucher.parentTokenId2
                || voucher.parentTokenId1 == voucher.parentTokenId2
        ) revert DuplicateParent();
        if (block.timestamp > voucher.deadline) revert VoucherExpired();
        if (usedVouchers[voucher.voucherId]) revert VoucherAlreadyUsed();
        if (msg.value != voucher.feeWei) revert IncorrectForgeFee();
        if (voucher.recipeHash == bytes32(0)) revert InvalidRecipe();
        if (keccak256(bytes(descendantURI)) != voucher.descendantUriHash) revert InvalidDescendantURI();

        bytes32 digest = _hashTypedDataV4(_voucherStructHash(voucher));
        if (digest.recover(signature) != forgeSigner) revert InvalidForgeSignature();

        uint256[3] memory parentTokenIds = [
            voucher.parentTokenId0,
            voucher.parentTokenId1,
            voucher.parentTokenId2
        ];
        bytes32[3] memory parentMetadataHashes = [
            voucher.parentMetadataHash0,
            voucher.parentMetadataHash1,
            voucher.parentMetadataHash2
        ];

        // Verify every parent before the first state-changing parent transfer.
        for (uint256 i = 0; i < 3; i++) {
            uint256 tokenId = parentTokenIds[i];
            if (parentCollection.ownerOf(tokenId) != msg.sender) revert ParentNotOwned(tokenId);
            if (keccak256(bytes(parentCollection.tokenURI(tokenId))) != parentMetadataHashes[i]) {
                revert ParentMetadataChanged(tokenId);
            }
        }

        // Mark before external calls. Any later revert restores this value automatically.
        usedVouchers[voucher.voucherId] = true;

        // The Forge contract becomes each token's owner before invoking the parent's owner-only burn.
        // If the second/third transfer or burn fails, EVM atomicity restores all earlier parents.
        for (uint256 i = 0; i < 3; i++) {
            uint256 tokenId = parentTokenIds[i];
            parentCollection.transferFrom(msg.sender, address(this), tokenId);
            if (parentCollection.ownerOf(tokenId) != address(this)) revert ParentTransferFailed(tokenId);
            parentCollection.burn(tokenId);
        }

        descendantTokenId = _nextTokenId++;
        _safeMint(msg.sender, descendantTokenId);
        _setTokenURI(descendantTokenId, descendantURI);
        _lineage[descendantTokenId] = Lineage({
            parentTokenIds: parentTokenIds,
            parentMetadataHashes: parentMetadataHashes,
            recipeHash: voucher.recipeHash,
            voucherId: voucher.voucherId
        });

        emit Forged(
            descendantTokenId,
            msg.sender,
            voucher.recipeHash,
            voucher.parentTokenId0,
            voucher.parentTokenId1,
            voucher.parentTokenId2,
            voucher.voucherId,
            voucher.feeWei
        );
    }

    function voucherDigest(ForgeVoucher calldata voucher) external view returns (bytes32) {
        return _hashTypedDataV4(_voucherStructHash(voucher));
    }

    function lineageOf(uint256 descendantTokenId)
        external
        view
        returns (
            uint256[3] memory parentTokenIds,
            bytes32[3] memory parentMetadataHashes,
            bytes32 recipeHash,
            bytes32 voucherId
        )
    {
        _requireOwned(descendantTokenId);
        Lineage storage lineage = _lineage[descendantTokenId];
        return (
            lineage.parentTokenIds,
            lineage.parentMetadataHashes,
            lineage.recipeHash,
            lineage.voucherId
        );
    }

    function accruedFees() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Anyone may release accrued fees, but they can only go to the configured fee recipient.
    function releaseFees() external nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoFeesAvailable();
        payable(feeRecipient).sendValue(amount);
        emit ForgeFeesReleased(feeRecipient, amount);
    }

    function setForgeSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address previous = forgeSigner;
        forgeSigner = newSigner;
        emit ForgeSignerUpdated(previous, newSigner);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address previous = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(previous, newRecipient);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        if (feeNumerator > MAX_ROYALTY_BPS) revert InvalidRoyalty();
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _voucherStructHash(ForgeVoucher calldata voucher) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                FORGE_VOUCHER_TYPEHASH,
                voucher.account,
                voucher.parentTokenId0,
                voucher.parentTokenId1,
                voucher.parentTokenId2,
                voucher.parentMetadataHash0,
                voucher.parentMetadataHash1,
                voucher.parentMetadataHash2,
                voucher.recipeHash,
                voucher.descendantUriHash,
                voucher.feeWei,
                voucher.voucherId,
                voucher.deadline
            )
        );
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
