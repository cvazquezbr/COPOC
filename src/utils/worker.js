import { pipeline } from '@xenova/transformers';

// Environment variable for model path
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}
// Use the new createFFmpeg import as requested
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

// Create the FFmpeg instance with the CDN core path
const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
});

// Singleton for the transcription pipeline
class TranscriptionPipeline {
    static instance = null;
    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                progress_callback,
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    try {
        // Ensure FFmpeg is loaded
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }

        const transcriber = await TranscriptionPipeline.getInstance((progress) => {
            self.postMessage({ status: 'progress', progress: progress.progress });
        });

        const videoUrl = event.data.audio;

        self.postMessage({ status: 'progress', progress: 'Downloading video...' });
        const videoData = await fetchFile(videoUrl);
        const inputFileName = 'input.video';
        const outputFileName = 'output.wav';

        ffmpeg.FS('writeFile', inputFileName, videoData);

        self.postMessage({ status: 'progress', progress: 'Extracting audio...' });
        await ffmpeg.run('-i', inputFileName, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputFileName);

        const audioData = ffmpeg.FS('readFile', outputFileName);

        // Convert audio data to Float32Array
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

        // Cleanup
        ffmpeg.FS('unlink', inputFileName);
        ffmpeg.FS('unlink', outputFileName);

        self.postMessage({
            status: 'complete',
            output: output.text,
        });

    } catch (error) {
        console.error(error);
        self.postMessage({
            status: 'error',
            error: String(error),
        });
    }
});
