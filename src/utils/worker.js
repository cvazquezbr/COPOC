import { pipeline } from '@xenova/transformers';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Set environment variables for Transformers.js
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}

// --- Singleton Service Class ---
class TranscriptionService {
    constructor() {
        this.ffmpeg = null;
        this.transcriber = null;
        this.ffmpegReady = false;
        this.transcriberReady = false;
        this.ffmpegLoadingPromise = null;
        this.transcriberLoadingPromise = null;
    }

    async loadFFmpeg() {
        if (this.ffmpegReady) return;
        if (this.ffmpegLoadingPromise) return this.ffmpegLoadingPromise;

        self.postMessage({ status: 'ffmpeg_loading' });

        this.ffmpegLoadingPromise = new Promise(async (resolve, reject) => {
            try {
                if (!crossOriginIsolated) {
                    throw new Error('crossOriginIsolated is false. FFmpeg requires COOP/COEP headers.');
                }
                const ffmpeg = new FFmpeg();
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                this.ffmpeg = ffmpeg;
                this.ffmpegReady = true;
                self.postMessage({ status: 'ffmpeg_ready' });
                resolve();
            } catch (error) {
                console.error('Failed to load FFmpeg in worker:', error);
                self.postMessage({ status: 'ffmpeg_error', error: String(error) });
                reject(error);
            } finally {
                this.ffmpegLoadingPromise = null;
            }
        });
        return this.ffmpegLoadingPromise;
    }

    async loadTranscriber(model = 'Xenova/whisper-small') {
        if (this.transcriberReady) return;
        if (this.transcriberLoadingPromise) return this.transcriberLoadingPromise;

        self.postMessage({ status: 'transcriber_loading' });

        this.transcriberLoadingPromise = new Promise(async (resolve, reject) => {
            try {
                this.transcriber = await pipeline('automatic-speech-recognition', model, {
                    progress_callback: (progress) => {
                        self.postMessage({ status: 'model_download_progress', progress });
                    },
                });
                this.transcriberReady = true;
                self.postMessage({ status: 'transcriber_ready' });
                resolve();
            } catch (error) {
                console.error('Failed to load transcriber model in worker:', error);
                self.postMessage({ status: 'transcriber_error', error: String(error) });
                reject(error);
            } finally {
                this.transcriberLoadingPromise = null;
            }
        });
        return this.transcriberLoadingPromise;
    }

    async ensureReady() {
        await this.loadFFmpeg();
        await this.loadTranscriber();
    }

    isLoaded() {
        return this.ffmpegReady && this.transcriberReady;
    }

    async transcribe(audioUrl, language, task) {
        if (!this.isLoaded()) {
            throw new Error('Services not initialized. Send INIT message first.');
        }

        self.postMessage({ status: 'audio_downloading' });
        const audioData = await fetchFile(audioUrl);
        const inputFileName = 'input.audio';
        const outputFileName = 'output.wav';
        await this.ffmpeg.writeFile(inputFileName, audioData);

        self.postMessage({ status: 'audio_converting' });
        await this.ffmpeg.exec(['-i', inputFileName, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputFileName]);
        const wavData = await this.ffmpeg.readFile(outputFileName);

        self.postMessage({ status: 'transcribing' });
        const output = await this.transcriber(wavData, {
            language: language,
            task: task,
        });

        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        return output.text;
    }
}

// --- Worker Setup ---
const service = new TranscriptionService();

self.addEventListener('message', async (event) => {
    const { type } = event.data;

    if (type === 'INIT') {
        try {
            await service.ensureReady();
            self.postMessage({ status: 'INIT_COMPLETE' });
        } catch (error) {
            console.error('Initialization failed in worker:', error);
            self.postMessage({
                status: 'ERROR',
                error: `Worker initialization failed: ${String(error.message || error)}`,
            });
        }
        return;
    }

    if (event.data.audio) {
        try {
            if (!service.isLoaded()) {
                throw new Error('Worker not initialized. Send INIT message first.');
            }
            const { audio: audioUrl, language, task } = event.data;
            const transcription = await service.transcribe(audioUrl, language, task);
            self.postMessage({ status: 'complete', output: transcription });
        } catch (error) {
            console.error('Error in worker during transcription:', error);
            self.postMessage({
                status: 'error',
                error: String(error.message || error),
            });
        }
    }
});
