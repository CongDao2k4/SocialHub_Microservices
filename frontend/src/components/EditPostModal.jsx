import { useState, useRef, useEffect } from "react";
import api from "../services/api";
import { X, Image, Loader, Save } from "lucide-react";

const EditPostModal = ({ post, imageUrl, onClose, onPostUpdated }) => {
    const [content, setContent] = useState(post.content || "");
    const [existingImageUrl, setExistingImageUrl] = useState(imageUrl || "");
    const [hasRemovedExistingImage, setHasRemovedExistingImage] = useState(false);

    const [newImageFile, setNewImageFile] = useState(null);
    const [newImagePreview, setNewImagePreview] = useState(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef(null);

    // Xử lý khi chọn file ảnh mới
    const handleNewImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewImageFile(file);
            setNewImagePreview(URL.createObjectURL(file));
            // Tự động ẩn ảnh cũ khi có ảnh mới
            setHasRemovedExistingImage(true);
        }
    };

    // Hủy chọn ảnh mới
    const handleRemoveNewImage = () => {
        setNewImageFile(null);
        if (newImagePreview) URL.revokeObjectURL(newImagePreview);
        setNewImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        // Khôi phục lại ảnh cũ nếu có và chưa bị xóa thủ công trước đó
        if (imageUrl) {
            setHasRemovedExistingImage(false);
        }
    };

    // Xóa ảnh cũ hiện tại
    const handleRemoveExistingImage = () => {
        setHasRemovedExistingImage(true);
        setNewImageFile(null);
        setNewImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() && hasRemovedExistingImage && !newImageFile) {
            alert("Nội dung bài viết không được để trống!");
            return;
        }

        setIsSubmitting(true);
        let finalMediaIds = [];

        try {
            // Trường hợp A: Chọn ảnh mới -> Upload lên media-service trước
            if (newImageFile) {
                setIsUploading(true);
                const formData = new FormData();
                formData.append("file", newImageFile);

                const uploadRes = await api.post("/media/upload", formData);

                if (uploadRes.data && uploadRes.data.id) {
                    finalMediaIds = [uploadRes.data.id];
                }
                setIsUploading(false);
            } 
            // Trường hợp B: Giữ ảnh cũ hiện tại
            else if (!hasRemovedExistingImage && post.media_ids && post.media_ids.length > 0) {
                finalMediaIds = post.media_ids;
            }

            // Gọi API cập nhật bài viết
            const updateRes = await api.put(`/posts/${post.id}`, {
                content: content.trim(),
                mediaIds: finalMediaIds
            });

            if (updateRes.data && updateRes.data.success) {
                // Thành công: Gửi bài viết đã cập nhật lên component cha
                if (onPostUpdated) {
                    onPostUpdated(updateRes.data.data);
                }
                onClose();
            }
        } catch (error) {
            console.error("❌ Lỗi khi cập nhật bài viết:", error);
            alert("Không thể cập nhật bài viết. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    // Thu hồi link Object URL khi component unmount
    useEffect(() => {
        return () => {
            if (newImagePreview) URL.revokeObjectURL(newImagePreview);
        };
    }, [newImagePreview]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fadeIn">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Chỉnh sửa bài viết</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg hover:bg-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    
                    {/* Ô nhập nội dung chữ */}
                    <div className="space-y-1">
                        <label className="block text-[10px] text-slate-550 font-semibold uppercase">Nội dung bài viết</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Bạn muốn sửa nội dung gì?"
                            rows={4}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition resize-none"
                            required={hasRemovedExistingImage && !newImageFile}
                        />
                    </div>

                    {/* Hiển thị ảnh đính kèm */}
                    <div className="space-y-2">
                        <label className="block text-[10px] text-slate-550 font-semibold uppercase">Hình ảnh đính kèm</label>
                        
                        {/* 1. Hiển thị ảnh cũ nếu giữ nguyên */}
                        {existingImageUrl && !hasRemovedExistingImage && (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-[220px] bg-slate-50 flex justify-center">
                                <img src={existingImageUrl} alt="Current Attachment" className="max-h-[220px] object-contain" />
                                <button
                                    type="button"
                                    onClick={handleRemoveExistingImage}
                                    className="absolute top-2 right-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition cursor-pointer shadow-md"
                                    title="Xóa hình ảnh này"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* 2. Hiển thị ảnh mới chọn xem trước */}
                        {newImagePreview && (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-[220px] bg-slate-50 flex justify-center">
                                <img src={newImagePreview} alt="New Attachment Preview" className="max-h-[220px] object-contain" />
                                <button
                                    type="button"
                                    onClick={handleRemoveNewImage}
                                    className="absolute top-2 right-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition cursor-pointer shadow-md"
                                    title="Hủy chọn ảnh này"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* 3. Nút tải lên ảnh mới nếu hiện tại không có ảnh */}
                        {(!existingImageUrl || hasRemovedExistingImage) && !newImagePreview && (
                            <div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleNewImageChange}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="flex items-center justify-center w-full py-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                >
                                    <Image className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer buttons */}
                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs font-semibold"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (isUploading)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition cursor-pointer text-xs font-semibold shadow-md shadow-blue-600/10 flex items-center space-x-1.5 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>{isSubmitting ? "Đang lưu..." : "Cập nhật"}</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default EditPostModal;
