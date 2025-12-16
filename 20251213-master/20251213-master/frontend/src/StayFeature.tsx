import React, { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, CheckCircle, Loader2, Wallet } from 'lucide-react';
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
  '0x4ca93f862d7429b6bd8447882e08afd703dbbbe94480e839ebc31f8aa37dfc26';

const MODULE_NAME = 'stay_feature';
const FUNCTION_NAME = 'stay';
const GPS_TIMEOUT_MS = 10000;
const defaultLocation = { lat: 35.6812, lng: 139.7671 };

const calculateBonusReward = (elapsed: number): number => {
  // 1 second = 1 Raw Unit (Display as 0.1)
  return Math.floor(elapsed * 1);
};

const playSuccessSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
  audio.volume = 0.5;
  audio.play().catch(e => console.log('Audio play failed', e));
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
  tokenObjectId?: string | 'MINT_REQUIRED' | null; // Optional now, we handle it internally
};

// =========================================================
// ヘルパーコンポーネント (変更なし)
// =========================================================

const TokenDisplay: React.FC<{ tokenCount: number, status: string }> = ({ tokenCount, status }) => (
  <div className="token-box flex-1 min-w-0 !p-3">
    <div className="flex items-center gap-2">
      <div className="flex items-baseline">
        <span className="token-count">{(tokenCount / 10).toFixed(1)}</span>
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
  // tokenObjectId prop is ignored/shadowed by internal state logic
}) => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  // status を 'locating' から 'idle' に変更し、初回マウント時に位置情報取得を試みる
  const [status, setStatus] = useState<'idle' | 'locating' | 'signing' | 'submitting' | 'success'>('idle');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stayId, setStayId] = useState<number | null>(null);

  // Internal management of tokenObjectId
  const [internalTokenObjectId, setInternalTokenObjectId] = useState<string | 'MINT_REQUIRED' | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchTokenObject = async () => {
      if (!account?.address) return;
      setIsFetchingToken(true);
      try {
        const { data } = await client.getOwnedObjects({
          owner: account.address,
          filter: {
            StructType: `${PACKAGE_ID}::token_management::TokenBalance`,
          },
          options: {
            showContent: true,
          }
        });

        if (data && data.length > 0) {
          const obj = data[0];
          const content = obj.data?.content;
          setInternalTokenObjectId(obj.data?.objectId ?? null);

          // If we can read the balance, let's update strict tokenCount too
          if (content && content.dataType === 'moveObject') {
            // @ts-ignore
            const balance = content.fields.balance;
            if (typeof balance !== 'undefined') {
              setTokenCount(Number(balance));
            }
          }

        } else {
          setInternalTokenObjectId('MINT_REQUIRED');
        }
      } catch (e) {
        console.error('Failed to fetch token object:', e);
        toast.error('ウォレット情報の取得に失敗しました');
      } finally {
        setIsFetchingToken(false);
      }
    };

    fetchTokenObject();
  }, [account, client, setTokenCount, refreshTrigger]);

  useEffect(() => {
    if (account && tokenCount === 0) {
      // Keep existing logic if needed, but fetchTokenObject above overrides it correctly
    }
  }, [account, tokenCount]);

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


  // 以前のオンチェーンチェックインロジックを復元
  const handleCheckIn = async () => {
    if (!account) {
      toast.error('Walletを接続してください');
      return;
    }

    let checkinLocation = location;
    // 位置情報未取得なら取得トライ
    if (!checkinLocation || status !== 'success') {
      try {
        setStatus('locating');
        const position = await getPosition();
        checkinLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(checkinLocation);
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (e: any) {
        setStatus('idle');
        toast.error(e.message || '位置情報の取得に失敗しました');
        return;
      }
    }

    if (!checkinLocation) {
      toast.error('位置情報が取得できませんでした');
      setStatus('idle');
      return;
    }

    try {
      setStatus('signing');
      const tx = new Transaction();
      // 緯度経度を整数化 (例: 35.1234 -> 35123400)
      const latInt = Math.floor(checkinLocation.lat * 1000000);
      const lngInt = Math.floor(checkinLocation.lng * 1000000);

      // オンチェーンの stay 関数を呼び出し
      // Note: PACKAGE_ID は定数定義されているものを使用
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [tx.pure.u64(latInt), tx.pure.u64(lngInt)]
      });

      setStatus('submitting');
      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('Checkin TX:', result);
            setStatus('success');
            setTokenCount((prev) => prev + 1);
            setShowConfetti(true);
            playSuccessSound();
            toast.success('チェックイン成功！(オンチェーン記録完了)');
            onCheckinSuccess?.();
          },
          onError: (err) => {
            console.error('Checkin TX failed:', err);
            setStatus('idle');
            toast.error('チェックインに失敗しました');
          }
        }
      );
    } catch (e: any) {
      console.error(e);
      setStatus('idle');
      toast.error('トランザクション作成に失敗');
    }
  };

  const handleMintTokenObject = async () => {
    if (!account) return;
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::token_management::mint_initial_balance`,
        arguments: []
      });

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('Mint Initial Balance TX:', result);
            toast.success('利用登録が完了しました！');
            // Trigger refetch
            setRefreshTrigger(prev => prev + 1);
          },
          onError: (err) => {
            console.error('Mint Initial Balance failed:', err);
            toast.error('ウォレット作成に失敗しました');
          }
        }
      );
    } catch (e: any) {
      console.error(e);
      toast.error('トランザクション作成に失敗');
    }
  };

  // 計測終了ハンドラ (オンチェーン版)
  const handleStopMeasurement = async () => {
    console.log("handleStopMeasurement called. Elapsed:", elapsed);

    if (!account) {
      toast.error('ウォレットが未接続です。');
      return;
    }

    if (!internalTokenObjectId || internalTokenObjectId === 'MINT_REQUIRED') {
      console.error("Token Object Missing:", internalTokenObjectId);
      toast.error('トークン残高オブジェクトIDが見つかりません。');
      return;
    }

    // calculateBonusReward は別途定義されていると仮定
    const bonusReward = calculateBonusReward(elapsed);
    console.log("Calculated Reward:", bonusReward);

    if (bonusReward === 0) {
      toast.error("報酬が0です。もう少し滞在してください。");
      // Proceeding anyway but user should know
    }

    try {
      setStatus('signing');

      const tx = new Transaction();

      // チェックアウト(計測終了) & トークン発行
      // Note: PACKAGE_ID は共通、モジュールは token_management を想定
      const TOKEN_MODULE_NAME = 'token_management';
      const TOKEN_FUNCTION_NAME = 'complete_stay_measurement';

      tx.moveCall({
        target: `${PACKAGE_ID}::${TOKEN_MODULE_NAME}::${TOKEN_FUNCTION_NAME}`,
        arguments: [
          tx.object(internalTokenObjectId),
          tx.pure.u64(bonusReward),
        ]
      });

      setStatus('submitting');
      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('Stop Measurement TX:', result);
            toast.success(`(オンチェーン) 計測終了！ +${(bonusReward / 10).toFixed(1)} トークン`);
            setTokenCount((prev) => prev + bonusReward);
            onStopMeasurement();
            setStatus('idle');
            setShowConfetti(false);
            setStayId(null);
          },
          onError: (err) => {
            console.error('Stop Measurement failed:', err);
            toast.error('計測終了に失敗しました');
            setStatus('success'); // Revert to success state so they can try again
          }
        }
      );

    } catch (e: any) {
      console.error('トークン記録トランザクション失敗:', e);
      toast.error('計測終了時のトークン記録に失敗しました。');
      setStatus('success');
    }
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
              'bg-green-500 hover:bg-green-600': status === 'idle' && internalTokenObjectId !== 'MINT_REQUIRED',
              'bg-purple-600 hover:bg-purple-700': internalTokenObjectId === 'MINT_REQUIRED' && !isFetchingToken,
              'opacity-60 cursor-not-allowed': isLoading || isFetchingToken, // loading中も無効化
            }
          )}
          onClick={
            status === 'success'
              ? handleStopMeasurement
              : internalTokenObjectId === 'MINT_REQUIRED'
                ? handleMintTokenObject
                : handleCheckIn
          }
          disabled={isLoading || isFetchingToken}
        >
          {isFetchingToken && (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-5 h-5" />
              ウォレット確認中...
            </span>
          )}

          {!isFetchingToken && internalTokenObjectId === 'MINT_REQUIRED' && (
            <span className="flex items-center justify-center gap-2">
              <Wallet className="w-5 h-5" />
              チェックイン
            </span>
          )}

          {!isFetchingToken && internalTokenObjectId !== 'MINT_REQUIRED' && status === "idle" && "チェックイン"}

          {!isFetchingToken && status === "locating" && (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-5 h-5" />
              位置情報最終確認中...
            </span>
          )}
          {!isFetchingToken && (status === "signing" || status === "submitting") && (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-5 h-5" />
              {status === "signing" && "署名中..."}
              {status === "submitting" && "送信中..."}
            </span>
          )}
          {!isFetchingToken && status === "success" && (
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