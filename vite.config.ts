// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend URLs
const API_DEV = 'http://localhost:5000';
const API_PROD = 'https://acenexacbt.onrender.com'; // <-- replace with your real backend

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    plugins: [react()],
    base: './', // relative paths for production build
    server: {
      port: 5173,
      strictPort: true,
      open: true,
      proxy: {
        '/api': {
          target: API_DEV,
          changeOrigin: true,
          secure: false,
          rewrite: path => path.replace(/^\/api/, ''),
        }
      }
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(isProd ? API_PROD : API_DEV),
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify('pk_live_6285198feb88d1bf9515732e6eea990012a8344e') // replace with your real key
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});
