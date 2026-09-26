import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { macOSEndpointPlugin } from './src/server/macos-bridge-plugin';

export default defineConfig({
  plugins: [react(), macOSEndpointPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: '127.0.0.1',
  },
  build: {
    rollupOptions: {
      external: ['@tauri-apps/plugin-fs'],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
