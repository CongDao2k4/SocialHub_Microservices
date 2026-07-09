import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as NotificationController from '../controllers/notification.controller.js';

const router = express.Router();

// Apply auth middleware to all notification routes
router.use(requireAuth);

router.get('/notifications', NotificationController.getNotifications);
router.get('/notifications/unread-count', NotificationController.getUnreadCount);
router.put('/notifications/read-all', NotificationController.markAllNotificationsRead);
router.put('/notifications/:id/read', NotificationController.markNotificationRead);

export default router;
