import React, { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, CheckCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';

// =========================================================
// 1. 定数とユーティリティ
// =========================================================

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const PACKAGE_ID =
  '0x3e386c67c06c550c65775485cec6a38e031aad2ce8b2d8c2f1f3a1936938ce21';

const MODULE_NAME = 'stay_feature';
const FUNCTION_NAME = 'stay';
const GPS_TIMEOUT_MS = 10000;
const defaultLocation = { lat: 35.6812, lng: 139.7671 };

const playSuccessSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
  audio.volume = 0.5;
  audio.play().catch(e => console.log('Audio play failed', e));
};

const calculateBonusReward = (elapsed: number): number => {
  // 1 second = 0.1 Token
  return Math.floor(elapsed * 0.1 * 10) / 10;
};

// 型定義
type StayFeatureProps = {
  onCheckinSuccess?: () => void;
  onStopMeasurement: () => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  distance: number;
  elapsed: number;
  checkedIn: boolean;
};

// =========================================================
// ヘルパーコンポーネント (変更なし)
// =========================================================

const TokenDisplay: React.FC<{ tokenCount: number, status: string }> = ({ tokenCount, status }) => (
  <div className="token-box flex-1 min-w-0 !p-3">
    <div className="flex items-center gap-2">
      <div className="flex items-baseline">
        <span className="token-count">{tokenCount}</span>
        <span className="token-label">トークン</span>
      </div>
    </div>
    <div>
      {status === 'success' ? (
        <CheckCircle className="w-6 h-6 status-icon-success" />
      ) : (
        <MapPin className="w-6 h-6 status-icon-idle" />
      )}
    </div>
  </div>
);

const DistanceDisplay: React.FC<{ distance: number, elapsed: number, isMeasuring: boolean }> = ({ distance, elapsed, isMeasuring }) => (
  <div className="token-box flex-1 min-w-0 !p-3 flex-col items-start gap-1">
    <div className="text-sm font-semibold text-slate-600 mb-1">移動情報</div>

    <div className="km text-base font-bold text-blue-600">
      {(distance / 1000).toFixed(2)} km
    </div>

    {isMeasuring && (
      <div className="minute text-sm text-slate-500">
        {elapsed} 秒
      </div>
    )}

    {!isMeasuring && distance > 0 && (
      <div className="text-xs text-slate-400 mt-1"></div>
    )}
  </div>
);

const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

// =========================================================
// 3. メインコンポーネント
// =========================================================

