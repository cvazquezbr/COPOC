import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // First, get the user's UUID from the users table.
    const userResult = await query('SELECT uuid FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userUuid = userResult.rows[0].uuid;

    // Now, fetch the briefings using the user's UUID.
    const { rows } = await query('SELECT * FROM briefings WHERE user_id = $1', [userUuid]);

    res.status(200).json(rows);

  } catch (error) {
    console.error('Briefings endpoint error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}