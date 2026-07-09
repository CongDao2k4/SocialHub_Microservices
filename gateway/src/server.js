import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import redis from './config/redis.js';

const startServer = async () => {
  try {
    // 1. Verify Redis connection is ready
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }

    // 2. Start Express server
    const server = app.listen(config.PORT, () => {
      console.log(`[INFO] API Gateway running in ${config.ENVIRONMENT} mode on port ${config.PORT}`);
      console.log(`[INFO] Routing user-service requests to: ${config.USER_SERVICE_URL}`);
      console.log(`[INFO] Routing media-service requests to: ${config.MEDIA_SERVICE_URL}`);
      console.log(`[INFO] Routing post-service requests to: ${config.POST_SERVICE_URL}`);
      console.log(`[INFO] Routing friend-service requests to: ${config.FRIEND_SERVICE_URL}`);
      console.log(`[INFO] Routing notification-service requests to: ${config.NOTIFICATION_SERVICE_URL}`);
    });

    // 3. Handle WebSocket upgrades for Socket.IO proxying
    server.on('upgrade', (req, socket, head) => {
      if (req.url.startsWith('/socket.io/')) {
        const targetUrl = new URL(config.NOTIFICATION_SERVICE_URL);
        const targetPort = targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80);
        const targetHost = targetUrl.hostname;

        const proxyReq = http.request({
          host: targetHost,
          port: targetPort,
          path: req.url,
          method: req.method,
          headers: req.headers
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
          socket.write('HTTP/1.1 101 Switching Protocols\r\n');
          Object.keys(proxyRes.headers).forEach((key) => {
            socket.write(`${key}: ${proxyRes.headers[key]}\r\n`);
          });
          socket.write('\r\n');

          proxySocket.pipe(socket).pipe(proxySocket);
        });

        proxyReq.on('error', (err) => {
          console.error('[ERROR] WS Proxy Upgrade Error:', err.message);
          socket.end();
        });

        proxyReq.end();
      } else {
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
