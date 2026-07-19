import express from 'express';
import {protectRoute} from '../middlewares/auth.middleware.js';
import {httpClientService} from '../services/http-client.service.js';

const router = express.Router();

// user-service public routes
router.post('/auth/register', (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));
router.post('/auth/login', (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));
router.post('/auth/refresh', (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));

// user-service protected routes
router.post('/auth/logout', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));
router.get('/users/search', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));
router.get('/users/:id', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));
router.put('/users/:id', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.baseUrl + req.path));

// media-service routes (Map /api/media/... -> /media/...)
const mapToMediaService = (req, res) => {
  const targetPath = (req.baseUrl + req.path).replace(/^\/api/, '');
  return httpClientService.forwardToMediaService(req, res, targetPath);
};

router.post('/media/upload', protectRoute, mapToMediaService);
router.post('/media/batch-urls', protectRoute, mapToMediaService);
router.get('/media/file/:id', mapToMediaService); // Public streaming route
router.get('/media/:id', protectRoute, mapToMediaService);
router.get('/media/:id/url', protectRoute, mapToMediaService);
router.delete('/media/:id', protectRoute, mapToMediaService);

// --- post-service routes ---
const mapToPostService = (req, res) => {
  const targetPath = (req.baseUrl + req.path).replace(/^\/api/, '');
  return httpClientService.forwardToPostService(req, res, targetPath);
};

// Map all under /posts and /feed to post-service
router.use('/posts', protectRoute, mapToPostService);
router.use('/feed', protectRoute, mapToPostService);
router.use('/reels', protectRoute, mapToPostService);

// --- friend-service routes ---
const mapToFriendService = (req, res) => {
  // friend-service routes expect /api/friends/... prefix
  return httpClientService.forwardToFriendService(req, res, req.baseUrl + req.path);
};
router.use('/friends', protectRoute, mapToFriendService);

// --- notification-service routes ---
const mapToNotificationService = (req, res) => {
  const targetPath = (req.baseUrl + req.path).replace(/^\/api/, '');
  return httpClientService.forwardToNotificationService(req, res, targetPath);
};
router.use('/notifications', protectRoute, mapToNotificationService);
// --- chat-service routes ---
const mapToChatService = (req, res) => {
  const targetPath = (req.baseUrl + req.path).replace(/^\/api/, '');
  return httpClientService.forwardToChatService(req, res, targetPath);
};

// Map /conversations and /groups to chat-service
router.use('/conversations', protectRoute, mapToChatService);
router.use('/groups', protectRoute, mapToChatService);

export default router;
