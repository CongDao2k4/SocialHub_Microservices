import Redis from 'ioredis';
import { config } from '../config/index.js';

let redisSub = null;

/**
 * Initializes and starts the Redis-to-RabbitMQ Event Bridge.
 * @param {any} rabbitChannel RabbitMQ channel instance
 */
export const startEventBridge = async (rabbitChannel) => {
  redisSub = new Redis(config.REDIS_URL);

  const channels = [
    'friend.request.sent',
    'friend.request.accepted',
    'post.liked',
    'post.commented',
    'post.shared'
  ];

  redisSub.on('connect', () => {
    console.log('⚡ Event Bridge connected to Redis successfully!');
  });

  redisSub.on('error', (err) => {
    console.error('❌ Redis Event Bridge error:', err.message);
  });

  try {
    await redisSub.subscribe(...channels);
    console.log(`✅ Event Bridge subscribed to Redis channels: ${channels.join(', ')}`);
  } catch (err) {
    console.error('❌ Event Bridge subscription error:', err.message);
    throw err;
  }

  // Handle messages from Redis and send them to RabbitMQ queue
  redisSub.on('message', async (channel, message) => {
    console.log(`📥 [Redis Event] Channel "${channel}":`, message);
    try {
      const payload = JSON.parse(message);
      
      const envelope = {
        channel,
        payload,
        bridgedAt: new Date().toISOString()
      };

      const queueName = 'notifications-queue';
      await rabbitChannel.assertQueue(queueName, { durable: true });
      
      rabbitChannel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(envelope)),
        { persistent: true }
      );
      
      console.log(`📤 [RabbitMQ Enqueued] Sent event to queue "${queueName}"`);
    } catch (err) {
      console.error('❌ Event Bridge parsing/forwarding error:', err.message);
    }
  });
};
