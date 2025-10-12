import { Pool } from 'pg';
import nodemailer from 'nodemailer';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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
      // The user does not exist. Return a 404 error.
      return res.status(404).json({ message: 'User not found' });
    }

    // Send the OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Your One-Time Password (OTP)',
      text: `Your OTP is: ${otp}`,
      html: `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`,
    });

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}