if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import http from 'http';
import mongoose from 'mongoose';
import amqp from 'amqplib';
import app from './app.js';
import { config } from './config/index.js';
import { initSocket } from './services/socket.service.js';
import { startConsumer } from './services/rabbitmq.consumer.js';
import { startEventBridge } from './services/event-bridge.service.js';

let httpServer = null;
let rabbitConnection = null;

const startServer = async () => {
  try {
    console.log('🚀 Starting Notification Service...');

    // 1. Connect to MongoDB
    await mongoose.connect(config.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully!');

    // 2. Setup HTTP and Socket.IO server
    httpServer = http.createServer(app);
    initSocket(httpServer);
    console.log('✅ Socket.IO server initialized.');

    // 3. Setup RabbitMQ Connection and Channel
    let retries = 5;
    while (retries) {
      try {
        console.log('🔌 Connecting to RabbitMQ...');
        rabbitConnection = await amqp.connect(config.RABBITMQ_URL);
        break;
      } catch (err) {
        console.error(`❌ Failed to connect to RabbitMQ, retrying in 5 seconds... (${retries} left)`);
        retries -= 1;
        if (retries === 0) throw err;
        await new Promise(res => setTimeout(res, 5000));
      }
    }
    const rabbitChannel = await rabbitConnection.createChannel();
    console.log('✅ Connected to RabbitMQ successfully!');

    // 4. Start Event Bridge (Redis Pub/Sub -> RabbitMQ Bridge)
    console.log('⚡ Starting Redis-to-RabbitMQ Event Bridge...');
    await startEventBridge(rabbitChannel);

    // 5. Start RabbitMQ Consumer
    console.log('⚡ Starting RabbitMQ consumer worker...');
    await startConsumer();

    // 6. Listen on Port
    httpServer.listen(config.PORT, () => {
      console.log(`🚀 Notification Service running on port ${config.PORT}`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n[INFO] ${signal} received. Shutting down gracefully...`);
      
      if (httpServer) {
        httpServer.close(() => {
          console.log('[INFO] HTTP server closed.');
        });
      }

      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close();
          console.log('[INFO] MongoDB connection closed.');
        }

        if (rabbitConnection) {
          await rabbitConnection.close();
          console.log('[INFO] RabbitMQ connection closed.');
        }

        process.exit(0);
      } catch (err) {
        console.error('[ERROR] Error during graceful shutdown:', err.message);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start Notification Service:', err);
    process.exit(1);
  }
};

startServer();
