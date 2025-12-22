import { pipeline } from '@xenova/transformers';

// Create a singleton instance of the speech recognition pipeline
let transcriber = null;

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    // If the transcriber is not initialized, create it
    if (transcriber === null) {
        try {
            transcriber = await pipeline(
                'automatic-speech-recognition',
                'Xenova/whisper-small',
                {
                    progress_callback: (progress) => {
                        // Post a progress message to the main thread
                        self.postMessage({
                            status: 'progress',
                            progress: progress.progress,
                        });
                    },
                }
            );
        } catch (error) {
            // If there's an error during initialization, post an error message
            self.postMessage({
                status: 'error',
                data: error,
            });
            return;
        }
    }

    // Extract the audio data from the message
    const audio = event.data.audio;

    if (typeof audio === 'string') {
        try {
            // Perform the transcription
            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
            });
            // Post the completed transcription to the main thread
            self.postMessage({
                status: 'complete',
                output: output.text,
            });
        } catch (error) {
            // If there's an error during transcription, post an error message
            self.postMessage({
                status: 'error',
                data: error,
            });
        }
    } else {
        // If the audio data is not a string, post an error message
        self.postMessage({
            status: 'error',
            data: { message: 'Invalid audio data format.' },
        });
    }
});
