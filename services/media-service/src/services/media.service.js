import { v4 as uuidv4 } from 'uuid';
import { minioService } from './minio.service.js';
import { imageProcessingService } from './image-processing.service.js';
import { hlsService } from './hls.service.js';
import { Media } from '../models/media.model.js';
import { config } from '../config/index.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.js';

export const mediaService = {
  uploadMedia: async (file, userId, fileCategory) => {
    if (!file) throw new BadRequestError('No file uploaded');
    if (!userId) throw new ForbiddenError('Unauthorized: Missing x-user-id');

    const isVideo = fileCategory === 'video';
    const maxSize = isVideo ? config.MAX_VIDEO_SIZE : config.MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / 1024 / 1024;
      throw new BadRequestError(`File too large. Max size for ${isVideo ? 'video' : 'image'}: ${maxMB}MB`);
    }

    const ext = file.originalname.split('.').pop();
    const baseId = uuidv4();
    let objectKey = `${userId}/${baseId}.${ext}`;
    const variants = new Map();
    let compressedSize = file.size;
    let outputFormat = null;

    if (fileCategory === 'image' && file.mimetype !== 'image/gif') {
      const processed = await imageProcessingService.processImage(file.buffer, file.mimetype);
      if (processed) {
        objectKey = `${userId}/${baseId}_original.webp`;
        const variantEntries = [
          { name: 'original', buffer: processed.original, key: objectKey },
          { name: 'medium',   buffer: processed.medium,   key: `${userId}/${baseId}_medium.webp` },
          { name: 'thumbnail',buffer: processed.thumbnail, key: `${userId}/${baseId}_thumbnail.webp` },
        ];
        for (const item of variantEntries) {
          await minioService.uploadFile(item.key, item.buffer, 'image/webp', item.buffer.length);
          variants.set(item.name, item.key);
        }
        compressedSize = processed.original.length + processed.medium.length + processed.thumbnail.length;
        outputFormat = 'webp';
      } else {
        await minioService.uploadFile(objectKey, file.buffer, file.mimetype, file.size);
      }
    } else {
      await minioService.uploadFile(objectKey, file.buffer, file.mimetype, file.size);
    }

    const media = await Media.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      objectKey: objectKey,
      uploadedBy: userId,
      compressedSize,
      compressionRatio: parseFloat((1 - compressedSize / file.size).toFixed(3)),
      format: outputFormat,
      variants,
    });

    if (isVideo) {
      // Kích hoạt tiến trình cắt HLS ngầm
      hlsService.processVideoToHLS(media._id.toString(), file.buffer, userId, ext).catch(err => {
        console.error(`❌ Background HLS transcode failed for ${media._id}:`, err.message);
      });
    }

    return {
      id: media._id.toString(),
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      uploadedBy: media.uploadedBy,
      createdAt: media.createdAt,
      hlsReady: media.hlsReady
    };
  },

  getMediaMetadata: async (id) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');
    return media;
  },

  getFileStream: async (id, variant = 'medium') => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    let targetKey = media.objectKey;
    let targetMimeType = media.mimeType;

    const getVariantKey = (vMap, key) => {
      if (!vMap) return null;
      if (typeof vMap.get === 'function') return vMap.get(key);
      return vMap[key] || null;
    };

    const variantKey = getVariantKey(media.variants, variant) 
      || getVariantKey(media.variants, 'medium') 
      || getVariantKey(media.variants, 'original');

    if (variantKey) {
      targetKey = variantKey;
      targetMimeType = 'image/webp';
    }

    // Lấy kích thước thực tế của file trong MinIO (không phải kích thước file gốc trước nén)
    let actualSize = null;
    try {
      const stat = await minioService.statFile(targetKey);
      actualSize = stat.size;
    } catch (e) {
      // Fallback: không set Content-Length nếu không lấy được stat
    }

    const stream = await minioService.getFileStream(targetKey);
    return {
      stream,
      mimeType: targetMimeType,
      size: actualSize
    };
  },

  getPresignedUrl: async (id) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    // Trả về relative URL để đi qua proxy API Gateway
    const url = `/media/file/${media._id}`;
    const expiresAt = new Date(Date.now() + config.PRESIGNED_URL_TTL * 1000);

    return {
      mediaId: media._id.toString(),
      url,
      expiresAt,
      ttlSeconds: config.PRESIGNED_URL_TTL
    };
  },

  deleteMedia: async (id, userId) => {
    if (!userId) throw new ForbiddenError('Unauthorized');

    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    if (media.uploadedBy !== userId) {
      throw new ForbiddenError('You can only delete your own media');
    }

    await minioService.deleteFile(media.objectKey);
    await Media.findByIdAndDelete(media._id);
  },

  getBatchUrls: async (mediaIds) => {
    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      throw new BadRequestError('mediaIds must be a non-empty array');
    }

    const urls = [];
    for (const id of mediaIds) {
      try {
        const media = await Media.findById(id);
        if (media) {
          const url = `/media/file/${media._id}`;
          urls.push({ mediaId: id, url, expiresAt: new Date(Date.now() + config.PRESIGNED_URL_TTL * 1000) });
        }
      } catch (e) {
        // Bỏ qua lỗi với từng ID đơn lẻ (ảnh bị xóa, v.v.)
      }
    }
    return urls;
  },
  
  checkHealth: async () => {
    await minioService.checkHealth();
  },

  getHlsMasterPlaylist: async (id) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    if (!media.hlsReady || !media.hlsMasterKey) {
      // Kích hoạt tự động tạo HLS ngầm cho video cũ chưa có HLS (nếu tiến trình chưa chạy)
      if (media.mimeType && media.mimeType.startsWith('video/') && !hlsService.isProcessing(media._id.toString())) {
        minioService.getFileStream(media.objectKey).then(async (stream) => {
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(chunks);
          const ext = media.originalName?.split('.').pop() || 'mp4';
          await hlsService.processVideoToHLS(media._id.toString(), fileBuffer, media.uploadedBy, ext);
        }).catch(err => {
          console.warn(`⚠️ Lỗi tạo HLS ngầm cho video cũ ${id}:`, err.message);
        });
      }
      throw new NotFoundError('HLS playlist not ready yet');
    }

    const stream = await minioService.getFileStream(media.hlsMasterKey);
    return {
      stream,
      mimeType: 'application/vnd.apple.mpegurl'
    };
  },

  getHlsSegment: async (id, segmentName) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    const segmentKey = `${media.uploadedBy}/hls/${id}/${segmentName}`;
    const stream = await minioService.getFileStream(segmentKey);
    return {
      stream,
      mimeType: 'video/mp2t'
    };
  }
};
