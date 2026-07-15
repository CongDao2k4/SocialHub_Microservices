if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/db.js';
import postRoutes from './routes/post.routes.js';

const app = express();

// Disable ETag generation to prevent 304 Not Modified responses
app.set('etag', false);

app.use(cors());
app.use(express.json());

// Custom HTTP Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Cache Control Middleware to prevent client caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/', postRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error in Post Service:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in Post Service'
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Database then start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Post Service is running on port ${PORT}`);
  });
});
