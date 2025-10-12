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

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Missing required field: email' });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    const client = await pool.connect();
    const result = await client.query(
      'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3 RETURNING id',
      [otp, otpExpiresAt, email]
    );
    client.release();

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // In a real application, you would send the OTP via email here.
    // For now, we are just logging it to the console.
    console.log(`OTP for ${email}: ${otp}`);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}