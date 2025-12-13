// ===========================
// main.js
// ===========================

import { SuiClient, getFullnodeUrl } from "https://esm.sh/@mysten/sui.js/client";
import { Ed25519Keypair } from "https://esm.sh/@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "https://esm.sh/@mysten/sui.js/utils";
import { TransactionBlock } from "https://esm.sh/@mysten/sui.js/transactions";

// ---------------------------
// Sui 設定
// ---------------------------
const WALLET = "0xc37e524ee82f74904a398fff04b1224ca717bd6160d1f96bd50d5c73c39be08c";
const MEOW_COIN_TYPE = "0xcf974fb6fe082b69a8224fc5d4d150cc2ba74ea22bf020494bb82082ed5d4526::MeowToken::MEOWTOKEN";

// ★ ハードコード秘密鍵（Base64）  
const DUMMY_PRIVATE_KEY_B64 = "ここにBase64秘密鍵を入れてください"; 
const DUMMY_SENDER_ADDRESS = WALLET; // 送金元アドレス

// ---------------------------
// DOM
// ---------------------------
const connectBtn = document.getElementById("connectButton");
const walletAddressText = document.getElementById("walletAddress");
const tokenBalanceText = document.getElementById("tokenBalance");
const nftButton = document.getElementById("nftButton");
const purchaseButton = document.getElementById("purchaseButton");
const getTokenButton = document.getElementById("getTokenButton");
const statusMessage = document.getElementById("statusMessage");
const distanceText = document.getElementById("totalDistance");
const timeText = document.getElementById("totalTime");

// ---------------------------
// Leaflet
// ---------------------------
let map = null;
let marker = null;
let routePolyline = null;
let routeCoordinates = [];
let watchId = null;
let previousPosition = null;

let isRecording = false;
let totalDistance = 0;
let startTime = null;
let timeInterval = null;

// ---------------------------
// Sui クライアント
// ---------------------------
const client = new SuiClient({ url: getFullnodeUrl("devnet") });

// ---------------------------
// Connect → トークン残高取得
// ---------------------------
connectBtn.addEventListener("click", async () => {
    walletAddressText.textContent = WALLET;
    tokenBalanceText.textContent = "取得中...";

    try {
        const result = await client.getBalance({
            owner: WALLET,
            coinType: MEOW_COIN_TYPE,
        });

        const balance = result.totalBalance;
        tokenBalanceText.textContent = balance;

        if (balance >= 1) purchaseButton.style.display = "block";
        nftButton.style.display = "block";
    } catch (err) {
        console.error(err);
        tokenBalanceText.textContent = "エラー：残高取得失敗";
    }
});

