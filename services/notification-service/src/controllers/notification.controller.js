import { Notification } from '../models/notification.model.js';
import { sendToUser } from '../services/socket.service.js';

// Helper to push unread count updates via socket
async function pushUnreadCount(userId) {
  try {
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    sendToUser(userId, 'notification:count', { unreadCount });
  } catch (err) {
    console.error('❌ Error pushing unread count:', err.message);
  }
}

export const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const unreadOnly = req.query.unreadOnly === 'true';

  try {
    const filter = { userId };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const skip = (page - 1) * limit;
    
    // Run count and find in parallel
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: notifications.map(n => ({
        id: n._id.toString(),
        type: n.type,
        message: n.message,
        fromUser: n.fromUser,
        referenceId: n.referenceId,
        referenceType: n.referenceType,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('❌ Error getting notifications:', err.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve notifications'
    });
  }
};

export const getUnreadCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (err) {
    console.error('❌ Error getting unread count:', err.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve unread notification count'
    });
  }
};

export const markNotificationRead = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'NotFoundError',
        message: 'Notification not found'
      });
    }

    // Push updated unread count to Socket client
    await pushUnreadCount(userId);

    return res.status(200).json({
      success: true,
      data: {
        id: notification._id.toString(),
        isRead: notification.isRead
      }
    });
  } catch (err) {
    console.error('❌ Error marking notification read:', err.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to mark notification as read'
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    // Push updated unread count (will be 0)
    await pushUnreadCount(userId);

    return res.status(200).json({
      success: true,
      updatedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('❌ Error marking all read:', err.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to mark all notifications as read'
    });
  }
};
