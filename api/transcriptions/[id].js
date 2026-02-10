import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { query } from '../db.js';

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

    const { id } = req.query;

    if (req.method === 'PUT') {
      const { name, video_url, briefing_id, transcription_data } = req.body;
      const { rows } = await query(
        'UPDATE transcriptions SET name = $1, video_url = $2, briefing_id = $3, transcription_data = $4, updated_at = NOW() WHERE id = $5 AND user_id = $6 RETURNING *',
        [name, video_url, briefing_id || null, JSON.stringify(transcription_data), id, userUuid]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Transcription not found or not owned by user.' });
      }
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { rows } = await query(
        'DELETE FROM transcriptions WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userUuid]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Transcription not found or not owned by user.' });
      }
      return res.status(200).json({ message: 'Transcription deleted successfully.' });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error(`API /transcriptions/${req.query.id} error:`, error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication error' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
