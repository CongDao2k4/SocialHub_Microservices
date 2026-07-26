import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { getMediaFileUrl, getHlsUrl } from "../services/mediaUrl";

const PLAYLIST_RETRY_DELAY_MS = 2500;
const MAX_PLAYLIST_RETRIES = 12;
const MAX_SEGMENT_RECOVERIES = 4;

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const buildMediaHeaders = () => {
  const headers = { "ngrok-skip-browser-warning": "any-value" };
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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
  isReel = false,
  onPlaySuccess,
  onPlayError,
  onTimeUpdate: parentOnTimeUpdate,
  onLoadedMetadata: parentOnLoadedMetadata,
  onEnded: parentOnEnded,
  onClick: parentOnClick,
  objectFit = "object-cover",
  videoRefProp
}) => {
  const containerRef = useRef(null);
  const localVideoRef = useRef(null);
  const videoRef = videoRefProp || localVideoRef;
  const hlsRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Dang tai video...");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackBlobUrl, setFallbackBlobUrl] = useState(null);
  const [isLandscape, setIsLandscape] = useState(false);

  const effectivePoster = poster || (mediaId ? getMediaFileUrl(mediaId, "medium") : undefined);

  useEffect(() => {
    if (!mediaId) return;

    // Lazy load: skip HLS initialization and video buffering for inactive reels
    if (isReel && !isActive) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingText("Dang tai video...");

    const hlsMasterUrl = getHlsUrl(mediaId);
    const videoNode = videoRef.current;
    if (!videoNode) return;

    let isSubscribed = true;
    let retryTimer = null;
    let segmentRecoveryCount = 0;

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    const maybeAutoplay = () => {
      if (!(autoPlay || (isReel && isActive))) return;

      videoNode.play()
        .then(() => {
          setIsPlaying(true);
          if (onPlaySuccess) onPlaySuccess();
        })
        .catch((err) => {
          setIsPlaying(false);
          if (onPlayError) onPlayError(err);
        });
    };

    const syncVideoMetrics = () => {
      if (videoNode.duration && !isNaN(videoNode.duration)) {
        setDuration(videoNode.duration);
      }
      if (videoNode.videoWidth && videoNode.videoHeight) {
        setIsLandscape(videoNode.videoWidth > videoNode.videoHeight);
      }
    };

    const waitForPlaylistReady = async () => {
      if (!isSubscribed) return false;

      try {
        const response = await fetch(`${hlsMasterUrl}?t=${Date.now()}`, {
          method: "GET",
          headers: buildMediaHeaders(),
          cache: "no-store"
        });

        if (response.ok) {
          return true;
        }
      } catch (err) {
        console.warn(`[HLS Player] Check playlist error:`, err.message);
      }

      return false;
    };

    const loadFallbackMp4 = async () => {
      if (!isSubscribed) return;

      const mp4Url = getMediaFileUrl(mediaId);
      const isNgrok = mp4Url.includes("ngrok");

      if (!isNgrok) {
        // Direct streaming for local/non-ngrok environments via HTTP range requests
        setFallbackBlobUrl(null);
        videoNode.src = mp4Url;
        videoNode.onloadedmetadata = (e) => {
          if (!isSubscribed) return;
          setIsLoading(false);
          syncVideoMetrics();
          if (parentOnLoadedMetadata) parentOnLoadedMetadata(e);
          maybeAutoplay();
        };
        return;
      }

      setLoadingText("Dang tai tep MP4 du phong...");

      try {
        const response = await fetch(mp4Url, {
          headers: buildMediaHeaders(),
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blobData = await response.blob();
        if (!isSubscribed) return;

        const blobUrl = URL.createObjectURL(blobData);
        setFallbackBlobUrl(blobUrl);
        videoNode.src = blobUrl;
        videoNode.onloadedmetadata = (e) => {
          if (!isSubscribed) return;
          setIsLoading(false);
          syncVideoMetrics();
          if (parentOnLoadedMetadata) parentOnLoadedMetadata(e);
          maybeAutoplay();
        };
      } catch (err) {
        console.error(`[HLS Fallback] Khong the tai MP4 fallback ${mediaId}:`, err.message);
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    const setupHlsJs = () => {
      cleanupHls();

      const hls = new Hls({
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 10,
        maxBufferHole: 0.5,
        maxSeekHole: 2,
        nudgeMaxRetry: 5,
        enableWorker: true,
        autoStartLoad: true,
        xhrSetup: (xhr) => {
          const headers = buildMediaHeaders();
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }
      });

      hlsRef.current = hls;

      let manifestLoaded = false;

      hls.loadSource(`${hlsMasterUrl}?t=${Date.now()}`);
      hls.attachMedia(videoNode);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestLoaded = true;
        segmentRecoveryCount = 0;

        if (!isSubscribed) return;
        setIsLoading(false);
        syncVideoMetrics();
        maybeAutoplay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (!manifestLoaded) {
              console.warn(`[HLS] Playlist loi sau khi da san sang cho ${mediaId}. Chuyen MP4 du phong...`);
              cleanupHls();
              loadFallbackMp4();
            } else {
              segmentRecoveryCount += 1;
              if (segmentRecoveryCount <= MAX_SEGMENT_RECOVERIES) {
                console.warn("[HLS] Mang chap chon khi tai segment, tu dong nap lai...");
                hls.startLoad();
              } else {
                console.warn(`[HLS] Segment loi lap lai cho ${mediaId}. Chuyen MP4 du phong...`);
                cleanupHls();
                loadFallbackMp4();
              }
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn("[HLS] Loi media, thu khoi phuc...");
            hls.recoverMediaError();
            break;
          default:
            cleanupHls();
            loadFallbackMp4();
            break;
        }
      });
    };

    const bootstrapPlayback = async () => {
      try {
        const playlistReady = await waitForPlaylistReady();

        if (!playlistReady || !isSubscribed) {
          await loadFallbackMp4();
          return;
        }

        if (videoNode.canPlayType("application/vnd.apple.mpegurl")) {
          videoNode.src = `${hlsMasterUrl}?t=${Date.now()}`;
          setIsLoading(false);
          maybeAutoplay();
          return;
        }

        if (Hls.isSupported()) {
          setupHlsJs();
          return;
        }

        await loadFallbackMp4();
      } catch (err) {
        console.warn(`[HLS] Khong cho duoc playlist cho ${mediaId}. Chuyen MP4 du phong...`, err);
        await loadFallbackMp4();
      }
    };

    bootstrapPlayback();

    return () => {
      isSubscribed = false;
      if (retryTimer) clearTimeout(retryTimer);
      cleanupHls();
      if (videoNode) {
        videoNode.pause();
        videoNode.removeAttribute('src'); // Remove src to immediately free resources and stop network requests
        try {
          videoNode.load(); // Force browser to clean media buffers and close socket
        } catch (e) {}
      }
    };
  }, [mediaId, isActive, isReel]);

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
          .catch((err) => {
            setIsPlaying(false);
            if (onPlayError) onPlayError(err);
          });
      }
    } else {
      videoNode.pause();
      setIsPlaying(false);
    }
  }, [isReel, isActive]);

  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode) {
      videoNode.muted = muted;
      setIsMuted(muted);
    }
  }, [muted]);

  useEffect(() => {
    return () => {
      if (fallbackBlobUrl) {
        URL.revokeObjectURL(fallbackBlobUrl);
      }
    };
  }, [fallbackBlobUrl]);

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

  const handleToggleMute = (e) => {
    e.stopPropagation();
    const videoNode = videoRef.current;
    if (!videoNode) return;
    videoNode.muted = !isMuted;
    setIsMuted(!isMuted);
  };

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
      {isLandscape && effectivePoster && (
        <img
          src={effectivePoster}
          alt="Video Backdrop"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40 pointer-events-none"
        />
      )}

      <video
        ref={videoRef}
        poster={effectivePoster}
        className={`w-full h-full relative z-10 ${isLandscape ? "object-contain" : (objectFit || "object-cover")}`}
        controls={false}
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onClick={handleTogglePlay}
        onTimeUpdate={(e) => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            if ((!duration || isNaN(duration)) && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
              setDuration(videoRef.current.duration);
            }
            if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
              const isWide = videoRef.current.videoWidth > videoRef.current.videoHeight;
              if (isWide !== isLandscape) setIsLandscape(isWide);
            }
          }
          if (parentOnTimeUpdate) parentOnTimeUpdate(e);
        }}
        onLoadedMetadata={(e) => {
          if (videoRef.current) {
            if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
              setDuration(videoRef.current.duration);
            }
            if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
              setIsLandscape(videoRef.current.videoWidth > videoRef.current.videoHeight);
            }
            setIsLoading(false);
          }
          if (parentOnLoadedMetadata) parentOnLoadedMetadata(e);
        }}
        onCanPlay={() => {
          if (videoRef.current) {
            if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
              setDuration(videoRef.current.duration);
            }
            if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
              setIsLandscape(videoRef.current.videoWidth > videoRef.current.videoHeight);
            }
          }
          setIsLoading(false);
        }}
        onDurationChange={() => {
          if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
            setDuration(videoRef.current.duration);
          }
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

      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-2.5 z-20 pointer-events-none transition-opacity duration-300">
          <Loader className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">{loadingText}</span>
        </div>
      )}

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

      {controls && (
        <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-2 pt-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col space-y-1.5 opacity-90 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
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

          <div className="flex justify-between items-center text-white text-xs px-0.5">
            <div className="flex items-center space-x-2.5">
              <button onClick={handleTogglePlay} className="hover:text-violet-400 transition cursor-pointer">
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <button onClick={handleToggleMute} className="hover:text-violet-400 transition cursor-pointer">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <span className="text-[10px] font-mono text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

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
