// Extract token from 'Authorization: Bearer <token>' header
// Verify JWT using jsonwebtoken
// Query user from database by decoded id
// Exclude password from user object
// Attach user to req.user
// Call next() on success
// Return 401 for missing/invalid token
// Return 404 if user not found

const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) return secret;
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    return 'dev-insecure-jwt-secret-change-me';
  }
  throw new Error('JWT_SECRET is required in production');
};

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const users = await query('SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?', [decoded.id]);
    const user = users[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};