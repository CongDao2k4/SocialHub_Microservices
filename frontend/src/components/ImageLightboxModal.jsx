import { useState, useEffect } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Component Cửa sổ Xem Ảnh Toàn Màn Hình (Image Lightbox Modal)
 * Hỗ trợ chuyển tiếp nhiều ảnh bằng nút điều hướng & phím mũi tên (ArrowLeft / ArrowRight).
 */
const ImageLightboxModal = ({
    images = [],
    imageUrl = "",
    initialIndex = 0,
    onClose,
    altText = "Fullsize Image"
}) => {
    // Chuẩn hóa mảng danh sách ảnh/media
    const mediaList = images.length > 0
        ? images.map(item => (typeof item === "string" ? { url: item } : item))
        : (imageUrl ? [{ url: imageUrl }] : []);

    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Sync initialIndex nếu prop thay đổi
    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [initialIndex]);

    const total = mediaList.length;
    const currentItem = mediaList[currentIndex] || mediaList[0] || {};
    const currentUrl = currentItem.url || "";

    const handlePrev = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    };

    const handleNext = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    };

    // Lắng nghe phím bấm Escape, Mũi tên trái, Mũi tên phải
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowLeft" && total > 1) {
                handlePrev();
            } else if (e.key === "ArrowRight" && total > 1) {
                handleNext();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [total, onClose]);

    if (!currentUrl) return null;

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
            onClick={onClose}
        >
            {/* Nút Đóng */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer z-50 backdrop-blur-md border border-white/10"
                title="Đóng (Esc)"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Nút Mở Tab Mới */}
            <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-16 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer z-50 backdrop-blur-md border border-white/10"
                title="Mở tab mới"
            >
                <ExternalLink className="w-6 h-6" />
            </a>

            {/* Hiển thị số thứ tự ảnh nếu bài đăng có nhiều hơn 1 ảnh */}
            {total > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-white text-xs font-bold tracking-wider z-50">
                    {currentIndex + 1} / {total}
                </div>
            )}

            {/* Nút chuyển ảnh Trước (Previous) */}
            {total > 1 && (
                <button
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition cursor-pointer z-50 backdrop-blur-md border border-white/10 hover:scale-110 active:scale-95"
                    title="Ảnh trước (Mũi tên Trái)"
                >
                    <ChevronLeft className="w-7 h-7" />
                </button>
            )}

            {/* Nút chuyển ảnh Tiếp (Next) */}
            {total > 1 && (
                <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition cursor-pointer z-50 backdrop-blur-md border border-white/10 hover:scale-110 active:scale-95"
                    title="Ảnh tiếp theo (Mũi tên Phải)"
                >
                    <ChevronRight className="w-7 h-7" />
                </button>
            )}

            {/* Khung Hiển thị Ảnh Sắc Nét */}
            <div 
                className="relative max-w-7xl max-h-[90vh] flex items-center justify-center overflow-hidden rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {currentItem.isVideo ? (
                    <video
                        src={currentUrl}
                        controls
                        autoPlay
                        className="max-h-[88vh] max-w-full object-contain rounded-xl shadow-2xl"
                    />
                ) : (
                    <img
                        key={currentUrl}
                        src={currentUrl}
                        alt={altText}
                        className="max-h-[88vh] max-w-full object-contain rounded-xl shadow-2xl animate-scaleUp"
                    />
                )}
            </div>
        </div>
    );
};

export default ImageLightboxModal;
