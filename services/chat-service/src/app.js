import express from 'express';
import cors from 'cors';
import conversationRoutes from './routes/conversation.routes.js';
import groupRoutes from './routes/group.routes.js';

const app = express();

// Disable ETag generation to prevent 304 responses
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

// GET /health - Required by .ai/AGENTS.md
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'chat-service',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/conversations', conversationRoutes);
app.use('/groups', groupRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFoundError',
    message: `Route ${req.method} ${req.originalUrl} not found on Chat Service`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error in Chat Service:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in Chat Service'
  });
});

export default app;
