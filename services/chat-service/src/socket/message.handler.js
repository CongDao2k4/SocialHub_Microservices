import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import { fetchMediaUrl } from '../utils/api.js';
import { redisClient, redisPublisher } from '../config/redis.js';
import { randomUUID } from 'crypto';

/**
 * Register messaging-related Socket.IO event handlers
 */
export default (io, socket) => {
  // 1. Send Message
  socket.on('message:send', async (payload) => {
    try {
      const { conversationId, content, type = 'text', mediaId } = payload;
      const userId = socket.userId;

      console.log(`📡 [SOCKET] Event message:send from user=${userId} (${socket.displayName}) in conversation=${conversationId}, type=${type}, content="${content ? content.substring(0, 50) : ''}"`);

      if (!conversationId) {
        return socket.emit('error', { message: 'conversationId is required' });
      }
      if (!content && type === 'text') {
        return socket.emit('error', { message: 'Message content is required' });
      }

      // Verify conversation exists & membership
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return socket.emit('error', { message: 'Conversation not found' });
      }

      const isParticipant = conversation.participants.some(p => p.userId === userId);
      if (!isParticipant) {
        return socket.emit('error', { message: 'Not authorized to send messages in this conversation' });
      }

      // Fetch presigned URL if type is image and mediaId exists
      let mediaUrl = null;
      if (type === 'image' && mediaId) {
        mediaUrl = await fetchMediaUrl(mediaId, socket.token);
      }

      // Create message in DB
      const message = await Message.create({
        conversationId,
        senderId: userId,
        senderName: socket.displayName,
        senderAvatar: socket.avatarUrl,
        content: content || 'Sent an image',
        type,
        mediaId,
        mediaUrl,
        readBy: [{ userId, readAt: new Date() }] // Sender has automatically read it
      });

      // Update Conversation's lastMessage for list previews
      conversation.lastMessage = {
        content: type === 'image' ? 'Sent an image' : content.substring(0, 100),
        senderId: userId,
        senderName: socket.displayName,
        createdAt: message.createdAt
      };
      await conversation.save();

      // Emit new message event to the entire room (including sender)
      const messageJson = message.toJSON();
      io.to(`conv:${conversationId}`).emit('message:received', messageJson);

      // Check for offline participants and publish notification events (Disabled to prevent chat message popups)
      /*
      const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
      for (const participant of otherParticipants) {
        const isOnline = !!(await redisClient.get(`online:${participant.userId}`));
        if (!isOnline) {
          const event = {
            eventId: randomUUID(),
            senderId: userId,
            conversationId,
            recipientId: participant.userId,
            preview: type === 'image' ? 'Sent an image' : content.substring(0, 100),
            occurredAt: message.createdAt.toISOString()
          };
          // Publish message.sent to notify notification-service
          await redisPublisher.publish('message.sent', JSON.stringify(event));
        }
      }
      */

    } catch (error) {
      console.error('❌ Error handling message:send:', error.message);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // 2. Mark message as read
  socket.on('message:read', async (payload) => {
    try {
      const { conversationId, messageId } = payload;
      const userId = socket.userId;

      console.log(`📡 [SOCKET] Event message:read from user=${userId} in conversation=${conversationId}, messageId=${messageId}`);

      if (!conversationId || !messageId) {
        return socket.emit('error', { message: 'conversationId and messageId are required' });
      }

      // Find target message
      const readMessage = await Message.findById(messageId);
      if (!readMessage) {
        return socket.emit('error', { message: 'Message not found' });
      }

      const readAt = new Date();

      // Bulk update all messages in conversation sent before/on this message
      await Message.updateMany(
        {
          conversationId,
          createdAt: { $lte: readMessage.createdAt },
          'readBy.userId': { $ne: userId }
        },
        {
          $push: { readBy: { userId, readAt } }
        }
      );

      // Broadcast read receipt to room
      io.to(`conv:${conversationId}`).emit('message:read:ack', {
        conversationId,
        messageId,
        readBy: userId,
        readAt: readAt.toISOString()
      });

    } catch (error) {
      console.error('❌ Error handling message:read:', error.message);
      socket.emit('error', { message: 'Failed to mark message as read' });
    }
  });

  // 3. Join conversation room manually
  socket.on('conversation:join', ({ conversationId }) => {
    if (!conversationId) return;
    const roomId = `conv:${conversationId}`;
    socket.join(roomId);
    console.log(`🔌 [SOCKET] Join Room: id=${socket.id}, user=${socket.userId} joined conversation room: ${roomId}`);
  });
};
