import React, { useState } from 'react';
import { ConnectButton, useDisconnectWallet } from '@mysten/dapp-kit';
import { StayFeature } from './StayFeature';
import { ResidentCard } from './components/ResidentCard';
import { DAOFeature } from './components/DAOFeature'; // Restored Import
import { LoginScreen } from './components/LoginScreen'; // New Import
import { Toaster } from 'react-hot-toast';
import { MapPin, UserSquare2, LogOut, Users } from 'lucide-react'; // Add Users icon
import { useDistanceTimer } from './useDistanceTimer';

// import { DistanceTimerDisplay } from './DistanceTimerDisplay'; // ← 削除
import clsx from 'clsx';

// =========================================================
// 1. TokenInfoBoxを削除
//    -> このコンポーネントは未使用のため、定義を削除します。
// =========================================================

const App: React.FC = () => {
  // ... (Auth State)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);

  const { mutate: disconnect } = useDisconnectWallet();

  // ... (Login/Logout Handlers)
  const handleLoginSuccess = (address: string) => {
    setUserAddress(address);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    disconnect();
    setIsAuthenticated(false);
    setUserAddress(null);
    setActiveTab('checkin');
  };

  // --- Original App State ---
  // Add 'dao' to the type
  const [activeTab, setActiveTab] = useState<'checkin' | 'card' | 'dao'>('checkin');
  const [checkedIn, setCheckedIn] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [tokenObjectId, setTokenObjectId] = useState<string | 'MINT_REQUIRED' | null>(null); // Added State

  const { distance, elapsed } = useDistanceTimer(checkedIn);

  // ... (handleStopMeasurement)
  // DAO State (Lifted up for persistence)
  const [residentPassId, setResidentPassId] = useState('');

  // ... (handleStopMeasurement)
  const handleStopMeasurement = () => {
    setCheckedIn(false);
  };

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen w-full bg-mesh flex items-center justify-center font-sans text-slate-800">
      <div className="w-full max-w-[390px] h-[85vh] max-h-[850px] glass-panel rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border border-white/50">

        {/* 1. Header */}
        <header className="bg-white/40 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/50 z-30">
          <h2 className="text-slate-800 font-bold text-lg tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            Meow-Dapps
          </h2>
          <div className="flex items-center gap-2">
            <div className="scale-90 origin-right">
              <ConnectButton />
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-white/50 text-slate-500 hover:text-red-500 transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 2. Navigation Tabs */}
        <div className="w-full glass-tab flex justify-around items-center h-16 z-20 border-b border-white/50">
          <button
            onClick={() => setActiveTab('checkin')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'checkin' ? "text-blue-600 scale-105" : "text-slate-500 hover:text-blue-600"
            )}
          >
            <MapPin className={clsx("w-6 h-6", activeTab === 'checkin' && "fill-current drop-shadow-sm")} />
            <span className="text-[10px] font-bold tracking-wider mt-1">チェックイン</span>
          </button>

          <button
            onClick={() => setActiveTab('dao')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'dao' ? "text-emerald-600 scale-105" : "text-slate-500 hover:text-emerald-600"
            )}
          >
            <Users className={clsx("w-6 h-6", activeTab === 'dao' && "fill-current drop-shadow-sm")} />
            <span className="text-[10px] font-bold tracking-wider mt-1">DAO</span>
          </button>

          <button
            onClick={() => setActiveTab('card')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'card' ? "text-purple-600 scale-105" : "text-slate-500 hover:text-purple-600"
            )}
          >
            <UserSquare2 className={clsx("w-6 h-6", activeTab === 'card' && "fill-current drop-shadow-sm")} />
            <span className="text-[10px] font-bold tracking-wider mt-1">住民票</span>
          </button>
        </div>

        {/* 3. Main Content */}
        <main className="flex-1 overflow-y-auto relative">
          {activeTab === 'checkin' && (
            <StayFeature
              onCheckinSuccess={() => setCheckedIn(true)}
              tokenCount={tokenCount}
              setTokenCount={setTokenCount}
              distance={distance}
              elapsed={elapsed}
              checkedIn={checkedIn}
              onStopMeasurement={handleStopMeasurement}
              tokenObjectId={tokenObjectId} // Added prop
            />
          )}
          {activeTab === 'dao' && (
            <DAOFeature
              residentPassId={residentPassId}
              setResidentPassId={setResidentPassId}
            />
          )}
          {activeTab === 'card' && <ResidentCard />}
        </main>


        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#1e293b',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
          }}
        />
      </div>
    </div>
  );
};

export default App;