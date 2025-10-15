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
    // O 'sub' (subject) do JWT é o UUID do usuário, que corresponde a 'auth.users(id)'.
    const userUuid = decoded.sub;

    if (!userUuid) {
      return res.status(400).json({ message: 'Invalid token: User UUID not found.' });
    }

    // A busca extra na tabela 'users' foi removida pois era incorreta e desnecessária.

    if (req.method === 'GET') {
      const { rows } = await query('SELECT * FROM briefings WHERE user_id = $1', [userUuid]);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { nomeBriefing, briefing_data } = req.body;
      const name = nomeBriefing;

      const { rows } = await query(
        'INSERT INTO briefings (user_id, name, briefing_data) VALUES ($1, $2, $3) RETURNING *',
        [userUuid, name, JSON.stringify(briefing_data)]
      );
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('API /briefings error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication error' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}