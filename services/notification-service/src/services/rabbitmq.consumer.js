import amqp from 'amqplib';
import axios from 'axios';
import { config } from '../config/index.js';
import { Notification } from '../models/notification.model.js';
import { sendToUser } from './socket.service.js';

let channel = null;
let connection = null;

// Helper to fetch user details from user-service
async function getUserDetails(userId) {
  try {
    const response = await axios.post(`${config.USER_SERVICE_URL}/api/users/batch`, {
      userIds: [userId]
    });
    if (response.data?.success && response.data.users?.length > 0) {
      return response.data.users[0];
    }
  } catch (err) {
    console.error(`❌ Failed to fetch user details for ID: ${userId}. Error:`, err.message);
  }
  return { id: userId, displayName: 'Thành viên SocialHub', avatarUrl: null };
}

// Helper to count unread notifications and push count update
async function pushUnreadCount(userId) {
  try {
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    sendToUser(userId, 'notification:count', { unreadCount });
  } catch (err) {
    console.error('❌ Error counting unread notifications:', err.message);
  }
}

export const startConsumer = async () => {
  try {
    connection = await amqp.connect(config.RABBITMQ_URL);
    channel = await connection.createChannel();

    const queueName = 'notifications-queue';
    await channel.assertQueue(queueName, { durable: true });

    console.log(`⚡ RabbitMQ Consumer started successfully. Monitoring queue: "${queueName}"`);

    channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const envelope = JSON.parse(msg.content.toString());
        const { channel: eventChannel, payload } = envelope;

        console.log(`📥 [RabbitMQ Consumer] Processing event from channel "${eventChannel}":`, payload);

        let notificationData = null;
        let recipientId = null;
        let actorId = null;

        switch (eventChannel) {
          case 'friend.request.sent': {
            const { fromUserId, toUserId, requestId } = payload;
            recipientId = toUserId;
            actorId = fromUserId;

            const actor = await getUserDetails(actorId);
            notificationData = {
              userId: recipientId,
              type: 'friend_request',
              message: `${actor.displayName} đã gửi lời mời kết bạn.`,
              fromUser: {
                id: actor.id,
                displayName: actor.displayName,
                avatarUrl: actor.avatarUrl
              },
              referenceId: requestId,
              referenceType: 'friend_request'
            };
            break;
          }

          case 'friend.request.accepted': {
            const { fromUserId, toUserId } = payload; // fromUserId: original sender (recipient of notification), toUserId: user who accepted
            recipientId = fromUserId;
            actorId = toUserId;

            const actor = await getUserDetails(actorId);
            notificationData = {
              userId: recipientId,
              type: 'friend_accepted',
              message: `${actor.displayName} đã chấp nhận lời mời kết bạn.`,
              fromUser: {
                id: actor.id,
                displayName: actor.displayName,
                avatarUrl: actor.avatarUrl
              },
              referenceId: null,
              referenceType: null
            };
            break;
          }

          case 'post.liked': {
            const { userId, postId, postAuthorId } = payload;
            if (userId === postAuthorId) {
              // Skip self-like notification
              channel.ack(msg);
              return;
            }
            recipientId = postAuthorId;
            actorId = userId;

            const actor = await getUserDetails(actorId);
            notificationData = {
              userId: recipientId,
              type: 'post_liked',
              message: `${actor.displayName} đã thích bài viết của bạn.`,
              fromUser: {
                id: actor.id,
                displayName: actor.displayName,
                avatarUrl: actor.avatarUrl
              },
              referenceId: postId,
              referenceType: 'post'
            };
            break;
          }

          case 'post.commented': {
            const { userId, postId, postAuthorId, commentId } = payload;
            if (userId === postAuthorId) {
              // Skip self-comment notification
              channel.ack(msg);
              return;
            }
            recipientId = postAuthorId;
            actorId = userId;

            const actor = await getUserDetails(actorId);
            notificationData = {
              userId: recipientId,
              type: 'post_commented',
              message: `${actor.displayName} đã bình luận bài viết của bạn.`,
              fromUser: {
                id: actor.id,
                displayName: actor.displayName,
                avatarUrl: actor.avatarUrl
              },
              referenceId: postId,
              referenceType: 'post'
            };
            break;
          }

          case 'post.shared': {
            const { userId, postId, postAuthorId } = payload;
            if (userId === postAuthorId) {
              // Skip self-share notification
              channel.ack(msg);
              return;
            }
            recipientId = postAuthorId;
            actorId = userId;

            const actor = await getUserDetails(actorId);
            notificationData = {
              userId: recipientId,
              type: 'post_shared',
              message: `${actor.displayName} đã chia sẻ bài viết của bạn.`,
              fromUser: {
                id: actor.id,
                displayName: actor.displayName,
                avatarUrl: actor.avatarUrl
              },
              referenceId: postId,
              referenceType: 'post'
            };
            break;
          }

          default:
            console.warn(`[WARN] Unrecognized event channel: ${eventChannel}`);
            channel.ack(msg);
            return;
        }

        if (notificationData && recipientId) {
          // 1. Save notification to MongoDB
          const notification = new Notification(notificationData);
          await notification.save();
          console.log(`💾 Saved notification to MongoDB. Recipient: ${recipientId}, ID: ${notification._id}`);

          // Convert to object for sending
          const socketPayload = {
            id: notification._id.toString(),
            type: notification.type,
            message: notification.message,
            fromUser: notification.fromUser,
            referenceId: notification.referenceId,
            referenceType: notification.referenceType,
            isRead: notification.isRead,
            createdAt: notification.createdAt.toISOString()
          };

          // 2. Push event via Socket.IO
          sendToUser(recipientId, 'notification:new', socketPayload);

          // 3. Update unread count for recipient
          await pushUnreadCount(recipientId);
        }

        channel.ack(msg);
      } catch (err) {
        console.error('❌ Error processing RabbitMQ message:', err.message);
        // Requeue the message in development/prod if it fails due to network/db issues
        channel.nack(msg, false, true);
      }
    });

    return channel;
  } catch (err) {
    console.error('❌ Failed to start RabbitMQ consumer:', err.message);
    throw err;
  }
};

export const getChannel = () => channel;
