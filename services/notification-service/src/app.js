import express from 'express';
import cors from 'cors';
import notificationRoutes from './routes/notification.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

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
