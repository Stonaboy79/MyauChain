import React, { useState, useEffect, useRef } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { User, ShieldCheck, Sparkles, Camera, Trash2, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

// Deployed Package ID
// Deployed Package ID (Same as stay_feature/token_management)
const RESIDENT_CARD_PACKAGE_ID = "0x4ca93f862d7429b6bd8447882e08afd703dbbbe94480e839ebc31f8aa37dfc26";
const RESIDENT_CARD_MODULE_NAME = "card";
const RESIDENT_CARD_TYPE = `${RESIDENT_CARD_PACKAGE_ID}::${RESIDENT_CARD_MODULE_NAME}::ResidentCard`;

// Correct JWT from 'デジタル住民票/Pinata' (contains 'scopedKeyKey' which matches signature)
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1ODE0YTViYi1lYjA0LTQ2ZTMtYjQ4ZC1jZWQ5ZjM3MmM2YTkiLCJlbWFpbCI6InlvZG9nYXdhY2hhcmdlQGhvdG1haWwuY28uanAiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiM2RkNWYyZjQzZDg3N2NiNGNmZDYiLCJzY29wZWRLZXlTZWNyZXQiOiI0NjQzOGFlYjBjNTM3NDdkMjhkYjUyOTM1MTQ5ZGI1NDA2MWJhOWRmYmJiYmEzNzgwMjRkMGFkYzdhMWZmY2E2IiwiZXhwIjoxNzk2MDU5OTIzfQ.PIZimQpd_prVf7IE_l4ca3L3PuFvUkbzzvxHujSFUY8";

type ViewMode = 'list' | 'issue';

export const ResidentCard: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Sui Hooks
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

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
        if (account) {
            // NOTE: Address auto-fill removed
            loadBlockchainData();
        } else {
            setMyNFTs([]);
        }
    }, [account, suiClient]);

    const loadBlockchainData = async () => {
        if (!account) return;
        setIsLoading(true);

        try {
            const result = await suiClient.getOwnedObjects({
                owner: account.address,
                filter: { StructType: RESIDENT_CARD_TYPE },
                options: { showContent: true, showDisplay: true },
            });

            const nftList = [];
            const hiddenNFTs = JSON.parse(localStorage.getItem("hiddenNFTs") || "[]");

            for (const obj of result.data) {
                const id = obj.data?.objectId;
                if (!id) continue;
                if (hiddenNFTs.includes(id)) continue;

                if (obj.data?.content?.dataType === "moveObject") {
                    const fields = (obj.data.content.fields as any);
                    nftList.push({
                        tokenId: id,
                        name: fields.name,
                        image: fields.image_url,
                        address: fields.user_address,
                        transactionHash: obj.data.digest // Use digest as proxy for tx hash ref
                    });
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
        if (!account) return toast.error("ウォレットを接続してください");
        if (!name || !userAddress || !file) {
            toast.error("未入力の項目があります（写真、名前、住所）");
            return;
        }

        setIsIssuing(true);
        const loadingToast = toast.loading("発行処理中...");

        try {
            console.log("Starting issuance process using updated JWT...");

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

            if (!imageUpload.ok) {
                const errorText = await imageUpload.text();
                // If 401 again, it means even this JWT is invalid, but it's the best guess we have from the codebase
                console.error("Pinata Upload Error Response:", imageUpload.status, errorText);
                throw new Error(`画像アップロード失敗 (Status: ${imageUpload.status})`);
            }

            const imageJson = await imageUpload.json();
            if (!imageJson.IpfsHash) throw new Error("画像アップロード失敗: Hashが返されませんでした");
            const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageJson.IpfsHash}`;
            console.log("Image uploaded to IPFS:", imageUrl);

            // 2. Mint NFT (Sui Transaction)
            const tx = new Transaction();
            console.log("Building Transaction...");
            tx.moveCall({
                target: `${RESIDENT_CARD_PACKAGE_ID}::${RESIDENT_CARD_MODULE_NAME}::mint`,
                arguments: [
                    tx.pure.string(name),
                    tx.pure.string("デジタル住民票NFT"),
                    tx.pure.string(imageUrl),
                    tx.pure.string(userAddress),
                ],
            });

            console.log("Executing Transaction...");
            await signAndExecuteTransaction(
                { transaction: tx },
                {
                    onSuccess: (result) => {
                        console.log("Mint result:", result);
                        toast.dismiss(loadingToast);
                        toast.success("住民票の発行が完了しました！");

                        setTimeout(() => {
                            loadBlockchainData();
                            setViewMode('list');
                            // clear form
                            setName("");
                            setUserAddress(""); // Manually clear
                            setFile(null);
                            setPreviewImage(null);
                        }, 2000);
                    },
                    onError: (err) => {
                        console.error("Mint failed (callback):", err);
                        toast.dismiss(loadingToast);
                        // Make error more copyable/readable
                        toast.error(`発行失敗: ${err.message || "Unknown error"}`);
                    }
                }
            );

        } catch (err: any) {
            console.error("Issuance Error:", err);
            toast.dismiss(loadingToast);
            toast.error("エラーが発生しました: " + (err.message || err));
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
                    <h2 className="text-xl font-bold text-slate-800">住民票 新規発行 (Sui)</h2>
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
                    マイページ (Sui)
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
                        デジタル住民票を表示するには<br />ウォレット接続が必要です。
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
                    <div className="flex flex-col items-center gap-8">
                        {myNFTs.map((nft) => (
                            <HologramCard key={nft.tokenId} nft={nft} onDelete={handleDelete} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// 3D Hologram Card Component
// ==========================================
interface HologramCardProps {
    nft: any;
    onDelete: (id: string) => void;
}

const HologramCard: React.FC<HologramCardProps> = ({ nft, onDelete }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const rotateX = useSpring(useTransform(y, [-100, 100], [10, -10]), { stiffness: 150, damping: 20 });
    const rotateY = useSpring(useTransform(x, [-100, 100], [-10, 10]), { stiffness: 150, damping: 20 });

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set(event.clientX - centerX);
        y.set(event.clientY - centerY);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 perspective-1000 w-full">
            <motion.div
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative w-full max-w-[340px] aspect-[1.58/1] rounded-2xl shadow-2xl cursor-pointer group"
            >
                {/* Card Background */}
                <div className="absolute inset-0 bg-black/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
                    {/* Neon Gradients */}
                    <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-blue-600/30 rounded-full blur-[80px]" />
                    <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[100%] bg-purple-600/30 rounded-full blur-[80px]" />

                    {/* Holographic Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" />

                    {/* Card Content */}
                    <div className="relative h-full p-6 flex flex-col justify-between text-white z-10">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
                                    <Sparkles className="w-4 h-4 text-blue-300" />
                                </div>
                                <span className="font-bold tracking-[0.2em] text-[10px] text-blue-200">SUI PASSPORT</span>
                            </div>
                            <div className="px-2 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded text-[10px] font-mono border border-blue-400/30 text-blue-300">
                                RESIDENT
                            </div>
                        </div>

                        {/* Main Info */}
                        <div className="flex items-center gap-5 mt-2">
                            <div className="w-20 h-20 rounded-xl bg-slate-800 border-2 border-white/10 shadow-lg overflow-hidden relative group-hover:border-blue-400/50 transition-colors shrink-0">
                                {nft.image ? (
                                    <img src={nft.image} alt="Resident" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-full h-full p-4 text-slate-600" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Name</p>
                                <h3 className="text-xl font-bold tracking-wide text-white drop-shadow-md truncate">{nft.name}</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-3 mb-1">Address</p>
                                <p className="font-mono text-xs tracking-wide text-blue-200 truncate max-w-[150px]">{nft.address}</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-slate-500 mb-0.5">ISSUED DATE</p>
                                <p className="text-xs font-medium text-slate-300">
                                    {new Date().toLocaleDateString('ja-JP')}
                                </p>
                            </div>
                            <div className="p-1 bg-white rounded-lg">
                                <QrCode className="w-8 h-8 text-black" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delete Button (Absolute, outside overflow hidden if needed, or inside with higher z) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(nft.tokenId);
                    }}
                    className="absolute top-2 right-2 p-2 text-white/20 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors z-30"
                    title="削除（非表示）"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </motion.div>

            <div className="mt-4 text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-xs font-medium text-green-400">Active Resident</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{nft.tokenId.slice(0, 10)}...{nft.tokenId.slice(-10)}</p>
            </div>
        </div>
    );
};
