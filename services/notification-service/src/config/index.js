import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 5006,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://socialhub:socialhub_secret@localhost:27017/socialhub?authSource=admin',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:5001',
  ENVIRONMENT: process.env.NODE_ENV || 'development'
};
