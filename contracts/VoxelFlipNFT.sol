// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title VoxelFlip 3D Collectibles
/// @notice Mints only server-authorized VoxelPop meshes. Each voucher can be used once.
contract VoxelFlipNFT is ERC721, ERC721URIStorage, ERC721Royalty, Ownable {
    using MessageHashUtils for bytes32;

    uint256 private _nextTokenId = 1;
    address public mintSigner;
    address public royaltyReceiver;
    uint96 public royaltyBps;
    string private _contractMetadataURI;

    mapping(bytes32 => bool) public usedVouchers;

    event VoxelFlipMinted(uint256 indexed tokenId, address indexed owner, bytes32 indexed voucherId, string tokenURI);
    event MintSignerUpdated(address indexed signer);
    event RoyaltyUpdated(address indexed receiver, uint96 bps);
    event ContractURIUpdated();

    constructor(
        address initialOwner,
        address initialMintSigner,
        address initialRoyaltyReceiver,
        uint96 initialRoyaltyBps,
        string memory initialContractURI
    ) ERC721("VoxelFlip by Voxel Vault", "VFLIP") Ownable(initialOwner) {
        require(initialMintSigner != address(0), "Mint signer required");
        require(initialRoyaltyReceiver != address(0), "Royalty receiver required");
        require(initialRoyaltyBps <= 1000, "Royalty too high");
        mintSigner = initialMintSigner;
        royaltyReceiver = initialRoyaltyReceiver;
        royaltyBps = initialRoyaltyBps;
        _contractMetadataURI = initialContractURI;
        _setDefaultRoyalty(initialRoyaltyReceiver, initialRoyaltyBps);
    }

    function mintWithVoucher(string calldata uri, bytes32 voucherId, bytes calldata signature)
        external
        returns (uint256 tokenId)
    {
        require(bytes(uri).length > 0, "Token URI required");
        require(voucherId != bytes32(0), "Voucher required");
        require(!usedVouchers[voucherId], "Voucher already used");

        bytes32 uriHash = keccak256(bytes(uri));
        bytes32 digest = keccak256(abi.encodePacked(msg.sender, uriHash, voucherId)).toEthSignedMessageHash();
        require(ECDSA.recover(digest, signature) == mintSigner, "Invalid mint voucher");

        usedVouchers[voucherId] = true;
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        emit VoxelFlipMinted(tokenId, msg.sender, voucherId, uri);
    }

    function setMintSigner(address signer) external onlyOwner {
        require(signer != address(0), "Invalid signer");
        mintSigner = signer;
        emit MintSignerUpdated(signer);
    }

    /// @notice Updates the collection-wide ERC-2981 royalty for existing and future VoxelFlip tokens.
    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        require(receiver != address(0), "Invalid receiver");
        require(bps <= 1000, "Royalty too high");
        royaltyReceiver = receiver;
        royaltyBps = bps;
        _setDefaultRoyalty(receiver, bps);
        emit RoyaltyUpdated(receiver, bps);
    }

    function setContractURI(string calldata uri) external onlyOwner {
        _contractMetadataURI = uri;
        emit ContractURIUpdated();
    }

    function contractURI() external view returns (string memory) {
        return _contractMetadataURI;
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _burn(tokenId);
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
