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
      const { rows } = await query('SELECT gemini_api_key, gemini_model FROM users WHERE uuid = $1', [userId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json({
        gemini_api_key: rows[0].gemini_api_key || '',
        gemini_model: rows[0].gemini_model || 'gemini-pro',
      });
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { gemini_api_key, gemini_model } = await parseBody(req);

      const updateFields = [];
      const values = [];
      let queryIndex = 1;

      if (gemini_api_key !== undefined) {
        updateFields.push(`gemini_api_key = $${queryIndex++}`);
        values.push(gemini_api_key);
      }

      if (gemini_model !== undefined) {
        updateFields.push(`gemini_model = $${queryIndex++}`);
        values.push(gemini_model);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No settings provided to update' });
      }

      values.push(userId);
      const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE uuid = $${queryIndex}`;

      await query(sql, values);

      // After updating, fetch the updated settings to return to the client
      const { rows } = await query('SELECT gemini_api_key, gemini_model FROM users WHERE uuid = $1', [userId]);

      res.status(200).json({
        message: 'Settings updated successfully',
        settings: {
          gemini_api_key: rows[0].gemini_api_key || '',
          gemini_model: rows[0].gemini_model || 'gemini-pro',
        }
      });
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