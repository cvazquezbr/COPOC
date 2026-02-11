import { pipeline } from '@xenova/transformers';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Set environment variables for Transformers.js
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}

// --- Singleton Service Class ---
class MediaAIService {
    constructor() {
        this.ffmpeg = null;
        this.transcriber = null;
        this.translator = null;
        this.ffmpegReady = false;
        this.transcriberReady = false;
        this.translatorReady = false;
        this.ffmpegLoadingPromise = null;
        this.transcriberLoadingPromise = null;
        this.translatorLoadingPromise = null;
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
                        self.postMessage({ status: 'model_download_progress', model: 'transcription', progress });
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

    async loadTranslator(model = 'Xenova/m2m100_418M') {
        if (this.translatorReady) return;
        if (this.translatorLoadingPromise) return this.translatorLoadingPromise;

        self.postMessage({ status: 'translator_loading' });

        this.translatorLoadingPromise = new Promise(async (resolve, reject) => {
            try {
                this.translator = await pipeline('translation', model, {
                    progress_callback: (progress) => {
                        self.postMessage({ status: 'model_download_progress', model: 'translation', progress });
                    },
                });
                this.translatorReady = true;
                self.postMessage({ status: 'translator_ready' });
                resolve();
            } catch (error) {
                console.error('Failed to load translator model in worker:', error);
                self.postMessage({ status: 'translator_error', error: String(error) });
                reject(error);
            } finally {
                this.translatorLoadingPromise = null;
            }
        });
        return this.translatorLoadingPromise;
    }

    async ensureReady(loadTranslator = false) {
        await this.loadFFmpeg();
        await this.loadTranscriber();
        if (loadTranslator) {
            await this.loadTranslator();
        }
    }

    isLoaded() {
        return this.ffmpegReady && this.transcriberReady;
    }

    async transcribe(audioUrl, language, task) {
        if (!this.isLoaded()) {
            throw new Error('Services not initialized. Send INIT message first.');
        }

        self.postMessage({ status: 'audio_downloading' });

        let audioData;
        try {
            const response = await fetch(audioUrl);
            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'No body');
                throw new Error(`HTTP ${response.status}: ${response.statusText}. Body: ${errorBody.substring(0, 100)}`);
            }
            const buffer = await response.arrayBuffer();
            audioData = new Uint8Array(buffer);
        } catch (e) {
            console.error('Worker fetch failed:', e);
            throw new Error(`Falha ao baixar áudio para transcrição: ${e.message}`);
        }

        const inputFileName = 'input.audio';
        const outputFileName = 'output.wav';
        await this.ffmpeg.writeFile(inputFileName, audioData);

        self.postMessage({ status: 'audio_converting' });
        const filters = 'highpass=f=100,lowpass=f=3000,afftdn,dynaudnorm';
        const exitCode = await this.ffmpeg.exec([
            '-i', inputFileName,
            '-af', filters,
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            outputFileName
        ]);
        if (exitCode !== 0) {
            throw new Error(`FFmpeg conversion failed with exit code ${exitCode}. The input file might be corrupted or in an unsupported format.`);
        }
        const wavData = await this.ffmpeg.readFile(outputFileName);

        const pcmData = new Int16Array(wavData.buffer.slice(44));
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;
        }

        self.postMessage({ status: 'transcribing' });
        const output = await this.transcriber(floatData, {
            language: language,
            task: task,
            chunk_length_s: 30,
            stride_length_s: 5,
        });

        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        return output.text;
    }

    async translate(text, src_lang, tgt_lang) {
        if (!this.translatorReady) {
            await this.loadTranslator();
        }

        self.postMessage({ status: 'translating' });

        // M2M100 uses language codes like 'pt', 'es', etc.
        // If coming from the UI, we might need to map 'portuguese' to 'pt'
        const langMap = {
            'portuguese': 'pt',
            'spanish': 'es',
            'espanhol': 'es',
            'english': 'en',
        };

        const src = langMap[src_lang.toLowerCase()] || src_lang;
        const tgt = langMap[tgt_lang.toLowerCase()] || tgt_lang;

        const output = await this.translator(text, {
            src_lang: src,
            tgt_lang: tgt,
        });

        return output[0].translation_text;
    }
}

// --- Worker Setup ---
const service = new MediaAIService();

self.addEventListener('message', async (event) => {
    const { type } = event.data;

    if (type === 'INIT') {
        try {
            const { loadTranslator } = event.data;
            await service.ensureReady(loadTranslator);
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

    if (type === 'TRANSLATE') {
        try {
            const { text, src_lang, tgt_lang } = event.data;
            const translation = await service.translate(text, src_lang, tgt_lang);
            self.postMessage({ status: 'translation_complete', output: translation });
        } catch (error) {
            console.error('Error in worker during translation:', error);
            self.postMessage({
                status: 'error',
                error: String(error.message || error),
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
