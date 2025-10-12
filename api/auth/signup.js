import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const client = await pool.connect();
    // The user is created without a password, assuming a passwordless/OTP flow.
    const result = await client.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
      [name, email]
    );
    client.release();
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') { // unique_violation
        return res.status(409).json({ message: 'User with this email already exists' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}