// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice Finite 8x8 digital-land collectible used only for the Voxel Vault Base Sepolia demo.
/// @dev These NFTs represent fictional digital parcels only. They are not deeds, real property,
///      rent rights, securities, or claims on any physical land.
contract VoxelTestLand is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant MAX_PARCELS = 64;
    uint256 public constant MINT_PRICE = 0.0001 ether;
    uint256 public totalMinted;

    error ParcelOutOfRange(uint256 parcelId);
    error ParcelAlreadyMinted(uint256 parcelId);
    error IncorrectPayment(uint256 expected, uint256 received);
    error WithdrawFailed();
    error UnsupportedDeploymentChain(uint256 chainId);

    event TestParcelMinted(uint256 indexed parcelId, address indexed owner, uint8 row, uint8 column);
    event TestFundsWithdrawn(address indexed owner, uint256 amount);

    constructor(address initialOwner) ERC721("Voxel Vault Test Land", "VVTL") Ownable(initialOwner) {
        // Base Sepolia in production; Hardhat local network is allowed only for CI tests.
        if (block.chainid != 84532 && block.chainid != 31337) {
            revert UnsupportedDeploymentChain(block.chainid);
        }
    }

    function mintParcel(uint256 parcelId) external payable nonReentrant {
        if (parcelId >= MAX_PARCELS) revert ParcelOutOfRange(parcelId);
        if (_ownerOf(parcelId) != address(0)) revert ParcelAlreadyMinted(parcelId);
        if (msg.value != MINT_PRICE) revert IncorrectPayment(MINT_PRICE, msg.value);

        unchecked {
            totalMinted += 1;
        }
        _safeMint(msg.sender, parcelId);

        (uint8 row, uint8 column) = parcelCoordinates(parcelId);
        emit TestParcelMinted(parcelId, msg.sender, row, column);
    }

    function parcelCoordinates(uint256 parcelId) public pure returns (uint8 row, uint8 column) {
        if (parcelId >= MAX_PARCELS) revert ParcelOutOfRange(parcelId);
        row = uint8(parcelId / 8);
        column = uint8(parcelId % 8);
    }

    function parcelOwner(uint256 parcelId) public view returns (address) {
        if (parcelId >= MAX_PARCELS) revert ParcelOutOfRange(parcelId);
        return _ownerOf(parcelId);
    }

    function parcelOwners() external view returns (address[] memory owners) {
        owners = new address[](MAX_PARCELS);
        for (uint256 parcelId = 0; parcelId < MAX_PARCELS; parcelId++) {
            owners[parcelId] = _ownerOf(parcelId);
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        (uint8 row, uint8 column) = parcelCoordinates(tokenId);
        string memory id = tokenId.toString();
        string memory rowText = uint256(row).toString();
        string memory columnText = uint256(column).toString();

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">',
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#151a34"/><stop offset="1" stop-color="#6d5dfc"/></linearGradient></defs>',
            '<rect width="800" height="800" fill="#05060b"/><path d="M100 250 400 90 700 250 400 410Z" fill="url(#g)" stroke="#c5bdff" stroke-width="8"/>',
            '<path d="M100 250v260l300 190V410Z" fill="#171b33"/><path d="M700 250v260L400 700V410Z" fill="#0c1023"/>',
            '<text x="400" y="530" text-anchor="middle" fill="white" font-family="Arial" font-size="46" font-weight="700">TEST LAND #', id, '</text>',
            '<text x="400" y="590" text-anchor="middle" fill="#aaa3ff" font-family="Arial" font-size="28">ROW ', rowText, ' · COL ', columnText, '</text>',
            '<text x="400" y="650" text-anchor="middle" fill="#818aa0" font-family="Arial" font-size="20">BASE SEPOLIA · NO REAL PROPERTY RIGHTS</text></svg>'
        );

        string memory json = string.concat(
            '{"name":"Voxel Vault Test Land #', id,
            '","description":"Base Sepolia-only fictional 3D digital land collectible. No deed, real property, rent, security, or investment rights.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"external_url":"https://www.voxelvault.io/vault/test-land?parcel=', id, '",',
            '"attributes":[{"trait_type":"Network","value":"Base Sepolia"},{"trait_type":"Row","value":', rowText,
            '},{"trait_type":"Column","value":', columnText, '},{"trait_type":"Real Property Rights","value":"None"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function withdrawTestFunds() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        (bool ok,) = payable(owner()).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit TestFundsWithdrawn(owner(), amount);
    }
}
