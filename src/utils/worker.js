import { pipeline } from '@xenova/transformers';
import { FFmpeg } from '@ffmpeg/ffmpeg';
// ADICIONAR toBlobURL
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { log } from 'console';

// Environment variable for model path
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}

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

// Singleton for FFmpeg
class FFmpegInstance {
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            const ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => {
                console.log(message);
            });
            ffmpeg.on('progress', ({ progress, time }) => {
                if (progress_callback) {
                    // Progress updates can be sent here
                }
            });

            await ffmpeg.load({
                coreURL: '/ffmpeg/ffmpeg-core.js',
                wasmURL: '/ffmpeg/ffmpeg-core.wasm'
            });

            this.instance = ffmpeg;
        }
        return this.instance;
    }
}


self.addEventListener('message', async (event) => {
    try {
        const ffmpeg = await FFmpegInstance.getInstance();
        const transcriber = await TranscriptionPipeline.getInstance((progress) => {
            self.postMessage({ status: 'progress', progress: progress.progress });
        });

        const videoUrl = event.data.audio;

        self.postMessage({ status: 'progress', progress: 'Downloading video...' });
        const videoData = await fetchFile(videoUrl);
        const inputFileName = 'input.video';
        const outputFileName = 'output.wav';

        await ffmpeg.writeFile(inputFileName, videoData);

        self.postMessage({ status: 'progress', progress: 'Extracting audio...' });
        await ffmpeg.exec([
            '-i', inputFileName,
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            outputFileName
        ]);

        const audioData = await ffmpeg.readFile(outputFileName);

        // The raw audio data needs to be converted to a Float32Array
        // that the model can process. The raw data is signed 16-bit PCM.
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
        console.error(error);
        self.postMessage({
            status: 'error',
            error: String(error),
        });
    }
});
