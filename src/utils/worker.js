import { pipeline } from '@xenova/transformers';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Set environment variables for Transformers.js
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}

// --- Singleton Service Class ---
// Manages both FFmpeg and the transcription pipeline instances to ensure
// they are loaded only once.
class TranscriptionService {
    constructor() {
        this.ffmpeg = null;
        this.transcriber = null;
        this.ffmpegReady = false;
        this.transcriberReady = false;
        this.ffmpegLoadingPromise = null;
        this.transcriberLoadingPromise = null;
    }

    // Loads FFmpeg instance.
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
                ffmpeg.on('log', ({ message }) => {
                    // Optional: Post progress messages back for debugging if needed
                    // self.postMessage({ status: 'ffmpeg_log', message });
                });

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

    // Loads the transcription pipeline instance.
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

    // Ensures all services are ready before proceeding.
    async ensureReady() {
        await this.loadFFmpeg();
        await this.loadTranscriber();
    }

    // The main transcription logic.
    async transcribe(audioUrl, language, task) {
        if (!this.ffmpegReady || !this.transcriberReady) {
            throw new Error('Services not initialized. Call ensureReady() first.');
        }

        self.postMessage({ status: 'audio_downloading' });
        const audioData = await fetchFile(audioUrl);

        const inputFileName = 'input.audio';
        const outputFileName = 'output.wav';

        await this.ffmpeg.writeFile(inputFileName, audioData);

        self.postMessage({ status: 'audio_converting' });
        await this.ffmpeg.exec(['-i', inputFileName, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputFileName]);
        const wavData = await this.ffmpeg.readFile(outputFileName);

        const pcmData = new Int16Array(wavData.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;
        }

        self.postMessage({ status: 'transcribing' });
        const output = await this.transcriber(floatData, {
            language: language,
            task: task,
        });

        // Clean up virtual file system
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);

        return output.text;
    }
}

// --- Worker Setup ---

const service = new TranscriptionService();

// Immediately start loading the required models and tools when the worker is created.
// This makes subsequent transcription requests much faster.
service.ensureReady().catch(console.error);

// Listen for messages from the main thread.
self.addEventListener('message', async (event) => {
    try {
        // Wait for services to be ready if they aren't already
        await service.ensureReady();

        const { audio: audioUrl, language, task } = event.data;

        const transcription = await service.transcribe(audioUrl, language, task);

        self.postMessage({
            status: 'complete',
            output: transcription,
        });

    } catch (error) {
        console.error('Error in worker during transcription:', error);
        self.postMessage({
            status: 'error',
            error: String(error.message || error),
        });
    }
});
