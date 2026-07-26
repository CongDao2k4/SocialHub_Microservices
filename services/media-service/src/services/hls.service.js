import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { minioService } from './minio.service.js';
import { Media } from '../models/media.model.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const processingMediaIds = new Set();

export const hlsService = {
  isProcessing: (mediaId) => processingMediaIds.has(mediaId),

  processVideoToHLS: async (mediaId, fileBuffer, userId, originalExt = 'mp4') => {
    if (processingMediaIds.has(mediaId)) {
      throw new Error(`HLS is already processing for mediaId=${mediaId}`);
    }

    processingMediaIds.add(mediaId);

    const tempDir = path.join(os.tmpdir(), `hls_${mediaId}`);
    const inputPath = path.join(tempDir, `input.${originalExt}`);
    const outputPlaylist = path.join(tempDir, 'index.m3u8');

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(inputPath, fileBuffer);

      console.log(`[HLS] Starting transcode for mediaId=${mediaId}...`);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-c:v libx264',
            '-profile:v main',
            '-preset ultrafast',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-c:a aac',
            '-ac 2',
            '-ar 44100',
            '-b:a 128k',
            '-af aresample=async=1',
            '-force_key_frames expr:gte(t,n_forced*3)',
            '-hls_time 3',
            '-hls_playlist_type vod',
            '-hls_flags independent_segments',
            '-max_muxing_queue_size 1024',
            '-hls_segment_filename', path.join(tempDir, 'segment_%03d.ts')
          ])
          .output(outputPlaylist)
          .on('end', () => {
            console.log(`[HLS] Transcode completed for mediaId=${mediaId}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`[HLS] FFmpeg failed for mediaId=${mediaId}:`, err.message);
            reject(err);
          })
          .run();
      });

      const files = fs.readdirSync(tempDir);
      const masterKey = `${userId}/hls/${mediaId}/index.m3u8`;

      for (const fileName of files) {
        if (fileName === `input.${originalExt}`) continue;

        const filePath = path.join(tempDir, fileName);
        const fileContent = fs.readFileSync(filePath);
        const objectKey = `${userId}/hls/${mediaId}/${fileName}`;
        const mimeType = fileName.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/mp2t';

        await minioService.uploadFile(objectKey, fileContent, mimeType, fileContent.length);
      }

      await Media.findByIdAndUpdate(mediaId, {
        hlsReady: true,
        hlsMasterKey: masterKey
      });

      console.log(`[HLS] Uploaded playlist and segments for mediaId=${mediaId}`);

      return {
        hlsReady: true,
        hlsMasterKey: masterKey
      };
    } catch (error) {
      console.error(`[HLS] Processing failed for mediaId=${mediaId}:`, error.message);
      throw error;
    } finally {
      processingMediaIds.delete(mediaId);

      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanErr) {
        console.warn(`[HLS] Temp cleanup failed for mediaId=${mediaId}:`, cleanErr.message);
      }
    }
  }
};
