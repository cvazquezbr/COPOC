import jwt from 'jsonwebtoken';
import cookie from 'cookie';

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

    // The user object is stored in the token.
    // In a more complex application, you might want to re-fetch user data from the database here.
    const user = {
      id: decoded.userId,
      name: decoded.name,
      email: decoded.email,
    };

    res.status(200).json(user);

  } catch (error) {
    console.error('Me endpoint error:', error);
    // If the token is invalid or expired, jwt.verify will throw an error
    res.status(401).json({ message: 'Not authenticated' });
  }
}