if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import redis from './config/redis.js';
import httpProxy from 'http-proxy';

// Create a WebSocket proxy server targeting the chat-service URL
const wsProxy = httpProxy.createProxyServer({
  target: config.CHAT_SERVICE_URL,
  ws: true
});

wsProxy.on('error', (err) => {
  console.error('[ERROR] Gateway WS Proxy Error:', err.message);
});

const startServer = async () => {
  try {
    // Verify Redis connection is ready
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }

    // Start Express server
    const server = app.listen(config.PORT, () => {
      console.log(`[INFO] API Gateway running in ${config.ENVIRONMENT} mode on port ${config.PORT}`);
      console.log(`[INFO] Routing user-service requests to: ${config.USER_SERVICE_URL}`);
      console.log(`[INFO] Routing media-service requests to: ${config.MEDIA_SERVICE_URL}`);
      console.log(`[INFO] Routing post-service requests to: ${config.POST_SERVICE_URL}`);
      console.log(`[INFO] Routing friend-service requests to: ${config.FRIEND_SERVICE_URL}`);
      console.log(`[INFO] Routing notification-service requests to: ${config.NOTIFICATION_SERVICE_URL}`);
    });

    // Handle WebSocket upgrades for Socket.IO proxying
    server.on('upgrade', (req, socket, head) => {
      if (req.url && req.url.startsWith('/notification/socket.io/')) {
        req.url = req.url.replace(/^\/notification/, '');
        wsProxy.ws(req, socket, head, { target: config.NOTIFICATION_SERVICE_URL });
      } else if (req.url && req.url.startsWith('/chat/socket.io/')) {
        req.url = req.url.replace(/^\/chat/, '');
        wsProxy.ws(req, socket, head, { target: config.CHAT_SERVICE_URL });
      } else {
        console.warn(`[WARN] WS Upgrade request received for unsupported path: ${req.url}`);
        socket.end();
      }
    });

    // Graceful Shutdown
    const shutdown = (signal) => {
      console.log(`\n[INFO] ${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        console.log('[INFO] HTTP server closed.');
        try {
          await redis.quit();
          console.log('[INFO] Redis client disconnected.');
          process.exit(0);
        } catch (err) {
          console.error('[ERROR] Error disconnecting Redis during shutdown:', err.message);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('[WARN] Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('[ERROR] Failed to start API Gateway:', error);
    process.exit(1);
  }
};

startServer();
