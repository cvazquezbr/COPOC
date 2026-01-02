
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

class AudioTranscriptionService {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
  }

  async loadFFmpeg() {
    if (this.loaded) {
      console.log('FFmpeg already loaded.');
      return;
    }

    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

    try {
      console.log('Loading FFmpeg...');
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });

      this.loaded = true;
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('Não foi possível carregar o processador de áudio');
    }
  }

  async transcribeFromUrl(audioUrl, onProgress) {
    try {
      console.log('Starting transcription process...');
      onProgress?.('Initializing...', 0);

      await this.loadFFmpeg();

      onProgress?.('Baixando áudio...', 10);
      console.log('Downloading audio...');
      const audioData = await fetchFile(audioUrl);
      console.log('Audio downloaded.');

      onProgress?.('Convertendo áudio...', 30);
      console.log('Converting audio...');
      await this.ffmpeg.writeFile('input.audio', audioData);

      await this.ffmpeg.exec([
        '-i', 'input.audio',
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '44100',
        'output.mp3'
      ]);
      console.log('Audio converted.');

      onProgress?.('Preparando transcrição...', 60);
      const convertedData = await this.ffmpeg.readFile('output.mp3');
      const audioBlob = new Blob([convertedData.buffer], { type: 'audio/mp3' });
      console.log('Audio blob created.');

      onProgress?.('Transcrevendo...', 70);
      console.log('Sending to transcription API...');
      const transcription = await this.sendToTranscriptionAPI(audioBlob);
      console.log('Transcription received.');

      onProgress?.('Concluído!', 100);

      await this.ffmpeg.deleteFile('input.audio');
      await this.ffmpeg.deleteFile('output.mp3');

      return transcription;

    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  async sendToTranscriptionAPI(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.mp3');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    return data.transcription;
  }
}

export default new AudioTranscriptionService();
