import React, { useState, useEffect, useRef } from 'react';
import Web3 from 'web3';
import CountryNFT from '../abis/CountryNFT.json';
import { ConnectButton } from '@mysten/dapp-kit'; // Keep ConnectButton if needed for consistency, or just use MetaMask
import { User, QrCode, ShieldCheck, Sparkles, Upload, Camera, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1ODE0YTViYi1lYjA0LTQ2ZTMtYjQ4ZC1jZWQ5ZjM3MmM2YTkiLCJlbWFpbCI6InlvZG9nYXdhY2hhcmdlQGhvdG1haWwuY28uanAiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiM2RkNWYyZjQzZDg3N2NiNGNmZDYiLCJzY29wZWRLZXlTZWNyZXQiOiI0NjQzOGFlYjBjNTM3NDdkMjhkYjUyOTM1MTQ5ZGI1NDA2MWJhOWRmYmJiYmEzNzgwMjRkMGFkYzdhMWZmY2E2IiwiZXhwIjoxNzk2MDU5OTIzfQ.PIZimQpd_prVf7IE_l4ca3L3PuFvUkbzzvxHujSFUY8";

// Define strict types for window to avoid TS errors
declare global {
    interface Window {
        ethereum?: any;
        web3?: any;
    }
}

type ViewMode = 'list' | 'issue';

export const ResidentCard: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [account, setAccount] = useState("");
    const [myNFTs, setMyNFTs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Issue Form State
    const [file, setFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [userAddress, setUserAddress] = useState("");
    const [isIssuing, setIsIssuing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadWeb3();
        loadBlockchainData();

        if (window.ethereum) {
            window.ethereum.on("accountsChanged", function (accounts: string[]) {
                setAccount(accounts[0]);
                window.location.reload();
            });
        }
    }, []);

    const loadWeb3 = async () => {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            try {
                // Request account access if needed
                await window.ethereum.request({ method: "eth_requestAccounts" });
            } catch (error) {
                console.error("User denied account access");
            }
        }
    };

    const loadBlockchainData = async () => {
        setIsLoading(true);
        const web3 = window.web3;
        if (!web3) {
            setIsLoading(false);
            return;
        }

        try {
            const accounts = await web3.eth.getAccounts();
            setAccount(accounts[0]);

            const contractAddress = "0x522307093BA5A31c5EBfeE26Fa4d6fA52546Ccdb";
            const contract = new web3.eth.Contract(CountryNFT.abi, contractAddress);

            // Fetch NFTs logic (ported from Mypage.js)
            const events = await contract.getPastEvents("Transfer", {
                fromBlock: 0,
                toBlock: "latest",
            });

            const myEvents = events.filter((e: any) => e.returnValues.to.toLowerCase() === accounts[0].toLowerCase());
            const tokenIds = [...new Set(myEvents.map((e: any) => e.returnValues.tokenId.toString()))];

            const nftList = [];
            const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");

            for (let id of tokenIds) {
                // @ts-ignore
                if (hiddenNFTs.includes(id)) continue;

                try {
                    const owner: string = await contract.methods.ownerOf(id).call();
                    if (owner.toLowerCase() !== accounts[0].toLowerCase()) continue;

                    // Find the acquisition event for transaction hash
                    const acquisitionEvent = myEvents.find((e: any) => e.returnValues.tokenId.toString() === id);
                    const transactionHash = acquisitionEvent ? acquisitionEvent.transactionHash : "Unknown";

                    const tokenURI: string = await contract.methods.tokenURI(id).call();
                    let metadata = {};
                    try {
                        const res = await fetch(tokenURI);
                        metadata = await res.json();
                    } catch (e) {
                        metadata = { name: "Error fetching metadata", image: null };
                    }
                    nftList.push({ tokenId: id, transactionHash, ...metadata });
                } catch (e) {
                    console.error(`Error processing ID ${id}:`, e);
                }
            }
            setMyNFTs(nftList);
        } catch (error) {
            console.error("Error loading blockchain data:", error);
            // toast.error("Failed to load resident cards.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Actions ---

    const handleDelete = (tokenId: string) => {
        if (!window.confirm("この住民票を削除（非表示に）しますか？")) return;
        const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");
        hiddenNFTs.push(tokenId.toString());
        localStorage.setItem("hiddenNFTs", JSON.stringify(hiddenNFTs));
        setMyNFTs(myNFTs.filter(nft => nft.tokenId !== tokenId));
        toast.success("住民票を非表示にしました");
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const issueResidentCard = async () => {
        if (!name || !userAddress || !file) {
            toast.error("未入力の項目があります（写真、名前、住所）");
            return;
        }

        setIsIssuing(true);
        const loadingToast = toast.loading("発行処理中...");

        try {
            const web3 = window.web3;
            const accounts = await web3.eth.getAccounts();
            const currentAccount = accounts[0];

            const contractAddress = "0x522307093BA5A31c5EBfeE26Fa4d6fA52546Ccdb";
            const nftContract = new web3.eth.Contract(CountryNFT.abi, contractAddress);

            // 1. Upload Image to Pinata
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

            // 2. Upload Metadata
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

            // 3. Mint NFT
            const result = await nftContract.methods
                .mintNFT(currentAccount, tokenURI)
                .send({ from: currentAccount });

            toast.dismiss(loadingToast);
            toast.success("住民票の発行が完了しました！");

            setTimeout(() => {
                loadBlockchainData();
                setViewMode('list');
                // clear form
                setName("");
                setUserAddress("");
                setFile(null);
                setPreviewImage(null);
            }, 2000);

        } catch (err) {
            console.error(err);
            toast.dismiss(loadingToast);
            toast.error("発行中にエラーが発生しました");
        } finally {
            setIsIssuing(false);
        }
    };


    // --- Render ---

    if (viewMode === 'issue') {
        return (
            <div className="flex flex-col h-full p-4 overflow-y-auto">
                <div className="mb-4">
                    <button
                        onClick={() => setViewMode('list')}
                        className="text-sm text-blue-500 hover:underline mb-2 flex items-center gap-1"
                    >
                        &larr; 一覧に戻る
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">住民票 新規発行</h2>
                    <p className="text-xs text-slate-500">必要な情報を入力して発行してください。</p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto w-full pb-10">
                    {/* Image Upload */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 group overflow-hidden"
                    >
                        {previewImage ? (
                            <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <>
                                <div className="p-3 rounded-full bg-slate-200 group-hover:scale-110 transition-transform">
                                    <Camera className="w-6 h-6 text-slate-500" />
                                </div>
                                <span className="text-xs text-slate-500 font-medium">あなたの顔写真を選択</span>
                            </>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">名前</label>
                        <input
                            type="text"
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="山田 太郎"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">住所</label>
                        <input
                            type="text"
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="東京都渋谷区..."
                            value={userAddress}
                            onChange={(e) => setUserAddress(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={issueResidentCard}
                        disabled={isIssuing || !file}
                        className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isIssuing || !file
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'
                            }`}
                    >
                        {isIssuing ? (
                            "発行中..."
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                住民票を発行する
                            </>
                        )}
                    </button>
                    <div style={{ height: "20px" }}></div>
                </div>
            </div>
        );
    }

    // Default: List View
    return (
        <div className="flex flex-col h-full p-4 relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    マイページ
                </h2>
                <button
                    onClick={loadBlockchainData}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                    title="再読み込み"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {!account ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="p-4 bg-purple-100 rounded-full mb-2">
                        <ShieldCheck className="w-8 h-8 text-purple-600" />
                    </div>
                    <p className="text-sm text-slate-600">
                        デジタル住民票を表示するには<br />MetaMask等のウォレット接続が必要です。
                    </p>
                    <p className="text-xs text-red-500 bg-red-50 p-2 rounded">
                        ※Ethereum Sepolia等のネットワークを確認してください
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pb-20 space-y-4">
                    {/* Check if empty */}
                    {!isLoading && myNFTs.length === 0 && (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-sm text-slate-500 mb-4">デジタル住民票を持っていません。</p>
                            <button
                                onClick={() => setViewMode('issue')}
                                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-full shadow-md hover:bg-blue-700 transition"
                            >
                                発行手続きへ
                            </button>
                        </div>
                    )}

                    {/* NFT List */}
                    {myNFTs.map((nft) => {
                        // Extract address safely
                        const addressAttr = nft.attributes?.find((attr: any) =>
                            attr.trait_type === "address" || attr.trait_type === "Address"
                        );
                        const displayAddress = addressAttr?.value || nft.address || "";

                        // Extract Image Hash (IPFS CID)
                        let imageHash = "";
                        if (nft.image) {
                            const match = nft.image.match(/\/ipfs\/([a-zA-Z0-9]+)/);
                            if (match) {
                                imageHash = match[1];
                            } else if (nft.image.startsWith("ipfs://")) {
                                imageHash = nft.image.replace("ipfs://", "");
                            } else {
                                imageHash = "Not IPFS or unknown format";
                            }
                        }

                        return (
                            <div key={nft.tokenId} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative group">
                                <div className="flex flex-col items-center gap-4">
                                    {/* Image - Centered and larger if needed */}
                                    <div className="w-full aspect-square max-w-[200px] bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center">
                                        {nft.image ? (
                                            <img
                                                src={nft.image}
                                                alt={nft.name}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <User className="w-16 h-16" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="w-full min-w-0 space-y-3 text-center">
                                        {/* Name & Address */}
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-xl">
                                                {nft.name}
                                            </h3>
                                            {displayAddress && (
                                                <p className="text-sm text-slate-600 mt-1 break-all">
                                                    {displayAddress}
                                                </p>
                                            )}
                                        </div>

                                        {/* Technical Details */}
                                        <div className="grid grid-cols-1 gap-2 pt-3 border-t border-slate-100 text-left bg-slate-50 p-3 rounded-lg">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">住民票ID (Token ID)</span>
                                                <p className="font-mono text-xs text-slate-600 break-all">
                                                    {nft.tokenId}
                                                </p>
                                            </div>

                                            <div className="flex flex-col">
                                                <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Transaction ID</span>
                                                <p className="font-mono text-[10px] text-slate-500 break-all leading-tight">
                                                    {nft.transactionHash}
                                                </p>
                                            </div>

                                            <div className="flex flex-col">
                                                <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Image Hash</span>
                                                <p className="font-mono text-[10px] text-slate-500 break-all leading-tight">
                                                    {imageHash}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Delete Button (Absolute) */}
                                <button
                                    onClick={() => handleDelete(nft.tokenId)}
                                    className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    title="削除（非表示）"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}


        </div>
    );
};
