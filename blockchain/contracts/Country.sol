// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Country {
    // アドレスごとに複数のcountryHashを管理
    mapping(address => string[]) private countryHashes;

    // 全体のcountryHashを管理
    string[] private allCountryHashes;

    // countryHashを設定する関数
    function set(string memory _countryHash) public {
        // アドレスごとの配列に追加
        countryHashes[msg.sender].push(_countryHash);

        // 全体の配列にも追加
        allCountryHashes.push(_countryHash);
    }

    // 自分のcountryHashを全て取得する関数
    function getAllByAddress() public view returns (string[] memory) {
        return countryHashes[msg.sender];
    }

    // 全てのcountryHashを取得する関数
    function getAll() public view returns (string[] memory) {
        return allCountryHashes;
    }
}