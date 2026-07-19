import { redisClient } from '../config/redis.js';
import Conversation from '../models/conversation.model.js';

/**
 * Handle actions when user connects and comes online
 */
export const handleUserOnline = async (io, socket) => {
  const { userId } = socket;

  // 1. Set presence key in Redis (TTL 5 minutes)
  await redisClient.setex(`online:${userId}`, 300, 'true');

  // 2. Join a personal room for single-recipient targeting
  socket.join(`user:${userId}`);

  // 3. Find all conversations containing this user
  const conversations = await Conversation.find({ 'participants.userId': userId });

  const initialOnlineMap = {};
  const otherParticipantIds = new Set();

  // 4. Join conversation rooms and notify existing members
  conversations.forEach(conv => {
    const roomId = `conv:${conv._id.toString()}`;
    socket.join(roomId);

    // Broadcast user:online to the room (excluding sender)
    socket.to(roomId).emit('user:online', { userId });

    conv.participants.forEach(p => {
      if (String(p.userId) !== String(userId)) {
        otherParticipantIds.add(p.userId);
      }
    });
  });

  // 5. Query current online status for all peers in user's conversations
  for (const otherId of otherParticipantIds) {
    const otherSockets = await io.in(`user:${otherId}`).fetchSockets();
    if (otherSockets.length > 0) {
      initialOnlineMap[otherId] = true;
    } else {
      const isRedisOnline = await redisClient.get(`online:${otherId}`);
      if (isRedisOnline) {
        initialOnlineMap[otherId] = true;
      }
    }
  }

  // 6. Send initial presence snapshot to the newly connected user
  socket.emit('presence:initial', { onlineUsers: initialOnlineMap });
  console.log(`🟢 User ${userId} (${socket.displayName}) is online. Sent ${Object.keys(initialOnlineMap).length} initial online peers.`);
};

/**
 * Handle actions when user disconnects and goes offline
 */
export const handleUserOffline = async (io, socket) => {
  const { userId } = socket;

  // Check if user still has remaining active sockets (e.g., other tabs or instant reconnect)
  const remainingSockets = await io.in(`user:${userId}`).fetchSockets();
  if (remainingSockets.length > 0) {
    console.log(`🟡 User ${userId} closed 1 socket but still has ${remainingSockets.length} active connection(s)`);
    return;
  }

  // Remove presence key from Redis
  await redisClient.del(`online:${userId}`);

  // Broadcast user:offline to all conversations
  const conversations = await Conversation.find({ 'participants.userId': userId });
  conversations.forEach(conv => {
    const roomId = `conv:${conv._id.toString()}`;
    socket.to(roomId).emit('user:offline', { userId });
  });

  console.log(`🔴 User ${userId} (${socket.displayName}) went offline (All sockets closed)`);
};

/**
 * Register presence heartbeat listener
 */
export default (io, socket) => {
  socket.on('presence:heartbeat', async () => {
    // Extend presence key TTL in Redis
    await redisClient.setex(`online:${socket.userId}`, 300, 'true');
  });
};
