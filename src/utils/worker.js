import { pipeline } from '@xenova/transformers';

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

self.addEventListener('message', async (event) => {
    try {
        const transcriber = await TranscriptionPipeline.getInstance((progress) => {
            self.postMessage({ status: 'progress', progress });
        });

        const floatData = event.data.audioData;

        self.postMessage({ status: 'progress', progress: 'Transcribing...' });
        const output = await transcriber(floatData, {
            language: event.data.language,
            task: event.data.task,
        });

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
