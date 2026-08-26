// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract MockVoxelFlipParent is ERC721, ERC721URIStorage {
    uint256 private _nextTokenId = 1;
    uint256 public failBurnTokenId;

    constructor() ERC721("Mock VoxelFlip", "MVF") {}

    function mint(address recipient, string calldata uri) external returns (uint256 tokenId) {
        tokenId = _mintWithUri(recipient, uri);
    }

    function mintThree(address recipient, string[3] calldata uris)
        external
        returns (uint256[3] memory tokenIds)
    {
        for (uint256 i = 0; i < 3; i++) {
            tokenIds[i] = _mintWithUri(recipient, uris[i]);
        }
    }

    function setTokenURIForTest(uint256 tokenId, string calldata uri) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _setTokenURI(tokenId, uri);
    }

    function setFailBurnTokenId(uint256 tokenId) external {
        failBurnTokenId = tokenId;
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(tokenId != failBurnTokenId, "Forced burn failure");
        _burn(tokenId);
    }

    function _mintWithUri(address recipient, string memory uri) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
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
