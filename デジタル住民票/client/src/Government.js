import React, { useState, useEffect } from "react";
import "./App.css";
import "./Government.css";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

// ★ TODO: Deploy the contract and replace this with the actual Package ID
const RESIDENT_CARD_PACKAGE_ID = "0x4c94cff97d1494d6d717aaf76bdb67a190791f0926f487f6f69c793db6d05252";
const RESIDENT_CARD_MODULE_NAME = "card";
const RESIDENT_CARD_TYPE = `${RESIDENT_CARD_PACKAGE_ID}::${RESIDENT_CARD_MODULE_NAME}::ResidentCard`;

const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1ODE0YTViYi1lYjA0LTQ2ZTMtYjQ4ZC1jZWQ5ZjM3MmM2YTkiLCJlbWFpbCI6InlvZG9nYXdhY2hhcmdlQGhvdG1haWwuY28uanAiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5IjoiM2RkNWYyZjQzZDg3N2NiNGNmZDYiLCJzY29wZWRLZXlTZWNyZXQiOiI0NjQzOGFlYjBjNTM3NDdkMjhkYjUyOTM1MTQ5ZGI1NDA2MWJhOWRmYmJiYmEzNzgwMjRkMGFkYzdhMWZmY2E2IiwiZXhwIjoxNzk2MDU5OTIzfQ.PIZimQpd_prVf7IE_l4ca3L3PuFvUkbzzvxHujSFUY8";

function Government() {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [mintedImageUrl, setMintedImageUrl] = useState("");
  const [myNFTs, setMyNFTs] = useState([]);

  // Load NFTs when account changes
  useEffect(() => {
    if (currentAccount) {
      setUserAddress(currentAccount.address);
      fetchMyNFTs(currentAccount.address);
    } else {
      setMyNFTs([]);
    }
  }, [currentAccount, suiClient]);

  const fetchMyNFTs = async (address) => {
    try {
      if (!RESIDENT_CARD_PACKAGE_ID.startsWith("0x") || RESIDENT_CARD_PACKAGE_ID.includes("YOUR_PACKAGE_ID")) {
        console.warn("Package ID not set. Skipping fetch.");
        return;
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
            tokenId: id, // Use objectId as tokenId
            name: fields.name,
            image: fields.image_url, // Direct URL from Move struct
            address: fields.user_address,
          });
        }
      }
      setMyNFTs(nftList);
    } catch (err) {
      console.error("Fetch NFTs error:", err);
    }
  };

  const captureFile = (e) => setFile(e.target.files[0]);

  const issueResidentCard = async (event) => {
    event.preventDefault();
    if (!currentAccount) return alert("ウォレットを接続してください");
    if (!name || !userAddress || !file) return alert("未入力があります");
    if (RESIDENT_CARD_PACKAGE_ID.includes("YOUR_PACKAGE_ID")) return alert("Package IDが設定されていません。コードを確認してください。");

    setIsIssuing(true);
    try {
      // ① 画像アップロード (Pinata)
      const imageData = new FormData();
      imageData.append("file", file);

      const imageUpload = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${PINATA_JWT}` },
          body: imageData,
        }
      );

      const imageJson = await imageUpload.json();
      if (!imageJson.IpfsHash) throw new Error("画像アップロード失敗");
      const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageJson.IpfsHash}`;
      setMintedImageUrl(imageUrl);

      // ② Sui Mint Transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${RESIDENT_CARD_PACKAGE_ID}::${RESIDENT_CARD_MODULE_NAME}::mint`,
        arguments: [
          tx.pure.string(name),
          tx.pure.string("デジタル住民票NFT"),
          tx.pure.string(imageUrl),
          tx.pure.string(userAddress),
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log("Mint result:", result);
            alert("発行完了！");
            fetchMyNFTs(currentAccount.address);
          },
          onError: (err) => {
            console.error("Mint failed:", err);
            alert("発行に失敗しました: " + err.message);
          },
        }
      );

    } catch (err) {
      console.error(err);
      alert("発行中にエラーが発生しました");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleDelete = (tokenId) => {
    if (!window.confirm("この住民票を削除（非表示に）しますか？")) return;
    const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
    hiddenNFTs.push(tokenId.toString());
    localStorage.setItem("hiddenNFTs", JSON.stringify(hiddenNFTs));
    setMyNFTs(myNFTs.filter((nft) => nft.tokenId !== tokenId));
  };

  return (
    <div className="government-container">
      <h1>デジタル住民票 発行システム (Sui)</h1>
      <div style={{ marginBottom: "20px" }}>
        <ConnectButton />
      </div>

      {currentAccount ? (
        <>
          <p>アカウント: {currentAccount.address}</p>
          <form onSubmit={issueResidentCard}>
            <input
              type="text"
              placeholder="名前"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="text"
              placeholder="住所"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
            />
            <input type="file" onChange={captureFile} />
            <button type="submit" disabled={isIssuing}>
              {isIssuing ? "発行中..." : "住民票NFTを発行"}
            </button>
          </form>

          {mintedImageUrl && (
            <div style={{ marginTop: "20px" }}>
              <h3>発行された住民票</h3>
              <img
                src={mintedImageUrl}
                alt="Minted NFT"
                style={{ width: "300px", border: "1px solid #ccc" }}
              />
            </div>
          )}

          <div style={{ marginTop: "40px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
            <h2>My NFTs (デジタル住民票一覧)</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
              {myNFTs.length === 0 ? (
                <p>所有しているNFTはありません</p>
              ) : (
                myNFTs.map((nft) => (
                  <div key={nft.tokenId} style={{ border: "1px solid #ddd", padding: "10px", borderRadius: "8px", width: "200px" }}>
                    {nft.image ? (
                      <img
                        src={nft.image}
                        alt={nft.name}
                        style={{
                          width: "100%",
                          height: "120px",
                          borderRadius: "4px",
                          objectFit: "contain",
                          backgroundColor: "#f0f0f0",
                          display: "block"
                        }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "150px", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center" }}>No Image</div>
                    )}
                    <p style={{ fontWeight: "bold", margin: "10px 0 5px" }}>{nft.name}</p>
                    <p style={{ fontSize: "12px", color: "#666" }}>ID: {nft.tokenId.slice(0, 8)}...</p>
                    <button
                      onClick={() => handleDelete(nft.tokenId)}
                      style={{
                        marginTop: "5px",
                        fontSize: "12px",
                        padding: "4px 8px",
                        backgroundColor: "#ff4d4d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <p>ウォレットを接続してください。</p>
      )}
    </div>
  );
}

export default Government;