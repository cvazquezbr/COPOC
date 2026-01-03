import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) {
      console.log('FFmpeg already loaded');
      return;
    }

    // Verificar suporte antes de carregar
    if (!crossOriginIsolated) {
      throw new Error(
        'crossOriginIsolated is false. FFmpeg requires COOP/COEP headers. ' +
        'Check vite.config.js and vercel.json configuration.'
      );
    }

    console.log('Loading FFmpeg...');

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    try {
      // Converter URLs para Blob URLs (necessário para CORS)
      const coreURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        'text/javascript'
      );
      const wasmURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        'application/wasm'
      );

      console.log('Blob URLs created:', { coreURL, wasmURL });

      // Carregar FFmpeg com Blob URLs
      await this.ffmpeg.load({
        coreURL,
        wasmURL
      });

      this.loaded = true;
      console.log('FFmpeg loaded successfully!');

    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error(`FFmpeg loading failed: ${error.message}`);
    }
  }

  getFFmpeg() {
    if (!this.loaded) {
      throw new Error('FFmpeg not loaded. Call load() first.');
    }
    return this.ffmpeg;
  }

  isLoaded() {
    return this.loaded;
  }
}

// Exportar instância singleton
export default new FFmpegService();
