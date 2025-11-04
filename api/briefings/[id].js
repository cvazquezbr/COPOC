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
      const { name, briefing_data } = req.body;
      const { rows } = await query(
        'UPDATE briefings SET name = $1, briefing_data = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
        [name, JSON.stringify(briefing_data), id, userUuid]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Briefing not found or not owned by user.' });
      }
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { rows } = await query(
        'DELETE FROM briefings WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userUuid]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Briefing not found or not owned by user.' });
      }
      return res.status(200).json({ message: 'Briefing deleted successfully.' });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error(`API /briefings/${req.query.id} error:`, error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication error' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
