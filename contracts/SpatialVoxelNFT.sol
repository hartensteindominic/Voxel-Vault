// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SpatialVoxelNFT is ERC721URIStorage, Ownable, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public voucherSigner;
    address payable public feeRecipient;
    uint256 public mintFeeWei;
    uint256 public nextTokenId = 1;

    mapping(bytes32 => bool) public usedVouchers;

    event SpatialVoxelMinted(uint256 indexed tokenId, address indexed owner, bytes32 indexed voucherId, string tokenURI);
    event VoucherSignerUpdated(address indexed previousSigner, address indexed nextSigner);
    event FeeRecipientUpdated(address indexed previousRecipient, address indexed nextRecipient);
    event MintFeeUpdated(uint256 previousFeeWei, uint256 nextFeeWei);

    error VoucherAlreadyUsed();
    error InvalidVoucherSignature();
    error IncorrectPlatformFee(uint256 expected, uint256 received);
    error FeeTransferFailed();
    error ZeroAddress();

    constructor(
        address initialOwner,
        address initialVoucherSigner,
        address payable initialFeeRecipient,
        uint256 initialMintFeeWei
    ) ERC721("VoxelVault Spatial", "VVS") Ownable(initialOwner) {
        if (initialOwner == address(0) || initialVoucherSigner == address(0) || initialFeeRecipient == address(0)) revert ZeroAddress();
        voucherSigner = initialVoucherSigner;
        feeRecipient = initialFeeRecipient;
        mintFeeWei = initialMintFeeWei;
    }

    function mintWithVoucher(string calldata uri, bytes32 voucherId, bytes calldata signature)
        external
        payable
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (usedVouchers[voucherId]) revert VoucherAlreadyUsed();
        if (msg.value != mintFeeWei) revert IncorrectPlatformFee(mintFeeWei, msg.value);

        bytes32 uriHash = keccak256(bytes(uri));
        bytes32 digest = keccak256(abi.encodePacked(msg.sender, uriHash, voucherId));
        address recovered = digest.toEthSignedMessageHash().recover(signature);
        if (recovered != voucherSigner) revert InvalidVoucherSignature();

        usedVouchers[voucherId] = true;
        tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        if (mintFeeWei > 0) {
            (bool sent,) = feeRecipient.call{value: mintFeeWei}("");
            if (!sent) revert FeeTransferFailed();
        }

        emit SpatialVoxelMinted(tokenId, msg.sender, voucherId, uri);
    }

    function setVoucherSigner(address nextSigner) external onlyOwner {
        if (nextSigner == address(0)) revert ZeroAddress();
        address previous = voucherSigner;
        voucherSigner = nextSigner;
        emit VoucherSignerUpdated(previous, nextSigner);
    }

    function setFeeRecipient(address payable nextRecipient) external onlyOwner {
        if (nextRecipient == address(0)) revert ZeroAddress();
        address previous = feeRecipient;
        feeRecipient = nextRecipient;
        emit FeeRecipientUpdated(previous, nextRecipient);
    }

    function setMintFeeWei(uint256 nextFeeWei) external onlyOwner {
        uint256 previous = mintFeeWei;
        mintFeeWei = nextFeeWei;
        emit MintFeeUpdated(previous, nextFeeWei);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
