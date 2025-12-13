import { useEffect, useRef, useState } from 'react';

// Haversine公式または球面三角法の法則を使用した距離計算関数
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // 地球の半径 (メートル)
  const toRad = (x: number) => (x * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
  return R * c; // 距離 (メートル)
}

export function useDistanceTimer(start: boolean) {
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  
  // === 修正点: 累積距離計算のために、最後に計測した位置を保存する Ref を導入 ===
  const lastPos = useRef<{ lat: number; lon: number } | null>(null);
  
  // GPS監視ID
  const watchId = useRef<number | null>(null);

  // --- 1. 時間のカウントアップロジック (独立したタイマー) ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    if (start) {
      // 計測開始時にリセット
      setElapsed(0); 
      // 1秒ごとに elapsed をインクリメント
      intervalId = setInterval(() => {
        setElapsed((prevElapsed) => prevElapsed + 1);
      }, 1000);
    } else {
      // 計測停止時
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      setElapsed(0);
    }

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [start]); // start の変化でのみ実行

  // --- 2. 距離の累積計測ロジック ---
  useEffect(() => {
    if (start) {
      // 計測開始時にリセット
      setDistance(0);
      lastPos.current = null; // 開始地点をリセット

      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const currentPos = { lat: latitude, lon: longitude };

          if (lastPos.current) {
            // === 修正点: 前回位置 (lastPos) から現在の位置までの距離を計算 ===
            const traveledDistance = getDistance(
              lastPos.current.lat,
              lastPos.current.lon,
              currentPos.lat,
              currentPos.lon
            );
            
            // === 修正点: 総合計距離に加算 (累積) ===
            setDistance((prevDistance) => prevDistance + traveledDistance);
          }
          
          // 現在位置を、次回の「前回位置」として保存
          lastPos.current = currentPos;
        },
        (err) => {
          console.error("Geolocation watch error:", err);
          // エラー処理（必要に応じて計測を停止するなどの対応を追加）
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 0 // キャッシュを使わず常に新しい値を取得
        }
      );

    } else {
      // 計測停止時
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      // 状態をクリーンアップ
      lastPos.current = null;
      // distanceは0にリセットしない (App.tsxでリセットされることを想定)
    }

    return () => {
      // クリーンアップ
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [start]); // start の変化でのみ実行

  return { distance, elapsed };
}