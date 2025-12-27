import { pipeline } from '@xenova/transformers';

class TranscriptionPipeline {
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {

            const MODELS_URL = process.env.VITE_MODELS_URL;

            this.instance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
                model_file_path: MODELS_URL,
                progress_callback,
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    try {
        const transcriber = await TranscriptionPipeline.getInstance((progress) => {
            self.postMessage({ status: 'progress', progress: progress.progress });
        });

        const output = await transcriber(event.data.audio, {
            language: event.data.language,
            task: event.data.task,
        });

        self.postMessage({
            status: 'complete',
            output: output.text,
        });
    } catch (error) {
        self.postMessage({
            status: 'error',
            error: error.message,
        });
    }
});
