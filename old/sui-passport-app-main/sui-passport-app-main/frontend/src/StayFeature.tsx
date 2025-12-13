import React, { useState, useEffect, useRef } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation, Award, Wallet, CheckCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const PACKAGE_ID = '0x3bca8a973194ce69f0c3ddc36932a95776da95ec0c3d0356f37ce70eab0fb7c5';
const MODULE_NAME = 'stay_feature';
const FUNCTION_NAME = 'stay';
const GPS_TIMEOUT_MS = 10000;

// Sound effects
const playSuccessSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); // Free generic success sound
  audio.volume = 0.5;
  audio.play().catch(e => console.log('Audio play failed', e));
};

// Component to center map on position update
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

export const StayFeature: React.FC = () => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [status, setStatus] = useState<'idle' | 'locating' | 'signing' | 'submitting' | 'success'>('idle');
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Initial dummy location (Tokyo Station) for map before GPS
  const defaultLocation = { lat: 35.6812, lng: 139.7671 };

  useEffect(() => {
    if (account) {
      // Simulate fetching existing badge count
      setTokenCount(12);
    }
  }, [account]);

  const getPosition = (): Promise<GeolocationPosition> => {
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
  };

  const handleCheckIn = async () => {
    if (!account) {
      toast.error('Please connect your wallet first!');
      return;
    }

    try {
      setStatus('locating');

      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });

      // Artificial delay for UX (to show the "Locating" state)
      await new Promise(resolve => setTimeout(resolve, 800));

      setStatus('signing');
      const tx = new Transaction();
      const latInt = Math.floor(latitude * 1000000);
      const lngInt = Math.floor(longitude * 1000000);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [tx.pure.u64(latInt), tx.pure.u64(lngInt)],
      });

      setStatus('submitting');

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('Success:', result);
            setStatus('success');
            setTokenCount((prev) => prev + 1);
            setShowConfetti(true);
            playSuccessSound();
            toast.success('Check-in Successful! Badge Earned!', {
              duration: 5000,
              icon: '🏅',
            });
            setTimeout(() => setShowConfetti(false), 5000);
            setTimeout(() => setStatus('idle'), 3000); // Reset after a while
          },
          onError: (error) => {
            console.error(error);
            throw error;
          },
        },
      );
    } catch (error: any) {
      console.error(error);
      setStatus('idle');
      toast.error(error.message || 'Something went wrong');
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {showConfetti && <Confetti numberOfPieces={200} recycle={false} />}

      {/* Stats Card */}
      <div className="p-4 z-10">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between"
        >
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">Passport Status</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{tokenCount}</span>
              <span className="text-sm opacity-80">Badges</span>
            </div>
          </div>
          <div className="bg-white/20 p-3 rounded-full">
            <Award className="w-8 h-8 text-yellow-300" />
          </div>
        </motion.div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-200 min-h-[300px]">
        <MapContainer
          center={[defaultLocation.lat, defaultLocation.lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {location && (
            <>
              <RecenterMap lat={location.lat} lng={location.lng} />
              <Marker position={[location.lat, location.lng]} />
              <Circle
                center={[location.lat, location.lng]}
                radius={50}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }}
              />
            </>
          )}
        </MapContainer>

        {/* Overlay Gradient */}
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-slate-50 to-transparent z-[400] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white via-white/80 to-transparent z-[400] pointer-events-none"></div>
      </div>

      {/* Action Area */}
      <div className="p-6 bg-white z-10 pb-8">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.button
              key="idle"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCheckIn}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-blue-200 shadow-xl flex items-center justify-center gap-3 transition-all"
            >
              <MapPin className="w-6 h-6" />
              Check In Here
            </motion.button>
          )}

          {status !== 'idle' && status !== 'success' && (
            <motion.div
              key="loading"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full bg-slate-100 rounded-2xl p-4 border border-slate-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="font-semibold text-slate-700">
                  {status === 'locating' && 'Acquiring GPS...'}
                  {status === 'signing' && 'Waiting for Wallet...'}
                  {status === 'submitting' && 'Recording on Chain...'}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: '0%' }}
                  animate={{
                    width: status === 'locating' ? '30%' :
                      status === 'signing' ? '60%' : '90%'
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full py-4 bg-green-50 text-green-700 rounded-2xl font-bold text-lg border border-green-200 flex items-center justify-center gap-3"
            >
              <CheckCircle className="w-6 h-6" />
              Checked In!
            </motion.div>
          )}
        </AnimatePresence>

        {!account && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Connect your wallet to start collecting badges.
          </p>
        )}
      </div>
    </div>
  );
};
