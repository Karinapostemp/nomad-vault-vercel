import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_URL lets you point the dev server at another backend; the default is the local Nomad Vault server.
const target = process.env.API_URL || 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target, changeOrigin: true } },
  },
});
