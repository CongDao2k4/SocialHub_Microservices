if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import 'dotenv/config';

import app from './app.js';
import { config } from './config/index.js';
import { minioService } from './services/minio.service.js';
import { connectDB } from './config/db.js';

const startServer = async () => {
  try {
    // 1. Kết nối MongoDB
    await connectDB();

    // 2. Kết nối & Khởi tạo bucket MinIO
    await minioService.initializeMinIO();
    console.log('MinIO initialized successfully');

    // 3. Khởi động Express Server
    const server = app.listen(config.PORT, () => {
      console.log(`media-service running on port ${config.PORT}`);
    });

    // Xử lý khi tắt server (Graceful Shutdown)
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
