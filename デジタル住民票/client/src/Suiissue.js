import React, { useState, useEffect } from "react";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

// Sui Constants
const MYAU_PACKAGE_ID = "0x50299eab88df654c17d0389ade63889eb201666bfdd5d07326a39c299bbf74bf";
const TREASURY_CAP_ID = "0x72c685060d17a5cfe77fd1509f2ece68e7dedd020711ee40588244d9f8491b6c";
const MYAU_MODULE_NAME = "MeowToken";   // モジュール名そのまま
const MYAU_COIN_TYPE = `${MYAU_PACKAGE_ID}::${MYAU_MODULE_NAME}::MEOWTOKEN`;

function Suiissue() {
    // Sui hooks
    const suiClient = useSuiClient();
    const currentSuiAccount = useCurrentAccount();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    const [myauBalance, setMyauBalance] = useState("0");

    const [recipientAddress, setRecipientAddress] = useState("");

    useEffect(() => {
        if (currentSuiAccount) {
            fetchMyauBalance(currentSuiAccount.address);
            setRecipientAddress(currentSuiAccount.address);
        } else {
            setMyauBalance("0");
            setRecipientAddress("");
        }
    }, [currentSuiAccount]);

    const fetchMyauBalance = async (address) => {
        try {
            const balance = await suiClient.getBalance({
                owner: address,
                coinType: MYAU_COIN_TYPE,
            });
            setMyauBalance(balance.totalBalance);
        } catch (e) {
            console.error("Failed to fetch Myau balance:", e);
        }
    };

    const mintMyau = async () => {
        if (!currentSuiAccount) return alert("Connect Sui Wallet first");
        if (!recipientAddress) return alert("Please enter a recipient address");

        const tx = new Transaction();
        tx.moveCall({
            target: `${MYAU_PACKAGE_ID}::${MYAU_MODULE_NAME}::mint`,
            arguments: [
                tx.object(TREASURY_CAP_ID),
                tx.pure.u64(100),       // Mint amount
                tx.pure.address(recipientAddress) // Receiver address
            ]
        });

        signAndExecuteTransaction(
            {
                transaction: tx,
            },
            {
                onSuccess: (result) => {
                    alert("Myau Minted to " + recipientAddress);
                    console.log("Mint result:", result);
                    fetchMyauBalance(currentSuiAccount.address);
                },
                onError: (error) => {
                    alert("Mint failed: " + error.message);
                    console.error("Mint failed:", error);
                }
            }
        );
    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
            <h1>Sui Token Issuer</h1>

            <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px", marginTop: "20px" }}>
                <h2>Myau Token (Sui)</h2>

                <div style={{ marginBottom: "20px" }}>
                    <ConnectButton />
                </div>

                {currentSuiAccount ? (
                    <div>
                        <p><strong>Connected:</strong> {currentSuiAccount.address}</p>
                        <p><strong>Myau Balance:</strong> {myauBalance}</p>

                        <div style={{ marginTop: "20px", marginBottom: "10px" }}>
                            <label style={{ display: "block", marginBottom: "5px" }}>Recipient Address:</label>
                            <input
                                type="text"
                                value={recipientAddress}
                                onChange={(e) => setRecipientAddress(e.target.value)}
                                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                                placeholder="0x..."
                            />
                        </div>

                        <button onClick={mintMyau} style={{ padding: "10px 20px", cursor: "pointer", marginTop: "10px", background: "#09d3ac", color: "white", border: "none", borderRadius: "5px" }}>
                            Issue Myau Token
                        </button>
                    </div>
                ) : ( // End of changes
                    <p>Wallet not connected</p>
                )}
            </div>
        </div>
    );
}

export default Suiissue;
