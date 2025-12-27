import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copy } from 'vite-plugin-copy'
import apiMiddleware from './vite.api.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      copy({
        targets: [
          {
            src: 'node_modules/pdfjs-dist/build/pdf.worker.mjs',
            dest: 'public/',
          },
        ],
        // This ensures the copy happens during development as well
        hook: 'buildStart'
      }),
    ],
    
    server: {
      middlewares: [apiMiddleware],
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    
    build: {
      target: 'esnext',
      assetsInclude: ['**/*.wasm'],
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name.endsWith('.wasm')) {
              return 'assets/[name][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          }
        }
      }
    },
    
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
    },
    
    worker: {
      format: 'es'
    },
    
    define: {
      global: 'globalThis',
      'process.env.VITE_MODELS_URL': JSON.stringify(env.VITE_MODELS_URL),
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    },
  }
})