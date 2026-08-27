// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PropertyRegistry} from "./PropertyRegistry.sol";

/// @notice One non-transferable 3D identity NFT for a verified real-property record.
/// @dev This Passport is deliberately NOT the deed and NOT the investment security.
///      It is a public digital-twin identity anchored to the separately verified
///      registry record. Economic rights live in the legal documents and the
///      permissioned PropertyInterestToken, not in this NFT.
contract PropertyPassport is ERC721, Ownable {
    PropertyRegistry public immutable propertyRegistry;

    mapping(bytes32 propertyId => bool minted) public passportMinted;
    mapping(uint256 tokenId => bytes32 propertyId) public passportPropertyId;

    error InvalidRegistry();
    error PropertyNotVerified(bytes32 propertyId);
    error PassportAlreadyMinted(bytes32 propertyId);
    error PassportNonTransferable();

    event PropertyPassportMinted(bytes32 indexed propertyId, uint256 indexed tokenId, address indexed custodian);

    constructor(address initialOwner, PropertyRegistry propertyRegistry_)
        ERC721("Voxel Vault Property Passport", "VVPP")
        Ownable(initialOwner)
    {
        if (address(propertyRegistry_) == address(0)) revert InvalidRegistry();
        propertyRegistry = propertyRegistry_;
    }

    /// @notice Mints the one identity NFT for a property only after the registry
    ///         has been explicitly verified by the registry authority.
    /// @dev The Passport is held by an issuer/platform-approved custodian address
    ///      and is non-transferable so it cannot be traded as if it were a deed.
    function mintVerifiedPassport(bytes32 propertyId, address custodian) external onlyOwner returns (uint256 tokenId) {
        PropertyRegistry.PropertyRecord memory record = propertyRegistry.getProperty(propertyId);
        if (!record.verified) revert PropertyNotVerified(propertyId);
        if (passportMinted[propertyId]) revert PassportAlreadyMinted(propertyId);

        tokenId = uint256(propertyId);
        passportMinted[propertyId] = true;
        passportPropertyId[tokenId] = propertyId;
        _safeMint(custodian, tokenId);

        emit PropertyPassportMinted(propertyId, tokenId, custodian);
    }

    /// @notice Metadata always resolves through the verified property registry so
    ///         the spatial twin and public diligence references have one source.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        bytes32 propertyId = passportPropertyId[tokenId];
        PropertyRegistry.PropertyRecord memory record = propertyRegistry.getProperty(propertyId);
        return record.metadataURI;
    }

    /// @dev Block wallet-to-wallet transfers. Minting from zero is allowed.
    ///      No public burn function is exposed in this pilot.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert PassportNonTransferable();
        return super._update(to, tokenId, auth);
    }
}
