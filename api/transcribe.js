// api/transcribe.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Adicionar headers CORS se necessário
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    console.log('Received audio file:', audioFile.originalFilename);

    // Ler arquivo
    const audioBuffer = await fs.readFile(audioFile.filepath);

    // Usar Gemini para transcrição
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: audioFile.mimetype || 'audio/wav'
        }
      },
      'Transcreva este áudio em português, mantendo pontuação adequada.'
    ]);

    const transcription = result.response.text();

    // Limpar arquivo temporário
    await fs.unlink(audioFile.filepath).catch(console.error);

    return res.status(200).json({
      success: true,
      transcription
    });

  } catch (error) {
    console.error('Transcription API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
