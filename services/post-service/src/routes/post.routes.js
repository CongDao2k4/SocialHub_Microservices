import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as PostController from '../controllers/post.controller.js';
import * as FeedController from '../controllers/feed.controller.js';
import * as LikeController from '../controllers/like.controller.js';
import * as CommentController from '../controllers/comment.controller.js';
import * as ShareController from '../controllers/share.controller.js';
import * as ReelController from '../controllers/reel.controller.js';

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'post-service', timestamp: new Date().toISOString() });
});

// All post routes require authentication
router.use(requireAuth);

// Posts
router.post('/posts', PostController.createPost);
router.get('/posts/:id', PostController.getPostById);
router.put('/posts/:id', PostController.updatePost);
router.delete('/posts/:id', PostController.deletePost);
router.get('/posts/user/:userId', PostController.getUserPosts);

// Feed
router.get('/feed', FeedController.getFeed);

// Likes
router.post('/posts/:id/like', LikeController.likePost);
router.delete('/posts/:id/like', LikeController.unlikePost);

// Comments
router.get('/posts/:id/comments', CommentController.getPostComments);
router.post('/posts/:id/comments', CommentController.createComment);
router.delete('/posts/:postId/comments/:commentId', CommentController.deleteComment);

// Share
router.post('/posts/:id/share', ShareController.sharePost);

export default router;
