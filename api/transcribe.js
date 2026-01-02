
// /api/transcribe.js
import { pipeline } from '@xenova/transformers';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

async function transcribe(audio, model, language, task) {
  const ffmpeg = new FFmpeg();

  try {
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    const coreURL = `${baseURL}/ffmpeg-core.js`;
    const wasmURL = `${baseURL}/ffmpeg-core.wasm`;

    await ffmpeg.load({ coreURL, wasmURL });

    const transcriber = await pipeline('automatic-speech-recognition', model);

    const videoData = await fetchFile(audio);
    const inputFileName = 'input.video';
    const outputFileName = 'output.wav';

    await ffmpeg.writeFile(inputFileName, videoData);
    await ffmpeg.exec(['-i', inputFileName, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputFileName]);

    const audioData = await ffmpeg.readFile(outputFileName);
    const pcmData = new Int16Array(audioData.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
    }

    const output = await transcriber(floatData, { language, task });

    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return output.text;
  } catch (error) {
    console.error('Error during transcription:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { audioUrl, model = 'Xenova/whisper-tiny', language = 'portuguese', task = 'transcribe' } = req.body;

  if (!audioUrl) {
    return res.status(400).json({ success: false, error: 'audioUrl is required' });
  }

  try {
    const transcription = await transcribe(audioUrl, model, language, task);
    return res.status(200).json({ success: true, transcription });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to transcribe audio' });
  }
}
