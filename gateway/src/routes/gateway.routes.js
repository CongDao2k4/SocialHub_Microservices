import express from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { httpClientService } from '../services/http-client.service.js';

const router = express.Router();

// user-service public routes
router.post('/auth/register', (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.post('/auth/login', (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.post('/auth/refresh', (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));

// user-service protected routes
router.post('/auth/logout', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.get('/users/search', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.get('/users/:id', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.put('/users/:id', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));

// media-service routes (Map /api/media/... -> /media/...)
const mapToMediaService = (req, res) => {
  const targetPath = req.originalUrl.replace(/^\/api/, '');
  return httpClientService.forwardToMediaService(req, res, targetPath);
};

router.post('/media/upload', protectRoute, mapToMediaService);
router.post('/media/batch-urls', protectRoute, mapToMediaService);
router.get('/media/:id', protectRoute, mapToMediaService);
router.get('/media/:id/url', protectRoute, mapToMediaService);
router.delete('/media/:id', protectRoute, mapToMediaService);

// --- post-service routes ---
const mapToPostService = (req, res) => {
  const targetPath = req.originalUrl.replace(/^\/api/, '');
  return httpClientService.forwardToPostService(req, res, targetPath);
};

// Map all under /posts and /feed to post-service
router.use('/posts', protectRoute, mapToPostService);
router.use('/feed', protectRoute, mapToPostService);

// --- friend-service routes ---
const mapToFriendService = (req, res) => {
  // friend-service routes expect /api/friends/... prefix, so we keep originalUrl
  return httpClientService.forwardToFriendService(req, res, req.originalUrl);
};
router.use('/friends', protectRoute, mapToFriendService);

// --- notification-service routes ---
const mapToNotificationService = (req, res) => {
  // notification-service routes expect /notifications/... prefix, so we strip /api
  const targetPath = req.originalUrl.replace(/^\/api/, '');
  return httpClientService.forwardToNotificationService(req, res, targetPath);
};
router.use('/notifications', protectRoute, mapToNotificationService);

export default router;
