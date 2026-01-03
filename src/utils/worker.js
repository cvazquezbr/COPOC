
import { pipeline } from '@xenova/transformers';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Environment variable for model path
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}

class TranscriptionPipeline {
    static task = 'automatic-speech-recognition';
    static model = null;
    static instance = null;

    static async getInstance(progress_callback = null, model) {
        if (this.instance === null || this.model !== model) {
            this.model = model;
            this.instance = await pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}

class FFmpegInstance {
    static instance = null;
    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            const ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => {
                if (progress_callback) progress_callback(message);
            });

            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

            try {
                if (!crossOriginIsolated) {
                    throw new Error('crossOriginIsolated is false. FFmpeg requires COOP/COEP headers.');
                }

                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

                await ffmpeg.load({
                    coreURL,
                    wasmURL
                });

                this.instance = ffmpeg;
            } catch (error) {
                console.error('Failed to load FFmpeg in worker:', error);
                throw error; // Re-throw to be caught by the event listener
            }
        }
        return this.instance;
    }
}


self.addEventListener('message', async (event) => {
    try {
        const ffmpeg = await FFmpegInstance.getInstance((message) => {
            self.postMessage({ status: 'progress', progress: message });
        });

        const transcriber = await TranscriptionPipeline.getInstance((progress) => {
            self.postMessage({ status: 'progress', progress });
        }, event.data.model);

        self.postMessage({ status: 'progress', progress: 'Downloading audio...' });
        const videoData = await fetchFile(event.data.audio);

        const inputFileName = 'input.video';
        const outputFileName = 'output.wav';

        await ffmpeg.writeFile(inputFileName, videoData);

        self.postMessage({ status: 'progress', progress: 'Extracting audio...' });
        await ffmpeg.exec(['-i', inputFileName, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputFileName]);
        const audioData = await ffmpeg.readFile(outputFileName);

        const pcmData = new Int16Array(audioData.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;
        }

        self.postMessage({ status: 'progress', progress: 'Transcribing...' });
        const output = await transcriber(floatData, {
            language: event.data.language,
            task: event.data.task,
        });

        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(outputFileName);

        self.postMessage({
            status: 'complete',
            output: output.text,
        });

    } catch (error) {
        console.error('Error in worker:', error);
        self.postMessage({
            status: 'error',
            error: String(error.message || error),
        });
    }
});
