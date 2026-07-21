import { useState, useRef } from "react";
import api from "../services/api";
import { X, Video, Upload, Loader } from "lucide-react";

const CreateReelModal = ({ onClose, onUploadSuccess }) => {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Xử lý khi chọn file video
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        alert("Vui lòng chọn tệp tin video hợp lệ!");
        return;
      }
      // Giới hạn dung lượng video khoảng 50MB để chạy mượt local
      if (file.size > 50 * 1024 * 1024) {
        alert("Dung lượng video vượt quá 50MB. Vui lòng chọn tệp nhỏ hơn!");
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  // Kéo và thả file
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        alert("Vui lòng chọn tệp tin video hợp lệ!");
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  // Xóa video đã chọn để chọn lại
  const handleRemoveVideo = () => {
    setVideoFile(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Gửi video và đăng Reels
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Giai đoạn 1: Tải video lên media-service thông qua Gateway
      const formData = new FormData();
      formData.append("file", videoFile);

      const uploadRes = await api.post("/media/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        // Lắng nghe tiến trình upload realtime
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      const mediaId = uploadRes.data?.id;
      if (!mediaId) {
        throw new Error("Không lấy được Media ID từ dịch vụ media!");
      }

      // Giai đoạn 2: Tạo Reels trong post-service qua Gateway
      const reelRes = await api.post("/reels", {
        caption: caption.trim(),
        mediaId: mediaId,
      });

      if (reelRes.data && reelRes.data.success) {
        alert("Đăng thước phim Reels thành công!");
        onUploadSuccess();
      }
    } catch (err) {
      console.error("❌ Lỗi đăng tải Reel:", err.message);
      alert(err.response?.data?.message || "Đã xảy ra lỗi trong quá trình tải thước phim lên!");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn select-none">
      <div className="bg-slate-900 border border-white/10 w-full max-w-lg max-h-[90vh] p-4 sm:p-6 rounded-2xl shadow-2xl space-y-4 relative flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Video className="w-4 h-4 text-violet-500" />
            <span>Tạo thước phim mới</span>
          </h3>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white cursor-pointer transition disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Đăng Reel */}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col overflow-y-auto pr-1">
          {/* Vùng chọn Video */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center relative overflow-hidden transition ${
              videoPreview
                ? "border-violet-500 bg-black/50"
                : "border-white/10 hover:border-violet-500/50 bg-slate-950/40"
            }`}
          >
            {videoPreview ? (
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                <video
                  src={videoPreview}
                  controls
                  className="max-w-full max-h-full object-contain"
                />
                {!isUploading && (
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center space-y-3 cursor-pointer p-6 text-center w-full h-full"
              >
                <div className="p-4 bg-violet-600/10 rounded-full border border-violet-500/20 text-violet-400">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Kéo và thả video thước phim vào đây</p>
                  <p className="text-[10px] text-slate-500 mt-1">Hoặc click để chọn video từ máy tính của bạn (tối đa 50MB)</p>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />
          </div>

          {/* Ô nhập Caption */}
          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1.5">
              Mô tả thước phim
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Chia sẻ khoảnh khắc thú vị của bạn..."
              disabled={isUploading}
              rows="3"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none disabled:opacity-50"
            />
          </div>

          {/* Thanh Tiến trình Upload */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                <span>Đang tải video lên máy chủ...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-violet-500 to-pink-500 h-full rounded-full transition-all duration-300 shadow-md shadow-violet-500/20"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Nút gửi ở đáy */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-350 transition cursor-pointer disabled:opacity-30"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!videoFile || isUploading}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-violet-500/20"
            >
              {isUploading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>{uploadProgress === 100 ? "Đang xử lý..." : "Đang tải lên"}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Đăng ngay</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReelModal;
