import { useEffect, useRef, useState } from 'react';

// Haversine公式
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // 地球の半径 (メートル)
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function useDistanceTimer(start: boolean, initialPos: { lat: number, lng: number } | null) {
  const [distanceFromStart, setDistanceFromStart] = useState(0); // 開始地点からの距離
  const [elapsed, setElapsed] = useState(0);
  const [isWithinRange, setIsWithinRange] = useState(true); // 範囲内かどうか
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null); // 現在地を追加

  const watchId = useRef<number | null>(null);

  // --- 1. 時間のカウントアップ (範囲内のみ) ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (start && isWithinRange) {
      intervalId = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [start, isWithinRange]);

  // --- 2. 距離監視と範囲判定 ---
  useEffect(() => {
    if (start && initialPos) {
      // 初期化
      setDistanceFromStart(0);
      setIsWithinRange(true);
      setCurrentLocation(initialPos); // 初期位置を入れる

      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const currentLat = pos.coords.latitude;
          const currentLng = pos.coords.longitude;
          setCurrentLocation({ lat: currentLat, lng: currentLng }); // 現在地更新

          // 開始地点からの距離を計算
          const dist = getDistance(
            initialPos.lat,
            initialPos.lng,
            currentLat,
            currentLng
          );

          setDistanceFromStart(dist);

          // 50m制限判定
          if (dist <= 50) {
            setIsWithinRange(true);
          } else {
            setIsWithinRange(false);
          }
        },
        (err) => console.error("GPS Watch Error:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

    } else {
      // 停止時
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (!start) {
        setElapsed(0);
        setDistanceFromStart(0);
        setIsWithinRange(true);
        setCurrentLocation(null);
      }
    }

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [start, initialPos]); // initialPos が変わったら再監視

  return { distance: distanceFromStart, elapsed, isWithinRange, currentLocation };
}