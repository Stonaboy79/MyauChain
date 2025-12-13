import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { User, QrCode, ShieldCheck, Sparkles, Upload, Camera } from 'lucide-react';

export const ResidentCard: React.FC = () => {
    const [hasNFT, setHasNFT] = useState(false);
    const [residentImage, setResidentImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 3D Tilt Logic
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setResidentImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!hasNFT) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full"></div>
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
                        <ShieldCheck className="w-16 h-16 text-blue-400" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        Become a Resident
                    </h2>
                    <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
                        Mint your digital resident card to access exclusive DAO features.
                    </p>
                </div>

                <div className="w-full max-w-xs space-y-4">
                    {/* Image Upload Area */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-square rounded-2xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 group"
                    >
                        {residentImage ? (
                            <img src={residentImage} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <>
                                <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform">
                                    <Camera className="w-6 h-6 text-slate-400" />
                                </div>
                                <span className="text-xs text-slate-500 font-medium">Upload Photo</span>
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

                    <button
                        onClick={() => setHasNFT(true)}
                        disabled={!residentImage}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 ${residentImage
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-blue-900/50'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        <Sparkles className="w-5 h-5" />
                        Mint Resident Card
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 perspective-1000">
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
                                <span className="font-bold tracking-[0.2em] text-[10px] text-blue-200">MEOW DAO CITY</span>
                            </div>
                            <div className="px-2 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded text-[10px] font-mono border border-blue-400/30 text-blue-300">
                                RESIDENT
                            </div>
                        </div>

                        {/* Main Info */}
                        <div className="flex items-center gap-5 mt-2">
                            <div className="w-20 h-20 rounded-xl bg-slate-800 border-2 border-white/10 shadow-lg overflow-hidden relative group-hover:border-blue-400/50 transition-colors">
                                {residentImage ? (
                                    <img src={residentImage} alt="Resident" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-full h-full p-4 text-slate-600" />
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Name</p>
                                <h3 className="text-xl font-bold tracking-wide text-white drop-shadow-md">Taro Yamada</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-3 mb-1">Resident ID</p>
                                <p className="font-mono text-sm tracking-widest text-blue-200">8823 4910 2293</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-slate-500 mb-0.5">ISSUED DATE</p>
                                <p className="text-xs font-medium text-slate-300">2025/12/03</p>
                            </div>
                            <div className="p-1 bg-white rounded-lg">
                                <QrCode className="w-8 h-8 text-black" />
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="mt-12 text-center space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Status</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-xs font-medium text-green-400">Active Resident</span>
                </div>
            </div>
        </div>
    );
};
