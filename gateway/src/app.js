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
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'ngrok-skip-browser-warning',
    'x-user-id',
    'x-requested-with'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false
}));

// Global Cache-Control disabling middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

if (process.env.ENVIRONMENT !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}

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
