import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import gatewayRoutes from './routes/gateway.routes.js';
import swaggerRoutes from './routes/swagger.routes.js';
import { rateLimiter } from './middlewares/rate-limiter.middleware.js';

const app = express();

// Disable ETag generation to prevent 304 Not Modified responses
app.set('etag', false);

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());

// Global Cache-Control disabling middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gateway',
    timestamp: new Date().toISOString()
  });
});

app.use('/api-docs', swaggerRoutes);
app.use('/api', rateLimiter(100, 60), gatewayRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found on Gateway`
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR] Global error in API Gateway:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in the API Gateway'
  });
});

export default app;
