import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import api from "../services/api";

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const HlsVideoPlayer = ({
  mediaId,
  poster,
  className = "",
  controls = true,
  autoPlay = false,
  loop = true,
  muted = false,
  isActive = false,
  isReel = false, // Phân biệt nếu đây là màn hình Reels lướt dọc
  onPlaySuccess,
  onPlayError,
  onTimeUpdate: parentOnTimeUpdate,
  onLoadedMetadata: parentOnLoadedMetadata,
  onEnded: parentOnEnded,
  onClick: parentOnClick,
  videoRefProp
}) => {
  const containerRef = useRef(null);
  const localVideoRef = useRef(null);
  const videoRef = videoRefProp || localVideoRef;
  const hlsRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Đang tải video...");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackBlobUrl, setFallbackBlobUrl] = useState(null);

  useEffect(() => {
    if (!mediaId) return;

    setIsLoading(true);
    setLoadingText("Đang tối ưu hóa video (HLS)...");

    const baseURL = api.defaults.baseURL || "";
    const hlsMasterUrl = `${baseURL}/media/hls/${mediaId}/index.m3u8`;
    const videoNode = videoRef.current;
    if (!videoNode) return;

    let isSubscribed = true;
    let retryTimer = null;
    let retryCount = 0;
    const MAX_RETRIES = 8; // Thử lại tối đa 8 lần (mỗi lần cách 2.5s = 20s cho FFmpeg chạy ngầm)

    // Helper kích hoạt HLS qua Hls.js
    const setupHlsJs = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        maxBufferLength: 30,       // Preload 30s video vào buffer
        maxMaxBufferLength: 60,
        maxBufferHole: 0.5,        // Tự động nhảy qua khe hở buffer (< 0.5s)
        maxSeekHole: 2,            // Cho phép tua mượt qua ranh giới giữa các segment
        nudgeMaxRetry: 5,          // Tự động đẩy nhẹ playhead nếu video bị khựng ở mốc ranh giới
        enableWorker: false,
        autoStartLoad: true,
        xhrSetup: (xhr) => {
          xhr.setRequestHeader("ngrok-skip-browser-warning", "any-value");
          const token = localStorage.getItem("accessToken");
          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }
        }
      });

      hlsRef.current = hls;

      hls.loadSource(hlsMasterUrl);
      hls.attachMedia(videoNode);

      let manifestLoaded = false;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestLoaded = true;
        if (isSubscribed) {
          setIsLoading(false);
          if (autoPlay || (isReel && isActive)) {
            videoNode.play()
              .then(() => {
                setIsPlaying(true);
                if (onPlaySuccess) onPlaySuccess();
              })
              .catch(err => {
                setIsPlaying(false);
                if (onPlayError) onPlayError(err);
              });
          }
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!manifestLoaded) {
                // Nếu FFmpeg đang cắt ngầm (mất ~10s), thử lại tự động thay vì huỷ ngay
                if (retryCount < MAX_RETRIES) {
                  retryCount++;
                  setLoadingText(`Đang xử lý video ngầm (${retryCount * 2.5}s)...`);
                  retryTimer = setTimeout(() => {
                    if (isSubscribed && hlsRef.current) {
                      hlsRef.current.loadSource(hlsMasterUrl);
                    }
                  }, 2500);
                } else {
                  console.warn(`⚠️ [HLS] HLS chưa xong cho ${mediaId}. Chuyển MP4 dự phòng...`);
                  hls.destroy();
                  hlsRef.current = null;
                  loadFallbackMp4();
                }
              } else {
                console.warn("⚠️ [HLS] Mạng chập chờn khi tải segment, tự động nạp lại...");
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("⚠️ [HLS] Lỗi media, thử khôi phục...");
              hls.recoverMediaError();
              break;
            default:
              if (!manifestLoaded) {
                hls.destroy();
                hlsRef.current = null;
                loadFallbackMp4();
              } else {
                hls.startLoad();
              }
              break;
          }
        }
      });
    };

    // Fallback sang tải MP4 blob thông thường nếu HLS chưa xong
    const loadFallbackMp4 = async () => {
      if (!isSubscribed) return;
      setLoadingText("Đang tải tệp MP4 dự phòng...");
      try {
        const res = await api.get(`/media/file/${mediaId}`, { responseType: "blob" });
        if (isSubscribed) {
          const blobUrl = URL.createObjectURL(res.data);
          setFallbackBlobUrl(blobUrl);
          if (videoNode) {
            videoNode.src = blobUrl;
            videoNode.onloadedmetadata = (e) => {
              if (isSubscribed) {
                setIsLoading(false);
                setDuration(videoNode.duration);
                if (parentOnLoadedMetadata) parentOnLoadedMetadata(e);
                if (autoPlay || (isReel && isActive)) {
                  videoNode.play()
                    .then(() => {
                      setIsPlaying(true);
                      if (onPlaySuccess) onPlaySuccess();
                    })
                    .catch(err => {
                      setIsPlaying(false);
                      if (onPlayError) onPlayError(err);
                    });
                }
              }
            };
          }
        }
      } catch (err) {
        console.error(`❌ [HLS Fallback] Không thể tải MP4 fallback ${mediaId}:`, err.message);
        if (isSubscribed) setIsLoading(false);
      }
    };

    // Safari & iOS hỗ trợ HLS native
    if (videoNode.canPlayType("application/vnd.apple.mpegurl")) {
      videoNode.src = hlsMasterUrl;
      setIsLoading(false);
      if (autoPlay || (isReel && isActive)) {
        videoNode.play().then(() => { setIsPlaying(true); if (onPlaySuccess) onPlaySuccess(); }).catch(() => {});
      }
    } else if (Hls.isSupported()) {
      setupHlsJs();
    } else {
      loadFallbackMp4();
    }

    return () => {
      isSubscribed = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [mediaId]);

  // Điều khiển Tự động Play / Pause theo trạng thái cuộn viewport cho REELS
  useEffect(() => {
    if (!isReel) return;
    const videoNode = videoRef.current;
    if (!videoNode) return;

    if (isActive) {
      if (videoNode.src || hlsRef.current) {
        videoNode.play()
          .then(() => {
            setIsPlaying(true);
            if (onPlaySuccess) onPlaySuccess();
          })
          .catch(err => {
            setIsPlaying(false);
            if (onPlayError) onPlayError(err);
          });
      }
    } else {
      videoNode.pause();
      setIsPlaying(false);
    }
  }, [isReel, isActive]);

  // Clean up fallback blob URL khi unmount
  useEffect(() => {
    return () => {
      if (fallbackBlobUrl) {
        URL.revokeObjectURL(fallbackBlobUrl);
      }
    };
  }, [fallbackBlobUrl]);

  // Bật/tắt Play/Pause thủ công
  const handleTogglePlay = (e) => {
    if (e) e.stopPropagation();
    const videoNode = videoRef.current;
    if (!videoNode) return;

    if (isPlaying) {
      videoNode.pause();
      setIsPlaying(false);
    } else {
      videoNode.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
    if (parentOnClick) parentOnClick(e);
  };

  // Tua video khi tua bằng thanh Progress Bar
  const handleSeek = (e) => {
    e.stopPropagation();
    const videoNode = videoRef.current;
    if (!videoNode || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const targetRatio = Math.max(0, Math.min(1, clickX / width));
    const newTime = targetRatio * duration;

    videoNode.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Bật/tắt tiếng
  const handleToggleMute = (e) => {
    e.stopPropagation();
    const videoNode = videoRef.current;
    if (!videoNode) return;
    videoNode.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Bật/tắt Toàn màn hình
  const handleToggleFullscreen = (e) => {
    e.stopPropagation();
    const targetNode = containerRef.current || videoRef.current;
    if (!targetNode) return;

    if (!document.fullscreenElement) {
      targetNode.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden flex items-center justify-center bg-black group select-none ${className}`}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-cover"
        controls={false} // Tắt controls mặc định của trình duyệt để dùng custom UI đẹp mắt 100%
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
        onClick={handleTogglePlay}
        onTimeUpdate={(e) => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          if (parentOnTimeUpdate) parentOnTimeUpdate(e);
        }}
        onLoadedMetadata={(e) => {
          if (videoRef.current) setDuration(videoRef.current.duration);
          if (parentOnLoadedMetadata) parentOnLoadedMetadata(e);
        }}
        onEnded={(e) => {
          setIsPlaying(false);
          if (parentOnEnded) parentOnEnded(e);
        }}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
      />

      {/* Loading Overlay Spinner khi video đang nạp hoặc xử lý ngầm */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-2.5 z-20 pointer-events-none transition-opacity duration-300">
          <Loader className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">{loadingText}</span>
        </div>
      )}

      {/* Nút Play hiển thị chính giữa khi tạm dừng video */}
      {!isPlaying && !isLoading && (
        <div 
          onClick={handleTogglePlay}
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer bg-black/10 group-hover:bg-black/20 transition"
        >
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl scale-95 group-hover:scale-100 transition duration-200">
            <Play className="w-7 h-7 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Thanh Điều Khiển & Tua Video Custom Chuẩn Hiện Đại (Custom Controls Bar) */}
      {controls && (
        <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-2 pt-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col space-y-1.5 opacity-90 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          {/* Thanh Progress Scrubber Tua Video */}
          <div 
            className="relative w-full h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all duration-150 group/bar"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-violet-500 rounded-full relative group-hover/bar:bg-violet-400"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Hàng Nút Bật/Tắt, Thời Gian & Fullscreen */}
          <div className="flex justify-between items-center text-white text-xs px-0.5">
            <div className="flex items-center space-x-2.5">
              {/* Nút Nhanh Play/Pause */}
              <button onClick={handleTogglePlay} className="hover:text-violet-400 transition cursor-pointer">
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              {/* Nút Bật/Tắt Tiếng */}
              <button onClick={handleToggleMute} className="hover:text-violet-400 transition cursor-pointer">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Thời Gian Đã Phát / Tổng Thời Gian */}
              <span className="text-[10px] font-mono text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Nút Toàn Màn Hình */}
            <button onClick={handleToggleFullscreen} className="hover:text-violet-400 transition cursor-pointer">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HlsVideoPlayer;
