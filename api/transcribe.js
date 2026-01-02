
import { GoogleGenerativeAI } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false, // Desabilitar body parser padrão para usar formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart/form-data
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio fornecido' });
    }

    // Ler arquivo de áudio
    const audioBuffer = await fs.readFile(audioFile.filepath);

    // Usar Gemini para transcrição
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: audioFile.mimetype
        }
      },
      'Transcreva o áudio em texto, mantendo pontuação e formatação adequadas.'
    ]);

    const transcription = result.response.text();

    // Limpar arquivo temporário
    await fs.unlink(audioFile.filepath);

    return res.status(200).json({
      success: true,
      transcription
    });

  } catch (error) {
    console.error('Transcription API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