export const StayFeature: React.FC<StayFeatureProps> = ({
  onCheckinSuccess,
  onStopMeasurement,
  tokenCount,
  setTokenCount,
  distance,
  elapsed,
  checkedIn,
}) => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // status を 'locating' から 'idle' に変更し、初回マウント時に位置情報取得を試みる
  const [status, setStatus] = useState<'idle' | 'locating' | 'signing' | 'submitting' | 'success'>('idle');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stayId, setStayId] = useState<number | null>(null);

  useEffect(() => {
    if (account && tokenCount === 0) {
      setTokenCount(0);
    }
  }, [account, tokenCount, setTokenCount]);

  // GPS位置情報取得ロジック (useCallback でラップ)
  const getPosition = useCallback((): Promise<GeolocationPosition> => {
    // === 修正点: 'new new Promise' の重複した 'new' を削除 ===
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(new Error(`GPS Error: ${err.message}`)),
        { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
      );
    });
  }, []);

  // === 修正点: 初期位置情報取得ロジックの追加 ===
  useEffect(() => {
    const fetchInitialLocation = async () => {
      try {
        const position = await getPosition();
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        // 取得成功後も status は 'idle' のまま維持
      } catch (e: any) {
        console.error('Initial location fetch failed:', e);
        toast.error('現在地情報の取得に失敗しました。');
        // 初期位置取得失敗時も status は 'idle' のまま
      }
    };

    // location が null で、かつまだチェックインしていない場合のみ実行
    if (!location && !checkedIn) {
      fetchInitialLocation();
    }
  }, [getPosition, location, checkedIn]);


  // チェックイン処理の修正
  const handleCheckIn = async () => {
    if (!account) {
      toast.error('Please connect your wallet first!');
      return;
    }

    let checkinLocation = location;

    // location がまだ取得できていない場合、または計測中でない場合は再度取得を試みる
    if (!checkinLocation || status !== 'success') {
      try {
        setStatus('locating');
        const position = await getPosition();
        checkinLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(checkinLocation); // 再取得した位置情報を更新
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (e: any) {
        console.error(e);
        setStatus('idle');
        toast.error(e.message || '位置情報の取得に失敗しました');
        return;
      }
    }

    // ここで status は 'locating' (成功) または 'idle' (初期状態)
    if (!checkinLocation) {
      toast.error('位置情報が取得できませんでした。');
      setStatus('idle');
      return;
    }

    try {
      setStatus('signing');
      const tx = new Transaction();
      const latInt = Math.floor(checkinLocation.lat * 1000000);
      const lngInt = Math.floor(checkinLocation.lng * 1000000);
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`, arguments: [tx.pure.u64(latInt), tx.pure.u64(lngInt)] });
      setStatus('submitting');

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async () => {
            // Backend API Checkin
            if (account) {
              try {
                const res = await fetch('http://localhost:3001/api/checkin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userAddress: account.address,
                    lat: checkinLocation.lat,
                    lng: checkinLocation.lng
                  })
                });
                const data = await res.json();
                if (data.success && data.stayId) {
                  setStayId(data.stayId);
                }
              } catch (e) {
                console.error('API Checkin failed', e);
              }
            }

            setStatus('success');

            // チェックイン成功報酬 (1トークン) の加算
            setTokenCount((prev) => prev + 1);

            setShowConfetti(true);
            playSuccessSound();
            toast.success('チェックインに成功しました！計測を開始します。（+1 トークン）');
            onCheckinSuccess?.();
          },
          onError: () => {
            console.error();
            setStatus('idle');
            toast.error('チェックインに失敗しました');
          },
        }
      );
    } catch (e: any) {
      console.error(e);
      setStatus('idle');
      toast.error('トランザクションの送信に失敗しました');
    }
  };

  // 計測終了ハンドラ
  const handleStopMeasurement = async () => {
    // 1. Get current position for Checkout
    let checkoutLat = location?.lat;
    let checkoutLng = location?.lng;

    try {
      const pos = await getPosition();
      checkoutLat = pos.coords.latitude;
      checkoutLng = pos.coords.longitude;
    } catch (e) {
      console.warn("Checkout GPS update failed, using last known", e);
    }

    let bonusReward = calculateBonusReward(elapsed); // Client-side fallback default

    if (stayId && account) {
      if (checkoutLat === undefined || checkoutLng === undefined) {
        toast.error("位置情報が取得できないため、正確なチェックアウトができません。");
        // We continue but might fail on server or just send what we have? 
        // If we don't return here, we send undefined which fails server check.
      }

      try {
        const res = await fetch('http://localhost:3001/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stayId: stayId,
            userAddress: account.address,
            lat: checkoutLat,
            lng: checkoutLng
          })
        });
        const data = await res.json();

        if (data.success) {
          bonusReward = data.tokensEarned;
          toast.success(`ボーナスとして ${bonusReward} トークンを獲得しました！`);
        } else {
          // Failed (e.g. moved too far)
          bonusReward = 0;
          toast.error(data.message || "チェックアウトエラー: 条件を満たしていません");
        }
      } catch (e) {
        console.error('API Checkout failed', e);
        toast.error("サーバーとの通信に失敗しました。");
        // We do NOT want to give free tokens on network error if we are strict.
        // But for now let's leave bonusReward as calculated by client? 
        // No, if check-in was server-side, verify should be too.
        // But original code fell back to client calc. I'll stick to new strict logic:
        bonusReward = 0;
      }
    } else {
      // Not logged in or no StayId -> Client side simulation
      toast.success(`(デモ) ボーナスとして ${bonusReward} トークンを獲得しました！`);
    }

    setTokenCount((prev) => prev + bonusReward);

    // 親コンポーネントで checkedIn=false となり、distance/elapsed がリセットされる
    onStopMeasurement();

    setStatus('idle'); // status を idle に戻す
    setShowConfetti(false);
    setStayId(null);
  };

  const shouldDisplayDistance = checkedIn || distance > 0;

  // 地図の表示位置
  const mapCenter = location ?? defaultLocation;

  // status === 'locating' のときも、ボタンを無効化するために、loading ステートを定義
  const isLoading = status !== "idle" && status !== "success";

  return (
    <div className="flex flex-col h-full p-4 relative">

      {/* 4. トークン表示と移動情報表示を並列配置 */}
      <div className="mb-4 flex gap-3">
        {/* トークン表示 */}
        <TokenDisplay
          tokenCount={tokenCount}
          status={status}
        />

        {/* 移動情報表示 */}
        {shouldDisplayDistance && (
          <DistanceDisplay
            distance={distance}
            elapsed={elapsed}
            isMeasuring={checkedIn}
          />
        )}
      </div>

      {/* 5. 地図表示 */}
      <div className="leaflet-container">
        <MapContainer
          // 初回取得した位置情報かデフォルト位置を中央に
          center={mapCenter}
          zoom={18}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* location があればマップを再センタリング */}
          {location && <RecenterMap lat={location.lat} lng={location.lng} />}

          {/* === 修正点: マーカーと円はチェックイン後 (status === 'success') のみ表示 === */}
          {location && status === 'success' && (
            <>
              <Marker position={[location.lat, location.lng]} />
              <Circle
                center={[location.lat, location.lng]}
                radius={30}
                pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.2 }}
              />
            </>
          )}
        </MapContainer>
        {/* 初回位置取得中のローディングオーバーレイ */}
        {!location && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-[500]">
            <span className="flex items-center text-slate-600 font-semibold gap-2">
              <Loader2 className="animate-spin w-6 h-6" />
              現在地を検索中...
            </span>
          </div>
        )}
      </div>

      {/* 6. チェックインボタン */}
      <div className="p-4 pt-0">
        <button
          className={clsx(
            "checkin-btn",
            {
              'bg-blue-600 hover:bg-blue-700': status === 'success',
              'bg-green-500 hover:bg-green-600': status === 'idle',
              'opacity-60 cursor-not-allowed': isLoading, // loading中も無効化
            }
          )}
          onClick={status === 'success' ? handleStopMeasurement : handleCheckIn}
          disabled={isLoading}
        >
          {status === "idle" && "チェックイン"}
          {status === "locating" && (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-5 h-5" />
              位置情報最終確認中...
            </span>
          )}
          {(status === "signing" || status === "submitting") && (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-5 h-5" />
              {status === "signing" && "署名中..."}
              {status === "submitting" && "送信中..."}
            </span>
          )}
          {status === "success" && (
            <span className="flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5" /> 計測終了
            </span>
          )}
        </button>
      </div>

      {/* 7. コンフェッティ (変更なし) */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={300}
          onConfettiComplete={() => setShowConfetti(false)}
        />
      )}
    </div>
  );
};