// ===========================
// 記録開始 / 停止
// ===========================
getTokenButton.addEventListener("click", async () => {

    // --------------------------
    // 記録停止
    // --------------------------
// ============================
// 記録停止時のトークン送金
// ============================
// ============================
// 記録停止時のトークン送金
// ============================
if (isRecording) {
  const wantsTransfer = confirm("獲得したトークンを送金しますか？");

  if (wantsTransfer) {
      const earnedTokens = Math.floor(totalDistance / 100); // 100m = 1 MEOW
      let userAddress = window.suiWalletAddress;

      // Sui Wallet / Slush 未接続なら接続を試みる
      if (!userAddress) {
          let walletConnected = false;

          if (window.sui) {
              try {
                  const accounts = await window.sui.connect();
                  if (accounts && accounts.length > 0) {
                      userAddress = accounts[0].address;
                      window.suiWalletAddress = userAddress;
                      walletConnected = true;
                      alert(`Sui Wallet と接続しました: ${userAddress}`);
                  }
              } catch (e) {
                  console.error("Sui Wallet 接続エラー:", e);
              }
          } 
          else if (window.slush) {
              try {
                  const accounts = await window.slush.connect();
                  if (accounts && accounts.length > 0) {
                      userAddress = accounts[0].address;
                      window.suiWalletAddress = userAddress;
                      walletConnected = true;
                      alert(`Slush Wallet と接続しました: ${userAddress}`);
                  }
              } catch (e) {
                  console.error("Slush 接続エラー:", e);
              }
          }

          if (!walletConnected) {
              alert("Sui Wallet または Slush Wallet がブラウザに見つかりません。拡張機能をインストールしてください。");
              return;
          }
      }

      // トークン送金
      statusMessage.textContent = "トークン送金処理中…";
      try {
          await sendMeowToken(userAddress, earnedTokens);
          alert(`${earnedTokens} MEOW を送金しました！`);
      } catch (e) {
          console.error("送金エラー:", e);
          alert("送金に失敗しました");
      }
  }

  // 記録停止処理
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  clearInterval(timeInterval);
  timeInterval = null;
  isRecording = false;
  getTokenButton.textContent = "旅の軌跡を記録する";
  statusMessage.textContent = "記録停止";
  return;
}

    // --------------------------
    // 記録開始
    // --------------------------
    isRecording = true;
    getTokenButton.textContent = "計測終了";
    statusMessage.textContent = "移動記録を開始…";

    if (!map) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            map = L.map("map").setView([lat, lon], 18);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
            }).addTo(map);

            marker = L.marker([lat, lon]).addTo(map);
            routePolyline = L.polyline(routeCoordinates, { color: "blue" }).addTo(map);
        });
    }

    if (!startTime) startTime = new Date();
    if (!timeInterval) {
        timeInterval = setInterval(() => {
            const now = new Date();
            const sec = Math.floor((now - startTime) / 1000);
            const min = Math.floor(sec / 60);
            timeText.textContent = min > 0 ? `${min} 分 ${sec % 60} 秒` : `${sec} 秒`;
        }, 1000);
    }

    if (!navigator.geolocation) {
        alert("位置情報が利用できません");
        return;
    }

    const success = (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        if (!map) {
            map = L.map("map").setView([lat, lon], 18);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
            }).addTo(map);

            marker = L.marker([lat, lon]).addTo(map);
            routePolyline = L.polyline(routeCoordinates, { color: "blue" }).addTo(map);
        }

        if (previousPosition) {
            const dist = calculateDistance(previousPosition.lat, previousPosition.lon, lat, lon);
            if (dist > 1) {
                totalDistance += dist;
                distanceText.textContent = Math.floor(totalDistance);
            }
        }

        previousPosition = { lat, lon };

        L.circleMarker([lat, lon], { radius: 5, color: "blue" }).addTo(map);
        routeCoordinates.push([lat, lon]);
        routePolyline.setLatLngs(routeCoordinates);
        marker.setLatLng([lat, lon]);
    };

    const error = (err) => {
        console.error(err);
        alert("GPSエラー：位置情報が取得できません");
        statusMessage.textContent = "GPSエラー（再開可）";
        isRecording = false;
        getTokenButton.textContent = "旅の軌跡を記録する";
        if (watchId) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        clearInterval(timeInterval);
        timeInterval = null;
    };

    watchId = navigator.geolocation.watchPosition(success, error, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
    });
});

// ============================
// NFT / 商品ページ
// ============================
nftButton.addEventListener("click", () => {
    window.location.href = "https://opensea.io/SUNTORY_nft/created";
});
purchaseButton.addEventListener("click", () => {
    window.location.href = "index2.html";
});

// ============================
// 距離計算 (Haversine)
// ============================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ============================
// MEOW トークン送金（RawSigner + TransactionBlock）
async function sendMeowToken(toAddress, amount) {
    const provider = new SuiClient({ url: getFullnodeUrl("devnet") });
    const raw = fromB64(DUMMY_PRIVATE_KEY_B64);
    const keypair = Ed25519Keypair.fromSecretKey(raw.slice(1));
    const signer = new RawSigner(keypair, provider);

    try {
        // coin オブジェクトを取得
        const coins = await provider.getCoins({ owner: DUMMY_SENDER_ADDRESS, coinType: MEOW_COIN_TYPE });
        if (!coins.data.length) {
            alert("送金元が MEOW を保有していません");
            return;
        }

        const coinObjectId = coins.data[0].coinObjectId;

        const tx = new TransactionBlock();
        tx.transferObjects([tx.object(coinObjectId)], tx.pure(toAddress));

        const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx });
        console.log("送金結果:", result);
    } catch (err) {
        console.error("送金エラー:", err);
        throw err;
    }
}
