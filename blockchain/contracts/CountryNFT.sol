// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract CountryNFT is ERC721URIStorage {
    uint256 private _tokenIdCounter;

    constructor()
        ERC721("DigitalResidentCard", "DRC")
    {}

    function mintNFT(address recipient, string memory tokenURI)
        public
        returns (uint256)
    {
        uint256 newTokenId = _tokenIdCounter;
        _safeMint(recipient, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        _tokenIdCounter++;
        return newTokenId;
    }
}
