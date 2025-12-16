import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mysten/dapp-kit/dist/index.css';
import './index.css';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// ✅ devnet を使う (CORS回避のためプロキシ経由)
const { networkConfig } = createNetworkConfig({
  devnet: { url: getFullnodeUrl('devnet') },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 高速化設定: キャッシュ有効期限を60秒にし、頻繁な再取得を防ぐ
      staleTime: 60 * 1000,
      // RPC負荷軽減: ウィンドウフォーカス時の自動再取得をオフ
      refetchOnWindowFocus: false,
      // エラー時のリトライ回数を制限
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork="devnet"   // ← ここ重要
      >
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
