// Log error to console
// If multer error, return appropriate message
// If validation error, return 400 with details
// If JWT error, return 401
// Default 500 for unexpected errors
// Don't expose stack traces in production

const multer = require('multer');

module.exports = function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  // OpenAI / upstream rate limit or quota
  const upstreamStatus = err?.status || err?.response?.status;
  if (upstreamStatus === 429) {
    return res.status(429).json({
      error: 'AI quota exceeded',
      details: 'Your AI provider quota/credits are exhausted. Add credits or configure a different provider.',
    });
  }

  // Multer errors
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message });
  }

  // Validation errors (express-validator)
  if (err.type === 'validation') {
    return res.status(400).json({ error: 'Validation failed', details: err.details || [] });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const status = err.status || 500;
  const payload = { error: err.publicMessage || 'Internal Server Error' };
  if (process.env.NODE_ENV === 'development') {
    payload.details = err.message;
  }
  res.status(status).json(payload);
};