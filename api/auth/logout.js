import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // To log out, we instruct the browser to clear the auth_token cookie.
  // This is done by setting the cookie with an empty value and an expiration date in the past.
  const cookie = serialize('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: -1, // A value of -1 or 0 tells the browser to expire the cookie immediately.
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ message: 'Logout successful' });
}
