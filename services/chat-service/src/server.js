if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import http from 'http';
import app from './app.js';
import config from './config/index.js';
import { connectDB } from './config/db.js';
import { initSocketServer } from './socket/index.js';

const server = http.createServer(app);

// Initialize Socket.IO Server on the HTTP Server instance
initSocketServer(server);

// Graceful Shutdown Handler
const shutdown = (signal) => {
  console.log(`\n📥 ${signal} received. Shutting down Chat Service gracefully...`);
  
  server.close(async () => {
    console.log('🚪 HTTP server closed.');
    try {
      const mongoose = await import('mongoose');
      await mongoose.default.disconnect();
      console.log('🔌 MongoDB connection closed.');
      
      const { redisClient, redisPublisher } = await import('./config/redis.js');
      await redisClient.quit();
      await redisPublisher.quit();
      console.log('🔌 Redis connections closed.');
      
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during graceful shutdown:', err.message);
      process.exit(1);
    }
  });
  
  // Force shutdown if connections hang
  setTimeout(() => {
    console.error('⚠️ Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Establish Database Connection first, then listen on PORT
connectDB().then(() => {
  server.listen(config.PORT, () => {
    console.log(`🚀 Chat Service is running on port ${config.PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to start Chat Service database connection:', err.message);
  process.exit(1);
});
