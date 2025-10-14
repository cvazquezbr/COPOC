import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { query } from '../db.js'; // Import the database query function

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

    // Fetch the full, up-to-date user object from the database
    const result = await query(
      'SELECT id, uuid, name, email, gemini_api_key, gemini_model FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    res.status(200).json(user);

  } catch (error) {
    console.error('Me endpoint error:', error);
    // If the token is invalid or expired, jwt.verify will throw an error
    res.status(401).json({ message: 'Not authenticated' });
  }
}