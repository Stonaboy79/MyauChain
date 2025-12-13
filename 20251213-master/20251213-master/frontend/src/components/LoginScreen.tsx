import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { Wallet, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGoogleOAuthUrl, parseJwtFromUrl, getSuiAddressFromJwt } from '../utils/zkLogin';

interface LoginScreenProps {
    onLoginSuccess: (address: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const account = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();
    const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Effect to check for Wallet Connection
    useEffect(() => {
        if (account?.address) {
            onLoginSuccess(account.address);
        }
    }, [account, onLoginSuccess]);

    // Effect to check for Google OAuth Redirect
    useEffect(() => {
        const hash = window.location.hash;
        if (hash && hash.includes('id_token')) {
            setIsLoggingIn(true);
            const idToken = parseJwtFromUrl(hash);
            if (idToken) {
                try {
                    const address = getSuiAddressFromJwt(idToken);
                    setZkLoginAddress(address);
                    // Clear hash
                    window.history.replaceState(null, '', window.location.pathname);
                    onLoginSuccess(address);
                } catch (e) {
                    console.error('Error deriving address:', e);
                    setIsLoggingIn(false);
                }
            } else {
                setIsLoggingIn(false);
            }
        }
    }, [onLoginSuccess]);

    return (
        <div className="min-h-full flex flex-col items-center justify-center p-6 relative overflow-hidden z-50">

            <main className="w-full max-w-md z-10 space-y-8 flex flex-col items-center">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-2"
                >
                    <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                        Meow-Dapps
                    </h1>
                    <p className="text-slate-500 font-medium">デジタル住民票 & 位置証明</p>
                </motion.div>

                {/* Login Options */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-full space-y-4"
                >
                    {/* 1. Wallet Connect */}
                    <div className="w-full [&>button]:!w-full [&>button]:!justify-center [&>button]:!bg-slate-900 [&>button]:!text-white [&>button]:!rounded-xl [&>button]:!font-medium [&>button]:!px-6 [&>button]:!py-4 [&>button]:hover:!bg-slate-800 [&>button]:!transition-all [&>button]:!shadow-lg [&>button]:!h-auto">
                        <ConnectButton />
                    </div>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-300"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-medium">または</span>
                        <div className="flex-grow border-t border-slate-300"></div>
                    </div>

                    {/* 2. Google Login */}
                    <a
                        href={getGoogleOAuthUrl()}
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow-md group"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                        Login with Google
                    </a>
                </motion.div>

                {isLoggingIn && (
                    <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        認証中...
                    </div>
                )}
            </main>
        </div>
    );
};
