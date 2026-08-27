// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Registry that links a platform property ID to its issuer entity,
///         permissioned interest token and hashed diligence references.
contract PropertyRegistry is Ownable {
    struct PropertyRecord {
        address issuer;
        address interestToken;
        bytes32 legalEntityHash;
        bytes32 deedRecordHash;
        string metadataURI;
        bool verified;
        bool active;
    }

    mapping(bytes32 propertyId => PropertyRecord record) private _records;

    error ZeroPropertyId();
    error PropertyAlreadyRegistered(bytes32 propertyId);
    error PropertyNotRegistered(bytes32 propertyId);
    error InvalidIssuer();
    error InvalidInterestToken();

    event PropertyRegistered(bytes32 indexed propertyId, address indexed issuer, address indexed interestToken);
    event PropertyVerificationUpdated(bytes32 indexed propertyId, bool verified);
    event PropertyActiveUpdated(bytes32 indexed propertyId, bool active);
    event PropertyMetadataUpdated(bytes32 indexed propertyId, string metadataURI);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerProperty(
        bytes32 propertyId,
        address issuer,
        address interestToken,
        bytes32 legalEntityHash,
        bytes32 deedRecordHash,
        string calldata metadataURI
    ) external onlyOwner {
        if (propertyId == bytes32(0)) revert ZeroPropertyId();
        if (_records[propertyId].issuer != address(0)) revert PropertyAlreadyRegistered(propertyId);
        if (issuer == address(0)) revert InvalidIssuer();
        if (interestToken == address(0)) revert InvalidInterestToken();

        _records[propertyId] = PropertyRecord({
            issuer: issuer,
            interestToken: interestToken,
            legalEntityHash: legalEntityHash,
            deedRecordHash: deedRecordHash,
            metadataURI: metadataURI,
            verified: false,
            active: false
        });

        emit PropertyRegistered(propertyId, issuer, interestToken);
    }

    function setVerified(bytes32 propertyId, bool verified) external onlyOwner {
        PropertyRecord storage record = _requireRecord(propertyId);
        record.verified = verified;
        if (!verified) record.active = false;
        emit PropertyVerificationUpdated(propertyId, verified);
    }

    function setActive(bytes32 propertyId, bool active) external onlyOwner {
        PropertyRecord storage record = _requireRecord(propertyId);
        require(!active || record.verified, "PROPERTY_NOT_VERIFIED");
        record.active = active;
        emit PropertyActiveUpdated(propertyId, active);
    }

    function updateMetadata(bytes32 propertyId, string calldata metadataURI) external onlyOwner {
        PropertyRecord storage record = _requireRecord(propertyId);
        record.metadataURI = metadataURI;
        emit PropertyMetadataUpdated(propertyId, metadataURI);
    }

    function getProperty(bytes32 propertyId) external view returns (PropertyRecord memory) {
        PropertyRecord memory record = _records[propertyId];
        if (record.issuer == address(0)) revert PropertyNotRegistered(propertyId);
        return record;
    }

    function _requireRecord(bytes32 propertyId) internal view returns (PropertyRecord storage record) {
        record = _records[propertyId];
        if (record.issuer == address(0)) revert PropertyNotRegistered(propertyId);
    }
}
