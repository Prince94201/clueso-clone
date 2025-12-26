// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const { ApolloServer } = require('apollo-server-express');
const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) return secret;
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    return 'dev-insecure-jwt-secret-change-me';
  }
  throw new Error('JWT_SECRET is required in production');
};

const { pool } = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');
const typeDefs = require('./src/graphql/typeDefs');
const resolvers = require('./src/graphql/resolvers');

// Routes
const authRoutes = require('./src/routes/auth');
const videoRoutes = require('./src/routes/videos');
const aiRoutes = require('../ai/routes');
const shareRoutes = require('./src/routes/share');
const videoShareRoutes = require('./src/routes/videos.share');

const app = express();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_PATH || './uploads')));
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/videos', videoShareRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Trigger nodemon restart

// Test DB connection and setup Apollo GraphQL
(async () => {
  try {
    const [rows] = await pool.query('SELECT 1');
    if (rows) {
      console.log('Database connection successful');
    }

    // Setup Apollo GraphQL
    const apollo = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');
        if (scheme === 'Bearer' && token) {
          try {
            const decoded = jwt.verify(token, getJwtSecret());
            return { user: { id: decoded.id } };
          } catch (e) { /* ignore */ }
        }
        return {};
      },
    });
    await apollo.start();
    apollo.applyMiddleware({ app, path: '/graphql' });

  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});