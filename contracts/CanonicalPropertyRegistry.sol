// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Canonical on-chain identity registry for human-verified real properties.
/// @dev This registry is deliberately separate from deeds, ownership interests,
///      rent rights and investment/security tokens. It stores only hashed references
///      plus a public metadata URI for the digital-twin identity.
contract CanonicalPropertyRegistry is Ownable {
    struct IdentityRecord {
        bytes32 claimHash;
        bytes32 sourceHash;
        string metadataURI;
        bool verified;
        uint64 registeredAt;
        uint64 verifiedAt;
    }

    mapping(bytes32 propertyId => IdentityRecord record) private _records;

    error ZeroPropertyId();
    error ZeroClaimHash();
    error ZeroSourceHash();
    error PropertyAlreadyRegistered(bytes32 propertyId);
    error PropertyNotRegistered(bytes32 propertyId);

    event PropertyIdentityRegistered(
        bytes32 indexed propertyId,
        bytes32 indexed claimHash,
        bytes32 indexed sourceHash,
        string metadataURI
    );
    event PropertyIdentityVerificationUpdated(bytes32 indexed propertyId, bool verified);
    event PropertyIdentityMetadataUpdated(bytes32 indexed propertyId, string metadataURI);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Registers one canonical candidate record. The property remains
    ///         unverified until a separate owner transaction calls setVerified.
    function registerIdentity(
        bytes32 propertyId,
        bytes32 claimHash,
        bytes32 sourceHash,
        string calldata metadataURI
    ) external onlyOwner {
        if (propertyId == bytes32(0)) revert ZeroPropertyId();
        if (claimHash == bytes32(0)) revert ZeroClaimHash();
        if (sourceHash == bytes32(0)) revert ZeroSourceHash();
        if (_records[propertyId].registeredAt != 0) revert PropertyAlreadyRegistered(propertyId);

        _records[propertyId] = IdentityRecord({
            claimHash: claimHash,
            sourceHash: sourceHash,
            metadataURI: metadataURI,
            verified: false,
            registeredAt: uint64(block.timestamp),
            verifiedAt: 0
        });

        emit PropertyIdentityRegistered(propertyId, claimHash, sourceHash, metadataURI);
    }

    /// @notice Verification is intentionally a second explicit owner action.
    function setVerified(bytes32 propertyId, bool verified) external onlyOwner {
        IdentityRecord storage record = _requireRecord(propertyId);
        record.verified = verified;
        record.verifiedAt = verified ? uint64(block.timestamp) : 0;
        emit PropertyIdentityVerificationUpdated(propertyId, verified);
    }

    function updateMetadata(bytes32 propertyId, string calldata metadataURI) external onlyOwner {
        IdentityRecord storage record = _requireRecord(propertyId);
        record.metadataURI = metadataURI;
        emit PropertyIdentityMetadataUpdated(propertyId, metadataURI);
    }

    function getIdentity(bytes32 propertyId) external view returns (IdentityRecord memory) {
        IdentityRecord memory record = _records[propertyId];
        if (record.registeredAt == 0) revert PropertyNotRegistered(propertyId);
        return record;
    }

    function _requireRecord(bytes32 propertyId) internal view returns (IdentityRecord storage record) {
        record = _records[propertyId];
        if (record.registeredAt == 0) revert PropertyNotRegistered(propertyId);
    }
}
