import { defineConfig } from 'vite';

// The SDK resolves its workers and circuits relative to import.meta.url, so it must not be pre-bundled.
export default defineConfig({
  optimizeDeps: { exclude: ['stellar-private-payments'] },
  server: {
    port: 5174,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
