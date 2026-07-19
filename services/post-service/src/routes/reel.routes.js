import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ReelController from '../controllers/reel.controller.js';

const router = express.Router();

// Tất cả các route của Reels yêu cầu xác thực
router.use(requireAuth);

router.post('/reels', ReelController.createReel);
router.get('/reels', ReelController.getReels);
router.get('/reels/user/:userId', ReelController.getUserReels);
router.post('/reels/:id/view', ReelController.incrementReelView);

// Thả tim Reels
router.post('/reels/:id/like', ReelController.likeReel);
router.delete('/reels/:id/like', ReelController.unlikeReel);

// Bình luận Reels
router.get('/reels/:id/comments', ReelController.getReelComments);
router.post('/reels/:id/comments', ReelController.createReelComment);

export default router;
