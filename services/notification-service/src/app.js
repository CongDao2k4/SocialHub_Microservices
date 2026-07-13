import express from 'express';
import cors from 'cors';
import notificationRoutes from './routes/notification.routes.js';

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

// Public health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'notification-service',
    timestamp: new Date().toISOString()
  });
});

// Register notification routes under /notifications
app.use('/', notificationRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error in Notification Service:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in Notification Service'
  });
});

export default app;
