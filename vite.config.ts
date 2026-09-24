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
    host: true,
    cors: true,
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
