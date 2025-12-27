import { pipeline } from '@xenova/transformers';

// Configura a variável de ambiente que a biblioteca Xenova usa para o caminho base dos modelos
if (process.env.VITE_MODELS_URL) {
    self.XENOVA_MODELS_URL = process.env.VITE_MODELS_URL;
}

class TranscriptionPipeline {
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
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
