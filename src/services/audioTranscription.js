
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

class AudioTranscriptionService {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
  }

  async loadFFmpeg() {
    if (this.loaded) return;

    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

    try {
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
      // 1. Carregar FFmpeg (apenas uma vez)
      await this.loadFFmpeg();

      onProgress?.('Baixando áudio...', 10);

      // 2. Baixar o arquivo de áudio
      const audioData = await fetchFile(audioUrl);

      onProgress?.('Convertendo áudio...', 30);

      // 3. Escrever arquivo no sistema virtual do FFmpeg
      await this.ffmpeg.writeFile('input.audio', audioData);

      // 4. Converter para formato adequado (MP3 ou WAV)
      await this.ffmpeg.exec([
        '-i', 'input.audio',
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '44100',
        'output.mp3'
      ]);

      onProgress?.('Preparando transcrição...', 60);

      // 5. Ler arquivo convertido
      const convertedData = await this.ffmpeg.readFile('output.mp3');

      // 6. Criar blob para enviar à API
      const audioBlob = new Blob([convertedData.buffer], { type: 'audio/mp3' });

      onProgress?.('Transcrevendo...', 70);

      // 7. Enviar para API de transcrição (agora apenas texto, não processamento de áudio)
      const transcription = await this.sendToTranscriptionAPI(audioBlob);

      onProgress?.('Concluído!', 100);

      // 8. Limpar arquivos temporários
      await this.ffmpeg.deleteFile('input.audio');
      await this.ffmpeg.deleteFile('output.mp3');

      return transcription;

    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  async sendToTranscriptionAPI(audioBlob) {
    // Criar FormData para enviar áudio
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
