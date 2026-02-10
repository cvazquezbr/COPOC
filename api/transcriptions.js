import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';

export default async function handler(req, res) {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userUuid = decoded.sub;

    if (!userUuid) {
      return res.status(400).json({ message: 'Invalid token: User UUID not found.' });
    }

    if (req.method === 'GET') {
      const { rows } = await query('SELECT * FROM transcriptions WHERE user_id = $1 ORDER BY created_at DESC', [userUuid]);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, video_url, briefing_id, transcription_data } = req.body;

      const { rows } = await query(
        'INSERT INTO transcriptions (user_id, name, video_url, briefing_id, transcription_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userUuid, name, video_url, briefing_id || null, JSON.stringify(transcription_data)]
      );
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('API /transcriptions error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication error' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
