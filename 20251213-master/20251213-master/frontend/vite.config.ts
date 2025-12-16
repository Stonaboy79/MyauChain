import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
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


