import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Volume2, 
  VolumeX, 
  Plus, 
  Loader, 
  Send, 
  X,
  Play,
  Pause,
  MessageSquareCode
} from "lucide-react";
import CreateReelModal from "../components/CreateReelModal";
import ShareModal from "../components/ShareModal";
import HlsVideoPlayer from "../components/HlsVideoPlayer";

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Component con hiển thị từng Video Reel đơn lẻ
const ReelItem = ({ reel, isActive, isMuted, toggleMute, onLikeToggle, onOpenComments, onShare }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Click vào video để Play/Pause thủ công
  const handleVideoClick = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Tua video khi click/kéo trên thanh progress bar
  const handleSeek = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const targetRatio = Math.max(0, Math.min(1, clickX / width));
    const newTime = targetRatio * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Double Click để Thả tim nhanh giống Instagram
  const handleDoubleClick = () => {
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 800);
    if (!reel.isLikedByMe) {
      onLikeToggle(reel.id);
    }
  };

  return (
    <div className="w-full h-full snap-start flex justify-center items-center bg-slate-950 relative border-b border-white/5 overflow-hidden">
      {/* Video Phát chính bằng HLS Streaming */}
      {reel.media_ids?.[0] ? (
        <HlsVideoPlayer
          mediaId={reel.media_ids[0]}
          isReel={true}
          isActive={isActive}
          muted={isMuted}
          controls={false}
          videoRefProp={videoRef}
          className="w-full h-full object-cover max-w-[450px] cursor-pointer"
          onClick={handleVideoClick}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onPlaySuccess={() => {
            setIsPlaying(true);
            api.post(`/reels/${reel.id}/view`).catch(() => {});
          }}
          onPlayError={() => setIsPlaying(false)}
        />
      ) : (
        <div className="text-slate-500 text-xs italic">Không tải được tệp video</div>
      )}

      {/* Hiệu ứng Trái tim đập khi Double Click */}
      {showHeartAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-ping">
          <Heart className="w-24 h-24 text-red-500 fill-red-500 opacity-90 animate-bounce" />
        </div>
      )}

      {/* Nút Play hiển thị chính giữa khi tạm dừng video */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl scale-100 transition duration-200">
            <Play className="w-7 h-7 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Nút bật/tắt tiếng âm thanh */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 border border-white/10 text-white cursor-pointer z-30 transition duration-150"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Phần thông tin tác giả và mô tả ở góc dưới bên trái */}
      <div className="absolute bottom-6 left-4 right-16 text-left space-y-2 z-30 max-w-[80%] pointer-events-auto">
        <div className="flex items-center space-x-2.5">
          <img
            src={reel.author?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reel.author_id}`}
            className="w-9 h-9 rounded-full object-cover border border-white/20 shadow-md"
            alt="Author Avatar"
          />
          <div>
            <span className="font-bold text-sm text-white drop-shadow-md">{reel.author?.displayName || "Người dùng"}</span>
            <span className="text-[10px] text-white/70 block drop-shadow-sm">{reel.view_count || 0} lượt xem</span>
          </div>
        </div>
        {reel.content && (
          <p className="text-xs text-white/90 leading-relaxed font-medium line-clamp-3 drop-shadow-md select-text">
            {reel.content}
          </p>
        )}
      </div>

      {/* Cột các nút tương tác bên phải (Like, Comment, Share) */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center space-y-5 z-30 pointer-events-auto">
        {/* Nút Like (Heart) */}
        <div className="flex flex-col items-center text-center space-y-1">
          <button
            onClick={() => onLikeToggle(reel.id)}
            className={`p-3 rounded-full backdrop-blur-md border transition duration-300 cursor-pointer shadow-lg active:scale-90 ${
              reel.isLikedByMe
                ? "bg-red-500/90 text-white border-red-500"
                : "bg-black/40 text-white border-white/10 hover:bg-black/60"
            }`}
          >
            <Heart className={`w-5 h-5 ${reel.isLikedByMe ? "fill-white" : ""}`} />
          </button>
          <span className="text-[10px] font-bold text-white drop-shadow-md">{reel.like_count || 0}</span>
        </div>

        {/* Nút bình luận */}
        <div className="flex flex-col items-center text-center space-y-1">
          <button
            onClick={() => onOpenComments(reel)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 text-white transition duration-300 cursor-pointer shadow-lg active:scale-90"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-bold text-white drop-shadow-md">{reel.comment_count || 0}</span>
        </div>

        {/* Nút chia sẻ */}
        <div className="flex flex-col items-center text-center space-y-1">
          <button
            onClick={() => onShare(reel)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 text-white transition duration-300 cursor-pointer shadow-lg active:scale-90"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-bold text-white drop-shadow-md">{reel.share_count || 0}</span>
        </div>
      </div>

      {/* Thanh Scrubber / Tua video chuẩn Facebook Reels ở đáy */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-1 pt-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col space-y-1 pointer-events-auto">
        <div 
          className="relative w-full h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all duration-150 group"
          onClick={handleSeek}
        >
          {/* Thanh tiến trình đã phát */}
          <div 
            className="h-full bg-violet-500 rounded-full relative group-hover:bg-violet-400"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          >
            {/* Núm tròn chỉ báo khi hover */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between items-center text-[10px] text-white/70 font-mono px-0.5 pointer-events-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Đáy sẫm màu để text dễ đọc */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-0" />
    </div>
  );
};

// Component chính trang Reels
const Reels = () => {
  const [searchParams] = useSearchParams();
  const targetReelId = searchParams.get("id");

  const [reels, setReels] = useState([]);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSharePost, setSelectedSharePost] = useState(null);

  // Drawer bình luận
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentReel, setSelectedCommentReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // Load danh sách Reels từ Backend
  const fetchReels = async (currentPage) => {
    try {
      // 1. Tải danh sách Reels theo trang
      const res = await api.get(`/reels?page=${currentPage}&limit=5`);
      let list = (res.data && res.data.success) ? (res.data.data || []) : [];

      // 2. Nếu ở Trang 1 và URL có tham số id (Reel được chia sẻ từ tin nhắn)
      if (currentPage === 1 && targetReelId) {
        try {
          const targetRes = await api.get(`/reels/${targetReelId}`);
          if (targetRes.data && targetRes.data.success && targetRes.data.data) {
            const targetReel = targetRes.data.data;
            // Loại bỏ trùng lặp và đưa Reel được chia sẻ lên Vị trí đầu tiên (Index 0)
            list = [targetReel, ...list.filter(r => r.id !== targetReelId)];
          }
        } catch (singleErr) {
          console.warn("⚠️ Không lấy được Reel cụ thể theo ID:", singleErr.message);
        }
      }

      if (list.length === 0) {
        setHasMore(false);
      } else {
        setReels(prev => (currentPage === 1 ? list : [...prev, ...list]));
      }
    } catch (err) {
      console.error("❌ Lỗi tải Reels:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReels(1);
  }, [targetReelId]);

  // Thiết lập IntersectionObserver theo dõi video nào đang hiển thị ở tâm viewport
  useEffect(() => {
    if (reels.length === 0) return;

    const options = {
      root: containerRef.current,
      rootMargin: "0px",
      threshold: 0.6 // Element phải hiển thị ít nhất 60% diện tích
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute("data-index"), 10);
          setActiveReelIndex(index);

          // Phân trang tự động: Nếu cuộn gần tới cuối danh sách, tải thêm Reels
          if (index === reels.length - 2 && hasMore) {
            setPage(prev => {
              const nextPage = prev + 1;
              fetchReels(nextPage);
              return nextPage;
            });
          }
        }
      });
    }, options);

    // Gắn observer cho từng Reel container
    const children = containerRef.current?.children;
    if (children) {
      Array.from(children).forEach(child => {
        observerRef.current.observe(child);
      });
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [reels, hasMore]);

  // Xử lý Thả tim / Bỏ tim Reels
  const handleLikeToggle = async (reelId) => {
    // 1. Tìm reel hiện tại trong state trước khi làm Optimistic Update
    const currentReel = reels.find(r => r.id === reelId);
    if (!currentReel) return;

    const wasLiked = currentReel.isLikedByMe;

    // 2. Cập nhật Optimistic UI cho mượt
    setReels(prev => prev.map(r => {
      if (r.id === reelId) {
        return {
          ...r,
          isLikedByMe: !wasLiked,
          like_count: !wasLiked ? (r.like_count || 0) + 1 : Math.max((r.like_count || 0) - 1, 0)
        };
      }
      return r;
    }));

    try {
      if (wasLiked) {
        // Nếu đã thích -> Gọi Bỏ thích (UNLIKE)
        await api.delete(`/reels/${reelId}/like`);
      } else {
        // Nếu chưa thích -> Gọi Thích (LIKE)
        await api.post(`/reels/${reelId}/like`);
      }
    } catch (err) {
      console.error("❌ Lỗi tương tác Like Reel:", err.message);
      // Revert lại trạng thái cũ nếu API lỗi
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          return {
            ...r,
            isLikedByMe: wasLiked,
            like_count: currentReel.like_count
          };
        }
        return r;
      }));
    }
  };

  // Mở ngăn kéo bình luận
  const handleOpenComments = async (reel) => {
    setSelectedCommentReel(reel);
    setCommentDrawerOpen(true);
    setComments([]);
    
    // Tải danh sách bình luận
    try {
      const res = await api.get(`/reels/${reel.id}/comments`);
      if (res.data && res.data.success) {
        setComments(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Lỗi tải bình luận:", err.message);
    }
  };

  // Đăng bình luận mới
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedCommentReel || isSubmittingComment) return;

    const contentText = commentInput.trim();
    setIsSubmittingComment(true);
    try {
      const res = await api.post(`/reels/${selectedCommentReel.id}/comments`, {
        content: contentText
      });

      if (res.data && res.data.success) {
        const newCommentObj = res.data.data;
        // Đưa comment mới lên đầu danh sách
        setComments(prev => [newCommentObj, ...prev]);
        setCommentInput("");
        
        // Cập nhật số đếm bình luận ở UI chính & Drawer
        setReels(prev => prev.map(r => {
          if (r.id === selectedCommentReel.id) {
            return { ...r, comment_count: (r.comment_count || 0) + 1 };
          }
          return r;
        }));
        setSelectedCommentReel(prev => prev ? ({
          ...prev,
          comment_count: (prev.comment_count || 0) + 1
        }) : null);
      }
    } catch (err) {
      console.error("❌ Lỗi tạo bình luận Reel:", err.message);
      alert("Không thể đăng bình luận!");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Mở modal chia sẻ
  const handleShareClick = (reel) => {
    // Do cấu trúc bài post chia sẻ tái sử dụng PostCard, ta map Reel thành Object Post tương ứng để ShareModal hoạt động
    const mockPost = {
      id: reel.id,
      content: reel.content,
      author: reel.author,
      media_ids: reel.media_ids
    };
    setSelectedSharePost(mockPost);
    setShowShareModal(true);
  };

  return (
    <div className="w-full flex items-center justify-center min-h-[calc(100vh-8.5rem)] md:min-h-[calc(100vh-6rem)] relative bg-slate-900 md:rounded-3xl overflow-hidden shadow-2xl py-0 md:py-3 border-0 md:border border-white/5 select-none">
      
      {/* Frame bọc ngoài cố định không cuộn */}
      <div className="w-full md:max-w-[420px] h-[calc(100vh-8.5rem)] md:h-[78vh] md:rounded-2xl border-0 md:border border-white/10 shadow-2xl relative bg-slate-950 flex flex-col overflow-hidden">
        
        {/* Khung chứa các Video cuộn dọc */}
        <div 
          ref={containerRef}
          className="w-full h-full snap-y snap-mandatory overflow-y-scroll scrollbar-none flex flex-col"
        >
          {isLoading && reels.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-400 space-y-3">
              <Loader className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-xs">Đang chuẩn bị thước phim...</p>
            </div>
          ) : reels.length > 0 ? (
            reels.map((reel, index) => {
              const isAdjacent = Math.abs(index - activeReelIndex) <= 1;
              return (
                <div 
                  key={reel.id} 
                  data-index={index} 
                  className="w-full h-full shrink-0 snap-start"
                >
                  {isAdjacent ? (
                    <ReelItem
                      reel={reel}
                      isActive={index === activeReelIndex}
                      isMuted={isMuted}
                      toggleMute={() => setIsMuted(prev => !prev)}
                      onLikeToggle={handleLikeToggle}
                      onOpenComments={handleOpenComments}
                      onShare={handleShareClick}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-600 space-y-2">
                      <Loader className="w-6 h-6 animate-spin text-slate-700" />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-500 text-xs italic space-y-4 p-8 text-center">
              <p>Chưa có Reels nào được đăng tải.</p>
              <p>Hãy trở thành người đầu tiên chia sẻ thước phim ngắn của bạn!</p>
            </div>
          )}
        </div>

        {/* Ngăn kéo Bình luận (Comment Drawer) trượt lên trên khung cố định, nằm ngoài scroll container */}
        {commentDrawerOpen && selectedCommentReel && (
          <div className="absolute inset-x-0 bottom-0 h-[65%] bg-slate-900/95 backdrop-blur-md rounded-t-2xl z-50 flex flex-col border-t border-white/10 shadow-2xl animate-slideUp">
            
            {/* Header Drawer */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <MessageSquareCode className="w-4 h-4 text-violet-500" />
                <span>Bình luận ({selectedCommentReel.comment_count || 0})</span>
              </span>
              <button 
                onClick={() => setCommentDrawerOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danh sách bình luận */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 select-text">
              {comments.length > 0 ? (
                comments.map((comment, i) => (
                  <div key={comment.id || i} className="flex items-start space-x-2.5">
                    <img 
                      src={comment.author?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author_id}`}
                      className="w-7 h-7 rounded-full object-cover border border-white/10 mt-0.5"
                      alt="Avatar"
                    />
                    <div className="flex-1 bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-left">
                      <span className="font-bold text-[10px] text-violet-400 block mb-0.5">{comment.author?.displayName || "Người dùng"}</span>
                      <p className="text-xs text-slate-200 leading-normal whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-[10px] italic">
                  Chưa có bình luận nào. Hãy bình luận đầu tiên!
                </div>
              )}
            </div>

            {/* Ô gõ bình luận chân Drawer */}
            <form onSubmit={handlePostComment} className="p-3 border-t border-white/10 flex items-center space-x-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Nói gì đó về thước phim này..."
                disabled={isSubmittingComment}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-550 focus:outline-none focus:border-violet-500 transition disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={isSubmittingComment || !commentInput.trim()}
                className="p-2.5 bg-violet-600 disabled:opacity-50 hover:bg-violet-750 text-white rounded-xl cursor-pointer transition active:scale-95 shadow-md shadow-violet-600/10"
              >
                {isSubmittingComment ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Nút "Tạo Reels" nổi bay bổng bên cạnh phải màn hình */}
      <div className="absolute top-6 right-6 z-10 pointer-events-auto">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-4.5 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:opacity-90 active:scale-95 text-white font-bold rounded-full text-xs shadow-lg shadow-violet-500/20 cursor-pointer transition duration-150"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Reels</span>
        </button>
      </div>

      {/* Modals hỗ trợ đăng Reels và Chia sẻ */}
      {showCreateModal && (
        <CreateReelModal
          onClose={() => setShowCreateModal(false)}
          onUploadSuccess={() => {
            setShowCreateModal(false);
            setIsLoading(true);
            setPage(1);
            fetchReels(1); // Load lại feed
          }}
        />
      )}

      {showShareModal && selectedSharePost && (
        <ShareModal
          post={selectedSharePost}
          onClose={() => {
            setShowShareModal(false);
            setSelectedSharePost(null);
          }}
          onShareSuccess={() => {
            setShowShareModal(false);
            setSelectedSharePost(null);
            // Cập nhật số lượt share tăng lên 1 trên UI
            setReels(prev => prev.map(r => {
              if (r.id === selectedSharePost.id) {
                return { ...r, share_count: (r.share_count || 0) + 1 };
              }
              return r;
            }));
          }}
        />
      )}
    </div>
  );
};

export default Reels;
