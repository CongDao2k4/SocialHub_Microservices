import { redisClient } from '../config/redis.js';

/**
 * Register WebRTC Call Signaling Socket.IO event handlers
 * @param {import('socket.io').Server} io 
 * @param {import('socket.io').Socket} socket 
 */
export default (io, socket) => {
  const currentUserId = socket.userId;

  // 1. Initiating a Call
  socket.on('call:initiate', async (payload) => {
    try {
      const { targetUserId, callerName, callerAvatar, callType = 'video' } = payload;

      if (!targetUserId) {
        return socket.emit('error', { message: 'targetUserId is required' });
      }

      console.log(`📞 [CALL] User ${currentUserId} (${socket.displayName}) initiating ${callType} call to ${targetUserId}`);

      // Check if target user has active sockets in the personal room across the cluster
      const targetSockets = await io.in(`user:${targetUserId}`).fetchSockets();
      const isOnline = targetSockets.length > 0;

      if (!isOnline) {
        console.log(`⚠️ [CALL] Target user ${targetUserId} is offline (Active Sockets = 0)`);
        return socket.emit('call:rejected', {
          calleeId: targetUserId,
          reason: 'offline'
        });
      }

      // Forward call:incoming to target user's personal socket room
      io.to(`user:${targetUserId}`).emit('call:incoming', {
        callerId: currentUserId,
        callerName: callerName || socket.displayName,
        callerAvatar: callerAvatar || socket.avatarUrl,
        callType
      });

    } catch (error) {
      console.error('❌ Error handling call:initiate:', error.message);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  // 2. Accept Call
  socket.on('call:accept', (payload) => {
    try {
      const { callerId, calleeName, calleeAvatar } = payload;
      console.log(`📞 [CALL] User ${currentUserId} accepted call from ${callerId}`);

      io.to(`user:${callerId}`).emit('call:accepted', {
        calleeId: currentUserId,
        calleeName: calleeName || socket.displayName,
        calleeAvatar: calleeAvatar || socket.avatarUrl
      });
    } catch (error) {
      console.error('❌ Error handling call:accept:', error.message);
    }
  });

  // 3. Reject Call
  socket.on('call:reject', (payload) => {
    try {
      const { callerId, reason = 'rejected' } = payload;
      console.log(`📞 [CALL] User ${currentUserId} rejected call from ${callerId}, reason=${reason}`);

      io.to(`user:${callerId}`).emit('call:rejected', {
        calleeId: currentUserId,
        reason
      });
    } catch (error) {
      console.error('❌ Error handling call:reject:', error.message);
    }
  });

  // 4. End Call
  socket.on('call:end', (payload) => {
    try {
      const { targetUserId } = payload;
      console.log(`📞 [CALL] User ${currentUserId} ended call with ${targetUserId}`);

      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:ended', {
          userId: currentUserId
        });
      }
    } catch (error) {
      console.error('❌ Error handling call:end:', error.message);
    }
  });

  // 5. WebRTC Signaling: Forward SDP Offer
  socket.on('webrtc:offer', (payload) => {
    try {
      const { targetUserId, sdp } = payload;
      if (!targetUserId || !sdp) return;

      io.to(`user:${targetUserId}`).emit('webrtc:offer', {
        senderId: currentUserId,
        sdp
      });
    } catch (error) {
      console.error('❌ Error handling webrtc:offer:', error.message);
    }
  });

  // 6. WebRTC Signaling: Forward SDP Answer
  socket.on('webrtc:answer', (payload) => {
    try {
      const { targetUserId, sdp } = payload;
      if (!targetUserId || !sdp) return;

      io.to(`user:${targetUserId}`).emit('webrtc:answer', {
        senderId: currentUserId,
        sdp
      });
    } catch (error) {
      console.error('❌ Error handling webrtc:answer:', error.message);
    }
  });

  // 7. WebRTC Signaling: Forward ICE Candidate
  socket.on('webrtc:ice-candidate', (payload) => {
    try {
      const { targetUserId, candidate } = payload;
      if (!targetUserId || !candidate) return;

      io.to(`user:${targetUserId}`).emit('webrtc:ice-candidate', {
        senderId: currentUserId,
        candidate
      });
    } catch (error) {
      console.error('❌ Error handling webrtc:ice-candidate:', error.message);
    }
  });
};
