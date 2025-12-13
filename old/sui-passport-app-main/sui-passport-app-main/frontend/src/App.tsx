import React, { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { StayFeature } from './StayFeature';
import { ResidentCard } from './components/ResidentCard';
import { Toaster } from 'react-hot-toast';
import { MapPin, UserSquare2 } from 'lucide-react';
import clsx from 'clsx';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkin' | 'card'>('checkin');

  return (
    <div className="min-h-screen w-full bg-mesh flex items-center justify-center font-sans text-slate-800">
      <div className="w-full max-w-[390px] h-[85vh] max-h-[850px] glass-panel rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border border-white/50">
        <header className="bg-white/40 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/50 z-10">
          <h1 className="text-slate-800 font-bold text-lg tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            Sui Passport
          </h1>
          <div className="scale-90 origin-right">
            <ConnectButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative pb-20">
          {activeTab === 'checkin' ? <StayFeature /> : <ResidentCard />}
        </main>

        {/* Bottom Navigation Tab */}
        <div className="absolute bottom-0 left-0 w-full glass-tab flex justify-around items-center h-16 z-20">
          <button
            onClick={() => setActiveTab('checkin')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'checkin' ? "text-blue-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <MapPin className={clsx("w-6 h-6 mb-1", activeTab === 'checkin' && "fill-current drop-shadow-sm")} />
            <span className="text-[10px] font-bold tracking-wider">Check-in</span>
          </button>

          <button
            onClick={() => setActiveTab('card')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'card' ? "text-purple-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <UserSquare2 className={clsx("w-6 h-6 mb-1", activeTab === 'card' && "fill-current drop-shadow-sm")} />
            <span className="text-[10px] font-bold tracking-wider">My Card</span>
          </button>
        </div>

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


