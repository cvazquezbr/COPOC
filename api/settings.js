import { withAuth } from '../middleware/auth.js';
import { query } from '../db.js';

const parseBody = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += new TextDecoder().decode(chunk);
  }
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const settingsHandler = async (req, res) => {
  const userId = req.user.sub;

  if (req.method === 'GET') {
    try {
      const { rows } = await query('SELECT gemini_api_key FROM users WHERE id = $1', [userId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json({ gemini_api_key: rows[0].gemini_api_key || '' });
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { gemini_api_key } = await parseBody(req);
      await query('UPDATE users SET gemini_api_key = $1 WHERE id = $2', [gemini_api_key, userId]);
      res.status(200).json({ message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};

export default withAuth(settingsHandler);