import express from 'express';
import { mediaController } from '../controllers/media.controller.js';
import { uploadSingle } from '../middlewares/upload.middleware.js';
import { protectRoute } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/health', mediaController.healthCheck);
router.post('/media/upload', protectRoute, uploadSingle, mediaController.uploadMedia);
router.post('/media/batch-urls', protectRoute, mediaController.getBatchUrls); 
router.get('/media/file/:id', mediaController.streamMedia);
router.get('/media/hls/:id/index.m3u8', mediaController.getHlsMasterPlaylist);
router.get('/media/hls/:id/:segment', mediaController.getHlsSegment);
router.get('/media/:id', protectRoute, mediaController.getMediaMetadata);
router.get('/media/:id/url', protectRoute, mediaController.getPresignedUrl);
router.delete('/media/:id', protectRoute, mediaController.deleteMedia);

export default router;
