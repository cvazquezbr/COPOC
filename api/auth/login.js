import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// IMPORTANT: Use a strong, securely stored secret for JWT signing in production.
const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const client = await pool.connect();
    const userResult = await client.query(
      'SELECT id, uuid, name, email, otp, otp_expires_at FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rowCount === 0) {
      client.release();
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const now = new Date();

    if (user.otp !== otp || (user.otp_expires_at && new Date(user.otp_expires_at) < now)) {
      client.release();
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid, clear it from the database
    await client.query(
      'UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );
    client.release();

    // Create JWT
    const token = jwt.sign(
      { sub: user.uuid, userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie
    const cookie = serialize('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);
    res.status(200).json({ id: user.id, name: user.name, email: user.email });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}