import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copy } from 'vite-plugin-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    copy({
      targets: [
        {
          src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',
          dest: 'public'
        },
        {
          src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',
          dest: 'public'
        }
      ],
      hook: 'config' // Execute during the 'config' hook to ensure files are available for the dev server
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
