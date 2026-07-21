import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { minioService } from './minio.service.js';
import { Media } from '../models/media.model.js';

// Thiết lập đường dẫn tới binary FFmpeg được cài đặt qua npm
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const processingMediaIds = new Set();

export const hlsService = {
  isProcessing: (mediaId) => processingMediaIds.has(mediaId),

  /**
   * Xử lý chuyển đổi video bất kỳ thành định dạng HLS (.m3u8 + .ts segments)
   * và đẩy các phân đoạn lên MinIO private bucket ngầm.
   */
  processVideoToHLS: async (mediaId, fileBuffer, userId, originalExt = 'mp4') => {
    // Tránh xung đột trùng lặp nếu tiến trình HLS cho mediaId này đang chạy ngầm
    if (processingMediaIds.has(mediaId)) {
      console.log(`⏳ [HLS] Tiến trình HLS cho mediaId=${mediaId} đang chạy, bỏ qua request trùng.`);
      return;
    }

    processingMediaIds.add(mediaId);

    const tempDir = path.join(os.tmpdir(), `hls_${mediaId}`);
    const inputPath = path.join(tempDir, `input.${originalExt}`);
    const outputPlaylist = path.join(tempDir, 'index.m3u8');

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Ghi buffer video gốc ra tệp tạm trên ổ đĩa
      fs.writeFileSync(inputPath, fileBuffer);

      console.log(`🎬 [HLS] Bắt đầu cắt HLS cho mediaId=${mediaId}...`);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-c:v libx264',
            '-profile:v main',
            '-preset ultrafast',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-c:a aac',
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
            console.log(`✅ [HLS] Chuyển đổi HLS thành công cho mediaId=${mediaId}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`❌ [HLS] Lỗi FFmpeg cho mediaId=${mediaId}:`, err.message);
            reject(err);
          })
          .run();
      });

      // Quét toàn bộ tệp kết quả (.m3u8 và các file .ts) đẩy lên MinIO
      const files = fs.readdirSync(tempDir);
      const masterKey = `${userId}/hls/${mediaId}/index.m3u8`;

      for (const fileName of files) {
        if (fileName === `input.${originalExt}`) continue;

        const filePath = path.join(tempDir, fileName);
        const fileContent = fs.readFileSync(filePath);
        const objectKey = `${userId}/hls/${mediaId}/${fileName}`;
        
        let mimeType = 'video/mp2t';
        if (fileName.endsWith('.m3u8')) {
          mimeType = 'application/vnd.apple.mpegurl';
        }

        await minioService.uploadFile(objectKey, fileContent, mimeType, fileContent.length);
      }

      // Cập nhật trạng thái HLS sẵn sàng trong MongoDB
      await Media.findByIdAndUpdate(mediaId, {
        hlsReady: true,
        hlsMasterKey: masterKey
      });

      console.log(`🚀 [HLS] Đã đẩy toàn bộ HLS chunks lên MinIO cho mediaId=${mediaId}`);
    } catch (error) {
      console.error(`❌ [HLS] Thất bại xử lý HLS cho mediaId=${mediaId}:`, error.message);
    } finally {
      processingMediaIds.delete(mediaId);
      // Dọn dẹp thư mục tạm
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanErr) {
        console.warn(`⚠️ Lỗi dọn dẹp thư mục tạm HLS:`, cleanErr.message);
      }
    }
  }
};
