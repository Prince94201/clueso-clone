// REGISTER:
//   - Validate email, password, name
//   - Check if email already exists
//   - Hash password with bcrypt (10 rounds)
//   - Generate UUID for user id
//   - Insert user into database
//   - Generate JWT token (7 days expiry)
//   - Return { token, user: { id, email, name } }
// LOGIN:
//   - Find user by email
//   - Compare password with bcrypt
//   - Generate JWT token
//   - Return { token, user }
// GET_ME:
//   - Return req.user (already attached by auth middleware)

const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) return secret;
  // Dev-only fallback to avoid hard crash.
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    return 'dev-insecure-jwt-secret-change-me';
  }
  throw new Error('JWT_SECRET is required in production');
};

const signToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRE || '7d' });

exports.validateRegister = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password >= 6 chars'),
  body('name').isLength({ min: 1 }).withMessage('Name required')
];

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.type = 'validation';
      err.details = errors.array();
      return next(err);
    }

    const { email, password, name } = req.body;
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await query('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [id, email, hash, name]);

    const token = signToken(id);
    res.status(201).json({ token, user: { id, email, name } });
  } catch (err) { next(err); }
};

exports.validateLogin = [
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
];

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.type = 'validation';
      err.details = errors.array();
      return next(err);
    }

    const { email, password } = req.body;
    const users = await query('SELECT id, email, password_hash, name FROM users WHERE email = ?', [email]); 
    const user = users[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};