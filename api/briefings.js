import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.auth_token;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  const userId = decoded.userId;


  if (req.method === 'GET') {
    try {
      // First, get the user's UUID from the users table.
      const userResult = await query('SELECT uuid FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      const userUuid = userResult.rows[0].uuid;

      // Now, fetch the briefings using the user's UUID.
      const { rows } = await query('SELECT * FROM briefings WHERE user_id = $1', [userUuid]);

      return res.status(200).json(rows);
    } catch (error) {
      console.error('GET /briefings error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }


  if (req.method === 'POST') {
    try {
      const userResult = await query('SELECT uuid FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      const userUuid = userResult.rows[0].uuid;

      const { name, company, project, details, final_text, creation_mode, base_text, template, model_used, revised_text } = req.body;

      const { rows } = await query(
        'INSERT INTO briefings (user_id, name, company, project, details, final_text, creation_mode, base_text, template, model_used, revised_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
        [userUuid, name, company, project, details, final_text, creation_mode, base_text, JSON.stringify(template), model_used, revised_text]
      );

      return res.status(201).json(rows[0]);
    } catch (error) {
      console.error('POST /briefings error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }


  // If method is not GET or POST
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}