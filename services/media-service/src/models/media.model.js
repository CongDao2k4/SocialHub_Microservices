// src/models/media.model.js
import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    objectKey: { type: String, required: true },
    uploadedBy: { type: String, required: true }, // User ID của người upload
    compressedSize: { type: Number },
    compressionRatio: { type: Number },
    format: { type: String, default: null },
    hlsReady: { type: Boolean, default: false },
    hlsMasterKey: { type: String, default: null },
    variants: {
      type: Map,
      of: String,
      default: new Map(),
    },
  },
  {
    timestamps: true, // Tự động tạo createdAt và updatedAt
  }
);

// Mongoose tự động cung cấp các hàm như Media.create(), Media.findById(), Media.findByIdAndDelete()
export const Media = mongoose.model('Media', mediaSchema);
