// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Permissioned testnet ownership-interest token for one property entity.
/// @dev This contract does not create legal rights by itself. The off-chain legal
///      agreement for the property entity must define the enforceable rights.
contract PropertyInterestToken is ERC20, ERC20Pausable, Ownable {
    bytes32 public immutable propertyId;
    uint256 public immutable maxSupply;
    bytes32 public legalAgreementHash;

    mapping(address account => bool allowed) public isAllowed;

    error ZeroPropertyId();
    error ZeroAgreementHash();
    error InvalidMaxSupply();
    error SenderNotAllowed(address account);
    error RecipientNotAllowed(address account);
    error SupplyCapExceeded();

    event WalletPermissionUpdated(address indexed account, bool allowed);
    event LegalAgreementHashUpdated(bytes32 indexed previousHash, bytes32 indexed newHash);

    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 propertyId_,
        bytes32 legalAgreementHash_,
        uint256 maxSupply_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (propertyId_ == bytes32(0)) revert ZeroPropertyId();
        if (legalAgreementHash_ == bytes32(0)) revert ZeroAgreementHash();
        if (maxSupply_ == 0) revert InvalidMaxSupply();

        propertyId = propertyId_;
        legalAgreementHash = legalAgreementHash_;
        maxSupply = maxSupply_;
        isAllowed[initialOwner] = true;
        emit WalletPermissionUpdated(initialOwner, true);
    }

    /// @dev Property units are discrete legal/economic units, so this pilot uses 0 decimals.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function setAllowed(address account, bool allowed) external onlyOwner {
        isAllowed[account] = allowed;
        emit WalletPermissionUpdated(account, allowed);
    }

    function setAllowedBatch(address[] calldata accounts, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            isAllowed[accounts[i]] = allowed;
            emit WalletPermissionUpdated(accounts[i], allowed);
        }
    }

    function updateLegalAgreementHash(bytes32 newHash) external onlyOwner whenPaused {
        if (newHash == bytes32(0)) revert ZeroAgreementHash();
        bytes32 previous = legalAgreementHash;
        legalAgreementHash = newHash;
        emit LegalAgreementHashUpdated(previous, newHash);
    }

    function mint(address to, uint256 units) external onlyOwner {
        if (!isAllowed[to]) revert RecipientNotAllowed(to);
        if (totalSupply() + units > maxSupply) revert SupplyCapExceeded();
        _mint(to, units);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && !isAllowed[from]) revert SenderNotAllowed(from);
        if (to != address(0) && !isAllowed[to]) revert RecipientNotAllowed(to);
        super._update(from, to, value);
    }
}
