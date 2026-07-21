import { mediaService } from '../services/media.service.js';

export const mediaController = {
  uploadMedia: async (req, res, next) => {
    try {
      const file = req.file;
      const userId = req.headers['x-user-id']; 
      const fileCategory = req.fileCategory;

      const mediaMetadata = await mediaService.uploadMedia(file, userId, fileCategory);
      res.status(201).json(mediaMetadata);
    } catch (err) {
      next(err);
    }
  },

  getMediaMetadata: async (req, res, next) => {
    try {
      const media = await mediaService.getMediaMetadata(req.params.id);
      res.json(media);
    } catch (err) {
      next(err);
    }
  },

  getPresignedUrl: async (req, res, next) => {
    try {
      const result = await mediaService.getPresignedUrl(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  streamMedia: async (req, res, next) => {
    try {
      const { id } = req.params;
      const variant = req.query.variant || 'medium';
      const { stream, mimeType, size } = await mediaService.getFileStream(id, variant);
      
      res.setHeader('Content-Type', mimeType);
      if (size) {
        res.setHeader('Content-Length', size);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', `"${id}-${variant}"`);
      
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  },

  deleteMedia: async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'];
      await mediaService.deleteMedia(req.params.id, userId);
      res.json({ message: 'Media deleted successfully' });
    } catch (err) {
      next(err);
    }
  },

  getBatchUrls: async (req, res, next) => {
    try {
      const { mediaIds } = req.body;
      const urls = await mediaService.getBatchUrls(mediaIds);
      res.json({ urls });
    } catch (err) {
      next(err);
    }
  },

  healthCheck: async (req, res, next) => {
    try {
      await mediaService.checkHealth();
      res.json({ status: 'ok', service: 'media-service' });
    } catch (err) {
      res.status(503).json({ status: 'error', message: 'MinIO unreachable' });
    }
  },

  getHlsMasterPlaylist: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { stream, mimeType } = await mediaService.getHlsMasterPlaylist(id);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'no-cache');
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  },

  getHlsSegment: async (req, res, next) => {
    try {
      const { id, segment } = req.params;
      const { stream, mimeType } = await mediaService.getHlsSegment(id, segment);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
};
