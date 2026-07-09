import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    path: '/socket.io/'
  });

  // JWT auth middleware for Socket.IO connection handshakes
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!token) {
        return next(new Error('Authentication error: Token is missing'));
      }

      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('❌ Socket authentication failed:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const roomName = `user:${userId}`;

    socket.join(roomName);
    console.log(`🔌 Client connected to Socket.IO. User: ${userId}. Socket ID: ${socket.id}. Joined room: ${roomName}`);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected. User: ${userId}. Socket ID: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Emit an event to a specific user's room.
 * @param {string} userId recipient user ID
 * @param {string} event event name
 * @param {any} payload event payload
 */
export const sendToUser = (userId, event, payload) => {
  if (!io) {
    console.warn('[WARN] Socket.IO server is not initialized yet. Cannot send event.');
    return;
  }
  const roomName = `user:${userId}`;
  io.to(roomName).emit(event, payload);
  console.log(`📡 Event "${event}" sent to room "${roomName}"`);
};
