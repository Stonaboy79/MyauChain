import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useDisconnectWallet } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { MapPin, Send, Loader2, CheckCircle2, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { getGoogleOAuthUrl, parseJwtFromUrl, getSuiAddressFromJwt } from './utils/zkLogin';

// Configuration
const PACKAGE_ID = '0x7fe284ce69c9bd0cbd43637b3a5bb961b71df27eb66ac40efe90b179bfa6df6c';
const MODULE_NAME = 'locus';
const CLOCK_OBJECT_ID = '0x6';

function App() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [proposalText, setProposalText] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);

  const userAddress = account?.address || zkLoginAddress;

  useEffect(() => {
    const hash = window.location.hash;

    if (hash && hash.includes('id_token')) {
      const idToken = parseJwtFromUrl(hash);

      if (idToken) {
        try {
          const address = getSuiAddressFromJwt(idToken);
          setZkLoginAddress(address);

          // Clear the hash to clean up the URL
          window.history.replaceState(null, '', window.location.pathname);

          setStatus({ type: 'success', message: 'Googleログインに成功しました！' });
        } catch (e) {
          console.error('Error deriving address:', e);

          // Fallback for MVP/Testing if real JWT fails (optional, based on user request "or a mock address for MVP")
          // For now, we'll stick to the error, but if the user wants a forced login for demo:
          // setZkLoginAddress('0xMockAddressForDemo...'); 

          setStatus({ type: 'error', message: 'ログインに失敗しました。' });
        }
      }
    }
  }, []);

  const handleCheckIn = () => {
    if (!userAddress) return;
    setIsCheckingIn(true);
    setStatus(null);

    if (zkLoginAddress) {
      // Simulated Check In for zkLogin
      setTimeout(() => {
        setStatus({ type: 'success', message: '東京でのチェックインに成功しました！ (zkLogin Simulation)' });
        setIsCheckingIn(false);
      }, 1000);
      return;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::check_in`,
      arguments: [
        tx.pure.string("Tokyo"),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Check-in success:', result);
          setStatus({ type: 'success', message: '東京でのチェックインに成功しました！' });
          setIsCheckingIn(false);
        },
        onError: (error) => {
          console.error('Check-in failed:', error);
          setStatus({ type: 'error', message: `チェックインに失敗しました: ${error.message}` });
          setIsCheckingIn(false);
        },
      },
    );
  };

  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !proposalText.trim()) return;
    setIsSubmitting(true);
    setStatus(null);

    if (zkLoginAddress) {
      // Simulated Proposal for zkLogin
      setTimeout(() => {
        setStatus({ type: 'success', message: '提案が正常に送信されました！ (zkLogin Simulation)' });
        setProposalText('');
        setIsSubmitting(false);
      }, 1000);
      return;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_proposal`,
      arguments: [
        tx.pure.string(proposalText),
      ],
    });

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Proposal created:', result);
          setStatus({ type: 'success', message: '提案が正常に送信されました！' });
          setProposalText('');
          setIsSubmitting(false);
        },
        onError: (error) => {
          console.error('Proposal failed:', error);
          setStatus({ type: 'error', message: `送信に失敗しました: ${error.message}` });
          setIsSubmitting(false);
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
            Locus
          </h1>
          <p className="text-muted-foreground">分散型位置証明</p>
        </div>

        {/* Wallet Connection */}
        <div className="flex flex-col items-center gap-4">
          {!userAddress && (
            <div className="w-full space-y-3">
              <div className="w-full [&>button]:!w-full [&>button]:!justify-center [&>button]:!bg-slate-900 [&>button]:!text-white [&>button]:!rounded-xl [&>button]:!font-medium [&>button]:!px-6 [&>button]:!py-4 [&>button]:hover:!bg-slate-800 [&>button]:!transition-all [&>button]:!shadow-lg [&>button]:!h-auto">
                <ConnectButton />
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-medium">または</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <a
                href={getGoogleOAuthUrl()}
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow-md group"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                Login with Google
              </a>
            </div>
          )}

          {account && !zkLoginAddress && (
            <div className="flex flex-col items-center gap-2 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm w-full">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Wallet className="w-4 h-4 text-slate-700" />
                Wallet Connected
              </div>
              <div className="text-xs text-muted-foreground font-mono break-all text-center px-2">
                {account.address}
              </div>
              <button
                onClick={() => disconnect()}
                className="text-xs text-red-500 hover:text-red-600 hover:underline mt-2 font-medium"
              >
                ログアウト
              </button>
            </div>
          )}

          {zkLoginAddress && (
            <div className="flex flex-col items-center gap-2 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm w-full">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                zkLogin Connected
              </div>
              <div className="text-xs text-muted-foreground font-mono break-all text-center px-2">
                {zkLoginAddress}
              </div>
              <button
                onClick={() => setZkLoginAddress(null)}
                className="text-xs text-red-500 hover:text-red-600 hover:underline mt-2 font-medium"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>

        {!userAddress ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card text-center py-12 border-dashed border-2 border-slate-200 bg-white/50"
          >
            <Wallet className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-600">ウォレットを接続して続行</p>
            <p className="text-sm text-muted-foreground mt-1">Sui Wallet または Google アカウント</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Status Message */}
            <AnimatePresence mode="wait">
              {status && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={clsx(
                    "p-4 rounded-lg flex items-center gap-3 text-sm font-medium",
                    status.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                  )}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {status.message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Check In Section */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">現在地</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-slate-900 font-medium">東京</span> での存在をオンチェーンで証明します。
              </p>
              <button
                onClick={handleCheckIn}
                disabled={isCheckingIn}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isCheckingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'チェックイン'}
              </button>
            </motion.div>

            {/* Proposal Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                  <Send className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">新規提案</h2>
              </div>
              <form onSubmit={handleSubmitProposal} className="space-y-4">
                <input
                  type="text"
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  placeholder="提案内容を入力..."
                  className="input-field"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !proposalText.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 shadow-none text-white"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '提案を送信'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
