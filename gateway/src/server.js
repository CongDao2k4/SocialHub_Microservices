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
      let targetServiceUrl = null;
      let targetPath = req.url;

      if (req.url && req.url.startsWith('/notification/socket.io/')) {
        targetServiceUrl = config.NOTIFICATION_SERVICE_URL;
        targetPath = req.url.replace(/^\/notification/, '');
      } else if (req.url && req.url.startsWith('/chat/socket.io/')) {
        targetServiceUrl = config.CHAT_SERVICE_URL;
        targetPath = req.url.replace(/^\/chat/, '');
      }

      if (targetServiceUrl) {
        try {
          const targetUrl = new URL(targetServiceUrl);
          const targetPort = targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80);
          const targetHost = targetUrl.hostname;

          const proxyReq = http.request({
            host: targetHost,
            port: targetPort,
            path: targetPath,
            method: req.method,
            headers: req.headers
          });

          proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
            // Handle socket errors to prevent app crashes on client/service disconnects (like ECONNRESET)
            socket.on('error', (err) => {
              console.error('[ERROR] WS Client socket error:', err.message);
              proxySocket.destroy();
            });
            proxySocket.on('error', (err) => {
              console.error('[ERROR] WS Proxy socket error:', err.message);
              socket.destroy();
            });

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
        } catch (err) {
          console.error('[ERROR] Failed to upgrade WS connection:', err.message);
          socket.end();
        }
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
