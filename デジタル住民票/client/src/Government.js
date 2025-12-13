import React, { useState, useEffect } from "react";
import "./App.css";
import "./Government.css";
import Web3 from "web3";
import CountryNFT from "./abis/CountryNFT.json";

const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1ODE0YTViYi1lYjA0LTQ2ZTMtYjQ4ZC1jZWQ5ZjM3MmM2YTkiLCJlbWFpbCI6InlvZG9nYXdhY2hhcmdlQGhvdG1haWwuY28uanAiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiM2RkNWYyZjQzZDg3N2NiNGNmZDYiLCJzY29wZWRLZXlTZWNyZXQiOiI0NjQzOGFlYjBjNTM3NDdkMjhkYjUyOTM1MTQ5ZGI1NDA2MWJhOWRmYmJiYmEzNzgwMjRkMGFkYzdhMWZmY2E2IiwiZXhwIjoxNzk2MDU5OTIzfQ.PIZimQpd_prVf7IE_l4ca3L3PuFvUkbzzvxHujSFUY8";

function Government() {
  const [account, setAccount] = useState("");
  const [nftContract, setNftContract] = useState(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [tokenId, setTokenId] = useState(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [mintedImageUrl, setMintedImageUrl] = useState("");
  const [myNFTs, setMyNFTs] = useState([]);

  useEffect(() => {
    loadWeb3().then(loadBlockchainData);
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", function (accounts) {
        setAccount(accounts[0]);
      });
    }
  }, []);

  const loadWeb3 = async () => {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
    } else {
      alert("MetaMask を有効にしてください");
    }
  };

  const loadBlockchainData = async () => {
    try {
      const web3 = window.web3;
      const accounts = await web3.eth.getAccounts();
      setAccount(accounts[0]);

      const contractAddress = "0x522307093BA5A31c5EBfeE26Fa4d6fA52546Ccdb"; // ★固定
      const contract = new web3.eth.Contract(CountryNFT.abi, contractAddress);
      setNftContract(contract);

      // 既存のNFTを取得
      await fetchMyNFTs(contract, accounts[0]);

    } catch (err) {
      console.error("Blockchain load error:", err);
    }
  };

  const fetchMyNFTs = async (contract, currentAccount) => {
    if (!contract || !currentAccount) return;

    try {
      // 過去のTransferイベントを全取得 (to: currentAccount でフィルタリングできればベストだが、
      // web3.jsのバージョンやプロバイダによってはfilterが効かないこともあるため、一旦全取得してフィルタする形も検討)
      // ここでは filter オプションを使ってみる
      const events = await contract.getPastEvents("Transfer", {
        filter: { to: currentAccount },
        fromBlock: 0,
        toBlock: "latest",
      });

      // 重複を除いたTokenIDリストを作成
      const tokenIds = new Set();
      events.forEach((event) => {
        tokenIds.add(event.returnValues.tokenId);
      });

      const nftList = [];
      const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");

      for (let id of tokenIds) {
        if (hiddenNFTs.includes(id)) continue;
        // 現在の所有者を確認 (Transferイベントだけだと過去の所有分も含まれるため)
        const owner = await contract.methods.ownerOf(id).call();
        if (owner.toLowerCase() === currentAccount.toLowerCase()) {
          const tokenURI = await contract.methods.tokenURI(id).call();
          // メタデータを取得
          try {
            // IPFSゲートウェイのURL調整 (必要に応じて)
            const response = await fetch(tokenURI);
            const metadata = await response.json();
            nftList.push({
              tokenId: id,
              ...metadata
            });
          } catch (e) {
            console.error(`Failed to fetch metadata for token ${id}`, e);
            // メタデータ取得失敗してもIDだけは表示するなどの対応も可
            nftList.push({ tokenId: id, name: "Unknown", image: null });
          }
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
    if (!name || !userAddress || !file) return alert("未入力があります");

    setIsIssuing(true);
    try {
      // ① 画像アップロード
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

      // ② メタデータアップロード
      const metadata = {
        name,
        description: "デジタル住民票NFT",
        attributes: [{ trait_type: "address", value: userAddress }],
        image: imageUrl,
      };

      const metadataUpload = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        }
      );

      const metadataJson = await metadataUpload.json();
      if (!metadataJson.IpfsHash) throw new Error("メタデータアップロード失敗");
      const tokenURI = `https://gateway.pinata.cloud/ipfs/${metadataJson.IpfsHash}`;

      // ③ NFT Mint
      const result = await nftContract.methods
        .mintNFT(account, tokenURI)
        .send({ from: account, gas: 500000 });

      // Token ID取得（強化版）
      let newTokenId = null;

      if (result?.events?.Transfer?.returnValues?.tokenId) {
        newTokenId = result.events.Transfer.returnValues.tokenId;
      }

      if (!newTokenId && result?.transactionHash) {
        const events = await nftContract.getPastEvents("Transfer", {
          fromBlock: result.blockNumber,
          toBlock: result.blockNumber,
        });
        if (events.length > 0) {
          newTokenId = events[0].returnValues.tokenId;
        }
      }

      if (newTokenId === null || newTokenId === undefined) {
        return alert("Token ID が取得できませんでした");
      }

      setTokenId(newTokenId);
      alert(`発行完了！ Token ID: ${newTokenId}`);

      // リスト更新
      await fetchMyNFTs(nftContract, account);

    } catch (err) {
      console.error(err);
      alert("発行中にエラーが発生しました");
    } finally {
      setIsIssuing(false);
    }
  };

  const transferNFT = async () => {
    if (!recipientAddress || tokenId == null) return alert("未入力");
    await nftContract.methods
      .transferFrom(account, recipientAddress, tokenId)
      .send({ from: account });
    alert("譲渡完了！");
    // リスト更新
    await fetchMyNFTs(nftContract, account);
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
      <h1>デジタル住民票 発行システム</h1>
      <p>アカウント: {account}</p>

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

      {tokenId !== null && (
        <div style={{ marginTop: "30px" }}>
          <h3>NFT 譲渡</h3>
          <input
            type="text"
            placeholder="譲渡先アドレス"
            onChange={(e) => setRecipientAddress(e.target.value)}
          />
          <button onClick={transferNFT}>譲渡</button>
        </div>
      )}

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
                <p style={{ fontSize: "12px", color: "#666" }}>ID: {nft.tokenId}</p>
                {/* 選択して譲渡できるようにする場合のボタンなどをここに追加可能 */}
                <button
                  onClick={() => setTokenId(nft.tokenId)}
                  style={{ marginTop: "5px", fontSize: "12px", padding: "4px 8px" }}
                >
                  このNFTを選択
                </button>
                <button
                  onClick={() => handleDelete(nft.tokenId)}
                  style={{
                    marginTop: "5px",
                    marginLeft: "5px",
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
    </div>
  );
}

export default Government;