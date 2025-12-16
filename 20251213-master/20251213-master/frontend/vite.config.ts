import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Sui GPS Check-in',
        short_name: 'GPS Check-in',
        description: 'Sui Blockchain GPS Check-in App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true, // 外部アクセスを許可
    port: 5174,
    strictPort: true,
    proxy: {
      '/sui-rpc': {
        target: 'https://fullnode.devnet.sui.io',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/sui-rpc/, ''),
      },
    },
  },
});


