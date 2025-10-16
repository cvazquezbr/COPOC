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
    const userUuid = decoded.sub; // Use the 'sub' claim for the user's UUID.

    if (!userUuid) {
      return res.status(401).json({ message: 'Invalid token: user UUID not found.' });
    }

    if (req.method === 'GET') {
      const { rows } = await query('SELECT * FROM briefing_templates WHERE user_id = $1', [userUuid]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Template not found' });
      }
      // Retornar o primeiro template encontrado, pois a relação é 1:1
      res.status(200).json(rows[0]);
    } else if (req.method === 'PUT') {
      const { template_data } = req.body;
      const { rows } = await query(
        `INSERT INTO briefing_templates (user_id, template_data)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET template_data = $2, updated_at = NOW()
         RETURNING *`,
        [userUuid, JSON.stringify(template_data)]
      );
      res.status(200).json(rows[0]);
    } else {
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Briefing template endpoint error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}