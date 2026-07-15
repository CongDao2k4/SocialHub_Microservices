import { useState, useEffect } from "react";
import api from "../../services/api";
import { Video, Loader } from "lucide-react";

// Component con tải Ảnh & Video an toàn bằng blob đính kèm JWT Token
const ChatMedia = ({ mediaId, onLoad, onOpenLightbox, isThumbnailOnly = false }) => {
    const [mediaData, setMediaData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchMedia = async () => {
            try {
                const response = await api.get(`/media/file/${mediaId}`, {
                    responseType: "blob"
                });
                if (isMounted) {
                    const objectUrl = URL.createObjectURL(response.data);
                    const type = response.data.type || "";
                    setMediaData({
                        url: objectUrl,
                        isVideo: type.startsWith("video/")
                    });
                }
            } catch (err) {
                console.error("❌ Lỗi tải media đính kèm chat:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchMedia();

        return () => {
            isMounted = false;
            if (mediaData?.url) URL.revokeObjectURL(mediaData.url);
        };
    }, [mediaId]);

    // Khi loading xong, gọi callback onLoad để thông báo cho component cha cuộn xuống
    useEffect(() => {
        if (!isLoading && onLoad) {
            setTimeout(onLoad, 50);
        }
    }, [isLoading, onLoad]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4 bg-slate-100 min-w-[120px] w-full h-full">
                <Loader className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (!mediaData) {
        return <p className="text-[10px] text-red-400 italic p-2">Không tải được media</p>;
    }

    if (isThumbnailOnly) {
        if (mediaData.isVideo) {
            return (
                <div className="relative w-full h-full min-h-[140px] flex items-center justify-center bg-black overflow-hidden select-none">
                    <video
                        src={mediaData.url}
                        className="w-full h-full object-cover opacity-85 pointer-events-none"
                        onLoadedData={onLoad}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-9 h-9 rounded-full bg-blue-600/90 backdrop-blur-sm flex items-center justify-center border border-white/40 text-white shadow-lg">
                            <Video className="w-4 h-4 fill-white" />
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <img
                src={mediaData.url}
                alt="Thumbnail"
                className="w-full h-full object-cover select-none"
                onLoad={onLoad}
            />
        );
    }

    if (mediaData.isVideo) {
        return (
            <video
                src={mediaData.url}
                controls
                className="rounded-xl max-h-72 max-w-full object-cover shadow-sm bg-black"
                onLoadedData={onLoad}
            />
        );
    }

    return (
        <img
            src={mediaData.url}
            alt="Attached"
            className="rounded-xl max-h-72 max-w-full object-contain cursor-pointer hover:opacity-95 transition shadow-sm"
            onLoad={onLoad}
            onClick={() => (onOpenLightbox ? onOpenLightbox(mediaId) : window.open(mediaData.url, "_blank"))}
        />
    );
};

export default ChatMedia;
