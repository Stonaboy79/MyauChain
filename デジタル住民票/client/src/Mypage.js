import React, { useState, useEffect } from "react";
import "./Mypage.css";
import { ConnectButton, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";

// ★ TODO: Replace with the actual Package ID
const RESIDENT_CARD_PACKAGE_ID = "0x4c94cff97d1494d6d717aaf76bdb67a190791f0926f487f6f69c793db6d05252";
const RESIDENT_CARD_MODULE_NAME = "card";
const RESIDENT_CARD_TYPE = `${RESIDENT_CARD_PACKAGE_ID}::${RESIDENT_CARD_MODULE_NAME}::ResidentCard`;

const MYAU_PACKAGE_ID = "0x50299eab88df654c17d0389ade63889eb201666bfdd5d07326a39c299bbf74bf";
const MYAU_MODULE_NAME = "MeowToken";
const MYAU_COIN_TYPE = `${MYAU_PACKAGE_ID}::${MYAU_MODULE_NAME}::MEOWTOKEN`;

function Mypage() {
    const suiClient = useSuiClient();
    const currentAccount = useCurrentAccount();
    const [myNFTs, setMyNFTs] = useState([]);
    const [myauBalance, setMyauBalance] = useState("0");

    useEffect(() => {
        if (currentAccount) {
            fetchMyauBalance(currentAccount.address);
            fetchMyNFTs(currentAccount.address);
        } else {
            setMyauBalance("0");
            setMyNFTs([]);
        }
    }, [currentAccount, suiClient]);

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

    const fetchMyNFTs = async (address) => {
        try {
            if (!RESIDENT_CARD_PACKAGE_ID.startsWith("0x") || RESIDENT_CARD_PACKAGE_ID.includes("YOUR_PACKAGE_ID")) {
                return; // Skip if package ID is not set
            }

            const result = await suiClient.getOwnedObjects({
                owner: address,
                filter: { StructType: RESIDENT_CARD_TYPE },
                options: { showContent: true, showDisplay: true },
            });

            const nftList = [];
            const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");

            for (const obj of result.data) {
                const id = obj.data.objectId;
                if (hiddenNFTs.includes(id)) continue;

                if (obj.data?.content?.dataType === "moveObject") {
                    const fields = obj.data.content.fields;
                    nftList.push({
                        tokenId: id,
                        name: fields.name,
                        image: fields.image_url,
                        address: fields.user_address,
                    });
                }
            }
            setMyNFTs(nftList);
        } catch (error) {
            console.error("Error loading NFTs:", error);
        }
    };

    const handleDelete = (tokenId) => {
        if (!window.confirm("この住民票を削除（非表示に）しますか？")) return;
        const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
        hiddenNFTs.push(tokenId.toString());
        localStorage.setItem("hiddenNFTs", JSON.stringify(hiddenNFTs));
        setMyNFTs(myNFTs.filter(nft => nft.tokenId !== tokenId));
    };

    return (
        <div className="mypage-container">
            <header className="mypage-header">
                <h1>マイページ (Sui)</h1>
                <div style={{ marginBottom: '10px' }}>
                    <ConnectButton />
                </div>
            </header>

            {currentAccount ? (
                <>
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
                                            <span style={{ fontSize: "0.7em", marginLeft: "10px", fontWeight: "normal", color: "#555" }}>
                                                {nft.address}
                                            </span>
                                        </h3>
                                        <p>ID: {nft.tokenId.slice(0, 8)}...</p>
                                        <button className="delete-button" onClick={() => handleDelete(nft.tokenId)}>削除</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="myau-section">
                        <h2>Myau Token (Sui)</h2>
                        <div className="sui-info">
                            <p>Connected: {currentAccount.address}</p>
                            <p>Myau Balance: {myauBalance}</p>
                        </div>
                    </section>
                </>
            ) : (
                <p>ウォレットを接続してください。</p>
            )}
        </div>
    );
}

export default Mypage;
