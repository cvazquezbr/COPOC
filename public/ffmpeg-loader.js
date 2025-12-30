// public/ffmpeg-loader.js

(async () => {
    // Helper to load a script dynamically
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load FFmpeg and util libraries from CDN
    try {
        await loadScript('https://unpkg.com/@ffmpeg/util@0.12.2/dist/umd/index.js');
        await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd/index.js');
    } catch (error) {
        console.error('Failed to load FFmpeg libraries from CDN', error);
        window.parent.postMessage({ type: 'error', detail: 'Failed to load FFmpeg libraries' }, '*');
        return;
    }

    const { FFmpeg } = window.FFmpeg;
    const { fetchFile } = window.FFmpegUtil;

    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        // console.log('[FFMPEG LOG]', message);
    });

    const loadCore = async () => {
        try {
            // Load core from local path. The iframe context should prevent Vercel rewrites.
            await ffmpeg.load({
                coreURL: '/ffmpeg/ffmpeg-core.js',
                wasmURL: '/ffmpeg/ffmpeg-core.wasm'
            });
            // Notify the parent window that FFmpeg is ready
            window.parent.postMessage({ type: 'ffmpeg-loaded' }, '*');
        } catch (error) {
            console.error('FFmpeg core failed to load', error);
            window.parent.postMessage({ type: 'error', detail: `FFmpeg core failed to load: ${error.message}` }, '*');
        }
    };

    loadCore();

    window.addEventListener('message', async (event) => {
        const { type, videoUrl } = event.data;

        if (type === 'extract-audio') {
            if (!ffmpeg.loaded) {
                 window.parent.postMessage({ type: 'error', detail: 'FFmpeg is not loaded yet.' }, '*');
                 return;
            }
            try {
                window.parent.postMessage({ type: 'progress', detail: 'Downloading video...' }, '*');
                const videoData = await fetchFile(videoUrl);

                const inputFileName = 'input.video';
                const outputFileName = 'output.wav';

                await ffmpeg.writeFile(inputFileName, videoData);

                window.parent.postMessage({ type: 'progress', detail: 'Extracting audio...' }, '*');

                await ffmpeg.exec([
                    '-i', inputFileName,
                    '-ar', '16000',
                    '-ac', '1',
                    '-c:a', 'pcm_s16le',
                    outputFileName
                ]);

                const audioData = await ffmpeg.readFile(outputFileName);

                const pcmData = new Int16Array(audioData.buffer);
                const floatData = new Float32Array(pcmData.length);
                for (let i = 0; i < pcmData.length; i++) {
                    floatData[i] = pcmData[i] / 32768.0;
                }

                // Send the audio data back to the parent as a transferable object
                window.parent.postMessage({ type: 'audio-extracted', audioData: floatData }, '*', [floatData.buffer]);

                // Cleanup files
                await ffmpeg.deleteFile(inputFileName);
                await ffmpeg.deleteFile(outputFileName);

            } catch (error) {
                console.error('Error during audio extraction:', error);
                window.parent.postMessage({ type: 'error', detail: String(error) }, '*');
            }
        }
    });
})();
