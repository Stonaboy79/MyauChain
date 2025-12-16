import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// シングルトン的に管理（簡易実装）
let debugKeypair: Ed25519Keypair | null = null;

export const setDebugPrivateKey = (privateKeyStr: string) => {
    try {
        let keypair: Ed25519Keypair;
        if (privateKeyStr.startsWith('suiprivkey')) {
            const { secretKey } = decodeSuiPrivateKey(privateKeyStr);
            keypair = Ed25519Keypair.fromSecretKey(secretKey);
        } else {
            // Hex format fallback (unsafe but common in dev)
            const buffer = Buffer.from(privateKeyStr, 'hex');
            keypair = Ed25519Keypair.fromSecretKey(buffer);
        }
        debugKeypair = keypair;
        return keypair.toSuiAddress();
    } catch (e) {
        console.error("Invalid Private Key", e);
        throw e;
    }
};

export const getDebugKeypair = () => debugKeypair;

export const clearDebugKeypair = () => {
    debugKeypair = null;
};
