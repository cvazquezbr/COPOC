import fetch from 'node-fetch';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { action, apiKey, model, prompt } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  let url;
  let options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  switch (action) {
    case 'listModels':
      url = `${GEMINI_API_BASE_URL}/models?key=${apiKey}`;
      break;

    case 'generateContent':
      if (!prompt || !model) {
        return res.status(400).json({ error: 'Prompt and model are required for generateContent' });
      }
      url = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;
      options.method = 'POST';
      options.body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      });
      break;

    default:
      return res.status(400).json({ error: 'Invalid action specified' });
  }

  try {
    const apiResponse = await fetch(url, options);
    const responseText = await apiResponse.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Gemini API returned non-JSON response:', responseText);
      return res.status(500).json({ error: 'Failed to parse Gemini API response', details: responseText });
    }

    if (!apiResponse.ok) {
        console.error('Gemini API Error:', data);
        const errorMessage = data.error?.message || `Error ${apiResponse.status}`;
        return res.status(apiResponse.status).json({ error: errorMessage });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying request to Gemini API:', error);
    return res.status(500).json({ error: 'Failed to communicate with Gemini API' });
  }
}