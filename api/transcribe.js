
import { GoogleGenerativeAI } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false, // Disable default body parser to use formidable
  },
};

export default async function handler(req, res) {
  console.log('API route /api/transcribe hit');

  if (req.method !== 'POST') {
    console.log('Method not allowed');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // 1. Check for API Key
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ success: false, error: 'Server configuration error: Missing API Key' });
  }

  try {
    // 2. Parse multipart/form-data
    console.log('Parsing form data...');
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);
    console.log('Form data parsed successfully.');

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      console.error('No audio file provided in the request');
      return res.status(400).json({ success: false, error: 'Nenhum arquivo de áudio fornecido' });
    }

    // 3. Read audio file from temporary path
    console.log(`Reading audio file from: ${audioFile.filepath}`);
    const audioBuffer = await fs.readFile(audioFile.filepath);
    console.log('Audio file read successfully.');

    // 4. Call Gemini API for transcription
    let transcription;
    try {
      console.log('Initializing Gemini AI and sending request...');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType: audioFile.mimetype || 'audio/mp3',
          }
        },
        'Transcreva o áudio em texto, mantendo pontuação e formatação adequadas.'
      ]);

      transcription = result.response.text();
      console.log('Transcription received from Gemini successfully.');

    } catch (geminiError) {
      console.error('Error calling Gemini API:', geminiError);
      // Clean up the temporary file even if Gemini fails
      await fs.unlink(audioFile.filepath).catch(e => console.error('Failed to cleanup temp file after Gemini error:', e));
      return res.status(500).json({ success: false, error: 'Failed to get transcription from AI service.' });
    }

    // 5. Clean up temporary file
    console.log(`Cleaning up temporary file: ${audioFile.filepath}`);
    await fs.unlink(audioFile.filepath);
    console.log('Temporary file cleaned up.');

    // 6. Return success response
    return res.status(200).json({
      success: true,
      transcription
    });

  } catch (error) {
    console.error('An unexpected error occurred in /api/transcribe:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred.'
    });
  }
}
