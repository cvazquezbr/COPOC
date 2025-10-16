const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';
const user = { userId: '1' }; // Use userId and a valid-looking ID

const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
console.log(token);