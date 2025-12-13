import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import CountryNFT from "./abis/CountryNFT.json";
import "./Mypage.css";

const MYAU_PACKAGE_ID = "0x50299eab88df654c17d0389ade63889eb201666bfdd5d07326a39c299bbf74bf";
const TREASURY_CAP_ID = "0x72c685060d17a5cfe77fd1509f2ece68e7dedd020711ee40588244d9f8491b6c";
const MYAU_MODULE_NAME = "MeowToken";   // モジュール名そのまま
const MYAU_COIN_TYPE = `${MYAU_PACKAGE_ID}::${MYAU_MODULE_NAME}::MEOWTOKEN`;

function Mypage() {
    const [account, setAccount] = useState("");
    const [myNFTs, setMyNFTs] = useState([]);

    // Sui hooks
    const suiClient = useSuiClient();
    const currentSuiAccount = useCurrentAccount();

    const [myauBalance, setMyauBalance] = useState("0");

    // Debug Search State
    const [searchId, setSearchId] = useState("");
    const [searchResult, setSearchResult] = useState(null);

    useEffect(() => {
        loadWeb3();
        loadBlockchainData();

        if (window.ethereum) {
            window.ethereum.on("accountsChanged", function (accounts) {
                setAccount(accounts[0]);
                window.location.reload();
            });
        }
    }, []);

    useEffect(() => {
        if (currentSuiAccount) {
            fetchMyauBalance(currentSuiAccount.address);
        } else {
            setMyauBalance("0");
        }
    }, [currentSuiAccount]);

    const loadWeb3 = async () => {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
        } else {
            alert("MetaMask が必要です");
        }
    };

    const loadBlockchainData = async () => {
        const web3 = window.web3;
        if (!web3) return;
        const accounts = await web3.eth.getAccounts();
        setAccount(accounts[0]);

        const contractAddress = "0x522307093BA5A31c5EBfeE26Fa4d6fA52546Ccdb";
        const contract = new web3.eth.Contract(CountryNFT.abi, contractAddress);

        try {
            const events = await contract.getPastEvents("Transfer", {
                fromBlock: 0,
                toBlock: "latest",
            });
            console.log("All Transfer Events:", events);

            // Filter events where the current account is the recipient
            const myEvents = events.filter(e => e.returnValues.to.toLowerCase() === accounts[0].toLowerCase());
            console.log("My Received Events:", myEvents);

            const tokenIds = [...new Set(myEvents.map(e => e.returnValues.tokenId.toString()))];
            console.log("Potential Token IDs:", tokenIds);

            const nftList = [];

            const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
            console.log("Hidden IDs:", hiddenNFTs);

            for (let id of tokenIds) {
                if (hiddenNFTs.includes(id)) {
                    console.log(`ID ${id} is hidden locally.`);
                    continue;
                }

                try {
                    const owner = await contract.methods.ownerOf(id).call();
                    console.log(`ID ${id} Owner: ${owner}, Me: ${accounts[0]}`);

                    if (owner.toLowerCase() !== accounts[0].toLowerCase()) {
                        console.log(`ID ${id} is owned by someone else.`);
                        continue;
                    }

                    const tokenURI = await contract.methods.tokenURI(id).call();
                    const metadata = await fetch(tokenURI).then(res => res.json());
                    nftList.push({ tokenId: id, ...metadata });
                } catch (e) {
                    console.error(`Error processing ID ${id}:`, e);
                }
            }

            console.log("Final NFT List:", nftList);
            setMyNFTs(nftList);
        } catch (error) {
            console.error("Error loading blockchain data:", error);
        }
    };

    // ---------- Sui ----------
    const fetchMyauBalance = async (address) => {
        try {
            const balance = await suiClient.getBalance({
                owner: address,
                coinType: MYAU_COIN_TYPE,
            });
            setMyauBalance(balance.totalBalance);
        } catch (error) {
            console.error("Failed to fetch Myau balance", error);
        }
    };

    const handleDelete = (tokenId) => {
        if (!window.confirm("この住民票を削除（非表示に）しますか？")) return;
        const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
        hiddenNFTs.push(tokenId.toString());
        localStorage.setItem("hiddenNFTs", JSON.stringify(hiddenNFTs));
        setMyNFTs(myNFTs.filter(nft => nft.tokenId !== tokenId));
    };

    // Debug Search Function
    const handleSearch = async () => {
        if (!searchId) return;
        setSearchResult(null);

        try {
            const web3 = window.web3;
            const contractAddress = "0x522307093BA5A31c5EBfeE26Fa4d6fA52546Ccdb";
            const contract = new web3.eth.Contract(CountryNFT.abi, contractAddress);

            const owner = await contract.methods.ownerOf(searchId).call();
            const tokenURI = await contract.methods.tokenURI(searchId).call();
            let metadata = {};
            try {
                metadata = await fetch(tokenURI).then(res => res.json());
            } catch (e) {
                metadata = { name: "Error fetching metadata", image: null };
            }

            const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
            const isHidden = hiddenNFTs.includes(searchId);

            setSearchResult({
                id: searchId,
                owner,
                isHidden,
                ...metadata
            });

        } catch (error) {
            console.error(error);
            setSearchResult({ error: "Not found or error occurred" });
        }
    };

    const restoreHidden = (id) => {
        const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
        const newHidden = hiddenNFTs.filter(hid => hid !== id);
        localStorage.setItem("hiddenNFTs", JSON.stringify(newHidden));
        alert("Restored! Please reload.");
        window.location.reload();
    };

    return (
        <div className="mypage-container">
            <header className="mypage-header">
                <h1>マイページ</h1>
                <p>Wallet: {account}</p>
            </header>

            <section className="nft-section">
                <h2>保有するデジタル住民票</h2>
                <div className="nft-grid">
                    {myNFTs.length === 0 ? (
                        <p>デジタル住民票を持っていません。</p>
                    ) : (
                        myNFTs.map((nft) => (
                            <div key={nft.tokenId} className="nft-card">
                                <img src={nft.image} alt={nft.name} className="nft-image" />
                                <h3>
                                    {nft.name}
                                    {/* Try multiple potential locations for address */}
                                    {(
                                        // 1. attributes array
                                        (nft.attributes && nft.attributes.find && nft.attributes.find(attr => attr.trait_type === "address" || attr.trait_type === "Address")?.value) ||
                                        // 2. Direct property
                                        nft.address ||
                                        // 3. description if it contains address
                                        ""
                                    ) && (
                                            <span style={{ fontSize: "0.7em", marginLeft: "10px", fontWeight: "normal", color: "#555" }}>
                                                {(nft.attributes && nft.attributes.find && nft.attributes.find(attr => attr.trait_type === "address" || attr.trait_type === "Address")?.value) || nft.address}
                                            </span>
                                        )}
                                </h3>
                                <p>ID: {nft.tokenId}</p>
                                <button className="delete-button" onClick={() => handleDelete(nft.tokenId)}>削除</button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Debug Search Tool */}
            <section style={{ marginTop: "40px", padding: "20px", borderTop: "2px dashed #ccc" }}>
                <h3>🔍 デジタル住民票 検索・救出ツール</h3>
                <p style={{ fontSize: "0.9em", color: "#666" }}>
                    表示されない住民票がある場合、ここでIDを入力して確認してください。
                </p>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
                    <input
                        type="number"
                        placeholder="Token ID (例: 0)"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        style={{ padding: "8px" }}
                    />
                    <button onClick={handleSearch} style={{ padding: "8px 16px" }}>検索</button>
                </div>

                {searchResult && (
                    <div style={{ background: "#f9f9f9", padding: "15px", borderRadius: "8px" }}>
                        {searchResult.error ? (
                            <p style={{ color: "red" }}>{searchResult.error}</p>
                        ) : (
                            <div>
                                <p><strong>ID:</strong> {searchResult.id}</p>
                                <p><strong>Owner:</strong> {searchResult.owner}</p>
                                <p><strong>Hidden locally:</strong> {searchResult.isHidden ? "YES (非表示になっています)" : "NO"}</p>
                                {searchResult.image && (
                                    <img src={searchResult.image} alt="Found" style={{ width: "100px", marginTop: "10px" }} />
                                )}
                                <div style={{ marginTop: "10px" }}>
                                    {searchResult.owner.toLowerCase() === account.toLowerCase() ? (
                                        <span style={{ color: "green", fontWeight: "bold" }}>あなたは所有者です。</span>
                                    ) : (
                                        <span style={{ color: "red", fontWeight: "bold" }}>所有者が異なります ({searchResult.owner})。</span>
                                    )}
                                </div>
                                {searchResult.isHidden && (
                                    <button
                                        onClick={() => restoreHidden(searchResult.id)}
                                        style={{ marginTop: "10px", background: "#4CAF50", color: "white", padding: "5px 10px", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                    >
                                        再表示する (Unhide)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="myau-section">
                <h2>Myau Token (Sui)</h2>
                <div className="sui-connect-wrapper">
                    <p style={{ marginBottom: '5px' }}>Connect Wallet:</p>
                    <ConnectButton />
                </div>
                {currentSuiAccount && (
                    <div className="sui-info">
                        <p>Connected: {currentSuiAccount.address}</p>
                        <p>Myau Balance: {myauBalance}</p>
                    </div>
                )}
            </section>
        </div>
    );
}

export default Mypage;
