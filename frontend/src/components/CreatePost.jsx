import { useState, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Image, Video, Send, X, Loader } from "lucide-react";
import { compressImageBeforeUpload } from "../utils/imageCompressor";

const CreatePost = ({ onPostCreated }) => {
    const { user } = useAuth();
    const [content, setContent] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, previewUrl, isVideo }]
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    // 1. Xử lý khi chọn nhiều file (Ảnh / Video)
    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newItems = files.map((file) => ({
            id: Math.random().toString(36).substring(2, 9),
            file,
            previewUrl: URL.createObjectURL(file),
            isVideo: file.type.startsWith("video/")
        }));

        setSelectedFiles((prev) => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // 2. Xóa 1 file khỏi danh sách xem trước
    const handleRemoveFile = (idToRemove) => {
        setSelectedFiles((prev) => {
            const item = prev.find((f) => f.id === idToRemove);
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return prev.filter((f) => f.id !== idToRemove);
        });
    };

    // 3. Đăng bài viết kèm nhiều Media
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() && selectedFiles.length === 0) return;

        setIsSubmitting(true);
        let mediaIds = [];

        try {
            // Bước A: Nén ảnh tại Client & Upload tất cả file song song lên media-service
            if (selectedFiles.length > 0) {
                setIsUploading(true);
                const uploadPromises = selectedFiles.map(async (item) => {
                    let fileToUpload = item.file;
                    if (!item.isVideo && item.file.type.startsWith('image/') && item.file.type !== 'image/gif') {
                        try {
                            fileToUpload = await compressImageBeforeUpload(item.file);
                        } catch (err) {
                            console.warn('[COMPRESS] CreatePost fallback to raw file:', err.message);
                        }
                    }

                    const formData = new FormData();
                    formData.append("file", fileToUpload);
                    const res = await api.post("/media/upload", formData, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                    return res.data?.id;
                });

                const uploadedIds = await Promise.all(uploadPromises);
                mediaIds = uploadedIds.filter(Boolean);
                setIsUploading(false);
            }

            // Bước B: Đăng bài viết kèm mảng mediaIds
            const postRes = await api.post("/posts", {
                content,
                mediaIds,
                visibility: "friends"
            });

            if (postRes.data && postRes.data.success) {
                setContent("");
                // Clear previews
                selectedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                setSelectedFiles([]);
                if (onPostCreated) onPostCreated(postRes.data.data);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đăng bài:", error);
            alert("Không thể đăng bài viết. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start space-x-3 sm:space-x-4">
                    <img
                        src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Avatar"
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`${user?.displayName} ơi, hôm nay bạn đang nghĩ gì thế?`}
                        className="flex-1 bg-transparent border-none text-slate-850 placeholder-slate-400 focus:outline-none resize-none min-h-[70px] text-base sm:text-lg"
                    />
                </div>

                {/* Danh sách xem trước nhiều Ảnh / Video */}
                {selectedFiles.length > 0 && (
                    <div className={`grid gap-2 rounded-2xl overflow-hidden border border-slate-200 p-2 bg-slate-50 ${
                        selectedFiles.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                    }`}>
                        {selectedFiles.map((item) => (
                            <div key={item.id} className="relative group rounded-xl overflow-hidden bg-black/5 aspect-video flex items-center justify-center">
                                {item.isVideo ? (
                                    <video src={item.previewUrl} className="w-full h-full object-cover" controls />
                                ) : (
                                    <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(item.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 rounded-full text-white transition cursor-pointer shadow-md"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-100">
                    {/* Nút chọn Ảnh & Video */}
                    <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        ref={fileInputRef}
                        onChange={handleFilesChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-650 border border-slate-200 transition cursor-pointer disabled:opacity-50 text-xs sm:text-sm font-medium"
                    >
                        <Image className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                        <Video className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        <span>Ảnh / Video</span>
                    </button>

                    {/* Nút Đăng Bài */}
                    <button
                        type="submit"
                        disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                        className="flex items-center space-x-1.5 sm:space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-semibold transition duration-200 transform active:scale-95 disabled:opacity-50 cursor-pointer text-xs sm:text-sm shadow-md shadow-blue-600/10"
                    >
                        {isSubmitting ? (
                            <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        <span>{isSubmitting ? (isUploading ? "Đang tải media..." : "Đang đăng...") : "Đăng bài"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreatePost;
