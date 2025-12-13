// -------------------------------
// MEOW トークン送金（ハードコード版テンプレート）
// -------------------------------
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "@mysten/sui.js/utils";

// ★★★ ここにあなたの MEOW トークン type を設定 ★★★
const MEOW_COIN_TYPE = "0xMEOWPACKAGEID::meow::MEOW";

// ★★★ ダミー秘密鍵（例） ★★★
// Base64 の private key（ニーモニックではなく “秘密鍵の base64 版” を使用します）
const DUMMY_PRIVATE_KEY_B64 = "BASE64_PRIVATE_KEY_HERE";

// ★★★ ダミー送金元アドレス ★★★
const DUMMY_SENDER_ADDRESS = "0xSENDER_ADDRESS_HERE";


// Base64秘密鍵 → Keypair
function loadSenderKeypair() {
    const raw = fromB64(DUMMY_PRIVATE_KEY_B64);
    const keypair = Ed25519Keypair.fromSecretKey(raw.slice(1)); // 先頭1バイトはスキップ
    return keypair;
}


// MEOW トークン送金
export async function sendMeowToken(toAddress, amount) {
    try {
        const client = new SuiClient({ url: getFullnodeUrl("devnet") });
        const senderKeypair = loadSenderKeypair();

        // 送金元アドレス
        const sender = DUMMY_SENDER_ADDRESS;

        // ① MEOW コインオブジェクトを検索
        const coins = await client.getCoins({
            owner: sender,
            coinType: MEOW_COIN_TYPE,
        });

        if (!coins.data.length) {
            alert("送金元ウォレットが MEOW を保有していません");
            return;
        }

        // 最初のコインを利用
        const coinObjectId = coins.data[0].coinObjectId;

        // ② トランザクション作成
        const tx = {
            kind: "moveCall",
            data: {
                packageObjectId: "0x2",
                module: "coin",
                function: "transfer",
                typeArguments: [MEOW_COIN_TYPE],
                arguments: [coinObjectId, toAddress],
                gasBudget: 10000000,
            },
        };

        // ③ 署名 & 送信
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: senderKeypair,
        });

        console.log("MEOW 送金結果:", result);
        alert(`MEOW を ${amount} トークン送金しました！`);

        return true;
    } catch (err) {
        console.error("送金エラー:", err);
        alert("送金に失敗しました");
        return false;
    }
}
