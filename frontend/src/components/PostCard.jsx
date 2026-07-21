import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom"; // <-- Import thêm Link để điều hướng
import api from "../services/api";
import { Heart, MessageSquare, Share2, Trash2, Send, Loader, Edit3 } from "lucide-react";
import ShareModal from "./ShareModal";
import EditPostModal from "./EditPostModal";
import ImageLightboxModal from "./ImageLightboxModal";
import HlsVideoPlayer from "./HlsVideoPlayer";
import { useAuth } from "../context/AuthContext"; // <-- Import useAuth

const PostCard = ({ post, currentUserId, onPostShared, onPostDeleted, onPostUpdated }) => {
    const { user: currentUser } = useAuth(); // Lấy thông tin user hiện tại
    const [showEditModal, setShowEditModal] = useState(false);
    const [lightboxData, setLightboxData] = useState(null); // { items: [...], index: 0 }
    const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
    const [likeCount, setLikeCount] = useState(post.like_count || 0);
    const [commentCount, setCommentCount] = useState(post.comment_count || 0);
    const [shareCount, setShareCount] = useState(post.share_count || 0);
    const [imageUrl, setImageUrl] = useState("");
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    // Mở Lightbox Modal với danh sách toàn bộ ảnh của bài viết
    const handleOpenLightbox = (index, itemsList = mediaItems) => {
        setLightboxData({ items: itemsList, index });
    };

    // Trạng thái cho bài đăng được chia sẻ
    const [originalPost, setOriginalPost] = useState(null);
    const [originalMediaItems, setOriginalMediaItems] = useState([]);
    const [isLoadingOriginalMedia, setIsLoadingOriginalMedia] = useState(false);
    const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);

    // Trạng thái cho Bình luận
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Trạng thái cho Share Modal
    const [showShareModal, setShowShareModal] = useState(false);

    const commentInputRef = useRef(null);
    const [replyingTo, setReplyingTo] = useState(null); // Lưu thông tin comment đang được phản hồi

    // Xử lý khi nhấn nút Phản hồi
    const handleReplyClick = (comment) => {
        setReplyingTo(comment);
        setTimeout(() => {
            if (commentInputRef.current) {
                commentInputRef.current.focus();
            }
        }, 100);
    };

    // Hàm phân giải nội dung bình luận để xác định xem có phải là phản hồi không và tag ai, parentId là gì
    const parseComment = (text) => {
        if (!text) return { isReply: false, parentId: null, mentionName: "", cleanText: "" };
        
        // 1. Dạng mới có parentId và mention: [reply:parentId:@Tên] nội dung
        const matchFull = text.match(/^\[reply:([0-9a-fA-F-]+):@([^\]]+)\]/);
        if (matchFull) {
            return { isReply: true, parentId: matchFull[1], mentionName: matchFull[2], cleanText: text.substring(matchFull[0].length).trim() };
        }
        
        // 2. Dạng mới chỉ có parentId: [reply:parentId] nội dung
        const matchParent = text.match(/^\[reply:([0-9a-fA-F-]+)\]/);
        if (matchParent) {
            return { isReply: true, parentId: matchParent[1], mentionName: "", cleanText: text.substring(matchParent[0].length).trim() };
        }

        // 3. Dạng cũ không có parentId: [reply] nội dung
        if (text.startsWith("[reply]")) {
            return { isReply: true, parentId: null, mentionName: "", cleanText: text.substring(7).trim() };
        }
        
        // 4. Dạng cũ: [reply:@Tên] nội dung
        const matchReplyTag = text.match(/^\[reply:@([^\]]+)\]/);
        if (matchReplyTag) {
            return { isReply: true, parentId: null, mentionName: matchReplyTag[1], cleanText: text.substring(matchReplyTag[0].length).trim() };
        }
        
        // 5. Dạng cũ (tương thích ngược): @Tên: nội dung
        const matchOldTag = text.match(/^@([^:]+):/);
        if (matchOldTag) {
            return { isReply: true, parentId: null, mentionName: matchOldTag[1], cleanText: text.substring(matchOldTag[0].length).trim() };
        }

        return { isReply: false, parentId: null, mentionName: "", cleanText: text };
    };

    // Phân nhóm bình luận: bình luận gốc (parents) và bình luận phản hồi (replies) theo parentId
    const getStructuredComments = () => {
        const parsed = comments.map(c => ({
            ...c,
            parsedInfo: parseComment(c.content)
        }));

        const parents = [];
        const repliesByParent = {}; // parentId -> array of replies

        parsed.forEach(c => {
            const cId = c.id || c._id;
            
            if (c.parsedInfo.isReply && c.parsedInfo.parentId && parsed.some(p => (p.id || p._id) === c.parsedInfo.parentId)) {
                const pId = c.parsedInfo.parentId;
                if (!repliesByParent[pId]) repliesByParent[pId] = [];
                repliesByParent[pId].push(c);
            } else if (c.parsedInfo.isReply && !c.parsedInfo.parentId) {
                // Hỗ trợ định dạng cũ không có parentId:
                // Tìm comment cha gần nhất được đăng trước đó mà không phải là reply, 
                // hoặc mặc định coi như parent comment
                let foundParent = null;
                const currentIndex = parsed.findIndex(item => (item.id || item._id) === cId);
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (!parsed[i].parsedInfo.isReply) {
                        foundParent = parsed[i];
                        break;
                    }
                }
                if (foundParent) {
                    const pId = foundParent.id || foundParent._id;
                    if (!repliesByParent[pId]) repliesByParent[pId] = [];
                    repliesByParent[pId].push(c);
                } else {
                    parents.push(c);
                }
            } else {
                parents.push(c);
            }
        });

        return { parents, repliesByParent };
    };

    const [mediaItems, setMediaItems] = useState([]); // [{ id, url, isVideo }]
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    // 1. Tải tất cả Media (Ảnh & Video) đính kèm của bài viết
    useEffect(() => {
        const rawMediaList = post.media_ids || post.mediaIds || [];
        if (!rawMediaList || rawMediaList.length === 0) {
            setMediaItems([]);
            setIsLoadingMedia(false);
            return;
        }

        let isSubscribed = true;
        setIsLoadingMedia(true);

        const fetchMediaMeta = async () => {
            try {
                const promises = rawMediaList.map(async (item) => {
                    const mId = typeof item === "string" ? item : (item.id || item._id);
                    try {
                        const metaRes = await api.get(`/media/${mId}`);
                        const mimeType = metaRes.data?.mimeType || "";
                        const isVideo = mimeType.startsWith("video/");
                        const imgUrl = `${api.defaults.baseURL}/media/file/${mId}?variant=medium`;
                        return { id: mId, url: imgUrl, isVideo };
                    } catch (err) {
                        return { id: mId, url: `${api.defaults.baseURL}/media/file/${mId}?variant=medium`, isVideo: true };
                    }
                });
                const results = await Promise.all(promises);
                if (isSubscribed) {
                    setMediaItems(results.filter(Boolean));
                }
            } catch (error) {
                console.error("❌ Lỗi phân loại media:", error.message);
            } finally {
                if (isSubscribed) {
                    setIsLoadingMedia(false);
                }
            }
        };

        fetchMediaMeta();

        return () => {
            isSubscribed = false;
        };
    }, [JSON.stringify(post.media_ids || post.mediaIds || [])]);

    // 2. Lấy thông tin bài gốc nhúng nếu là bài được chia sẻ (is_shared = true)
    useEffect(() => {
        const fetchOriginalPost = async () => {
            if (post.is_shared && (post.original_post_id || post.original_reel_id)) {
                setIsLoadingOriginal(true);
                try {
                    let res;
                    if (post.original_post_id) {
                        res = await api.get(`/posts/${post.original_post_id}`);
                    } else if (post.original_reel_id) {
                        res = await api.get(`/reels/${post.original_reel_id}`);
                    }
                    if (res && res.data && res.data.success) {
                        setOriginalPost(res.data.data);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy thông tin bài đăng gốc:", error.message);
                } finally {
                    setIsLoadingOriginal(false);
                }
            }
        };
        fetchOriginalPost();
    }, [post.is_shared, post.original_post_id, post.original_reel_id]);

    // 2b. Tải tất cả Media (Ảnh & Video) của bài viết gốc
    useEffect(() => {
        let createdObjectUrls = [];
        const originalMediaList = originalPost ? (originalPost.media_ids || originalPost.mediaIds || []) : [];
        const fetchOriginalMedia = async () => {
            if (originalMediaList && originalMediaList.length > 0) {
                setIsLoadingOriginalMedia(true);
                try {
                    const promises = originalMediaList.map(async (mId) => {
                        try {
                            const metaRes = await api.get(`/media/${mId}`);
                            const mimeType = metaRes.data?.mimeType || "";
                            const isVideo = mimeType.startsWith("video/");

                            if (isVideo) {
                                return { id: mId, url: "", isVideo: true };
                            } else {
                                const res = await api.get(`/media/file/${mId}?variant=medium`, { responseType: "blob" });
                                const objUrl = URL.createObjectURL(res.data);
                                createdObjectUrls.push(objUrl);
                                return { id: mId, url: objUrl, isVideo: false };
                            }
                        } catch (err) {
                            return null;
                        }
                    });
                    const results = await Promise.all(promises);
                    setOriginalMediaItems(results.filter(Boolean));
                } catch (error) {
                    console.error("❌ Lỗi lấy media bài gốc:", error.message);
                } finally {
                    setIsLoadingOriginalMedia(false);
                }
            } else {
                setOriginalMediaItems([]);
                setIsLoadingOriginalMedia(false);
            }
        };
        fetchOriginalMedia();

        return () => {
            createdObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [originalPost]);

    // 3. Tải danh sách bình luận khi mở khung accordion
    useEffect(() => {
        if (showComments) {
            const fetchComments = async () => {
                setIsLoadingComments(true);
                try {
                    const res = await api.get(`/posts/${post.id}/comments`);
                    if (res.data && res.data.success) {
                        setComments(res.data.data || []);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy danh sách bình luận:", error.message);
                } finally {
                    setIsLoadingComments(false);
                }
            };
            fetchComments();
        }
    }, [showComments, post.id]);

    // 4. Thích / Bỏ thích bài đăng
    const handleLike = async () => {
        try {
            const res = await api.post(`/posts/${post.id}/like`);
            if (res.data && res.data.success) {
                setIsLiked(!isLiked);
                setLikeCount(prev => (isLiked ? prev - 1 : prev + 1));
            }
        } catch (error) {
            console.error("❌ Lỗi thích bài viết:", error);
        }
    };

    // 5. Gửi bình luận mới
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        let finalContent = commentText.trim();
        if (replyingTo) {
            const replyAuthor = replyingTo.author;
            const parentId = replyingTo.id || replyingTo._id;
            // Nếu phản hồi chính mình (cùng ID hoặc cùng tên hiển thị)
            if (replyingTo.author_id === currentUserId || replyAuthor?.id === currentUserId || replyAuthor?.displayName === currentUser?.displayName) {
                finalContent = `[reply:${parentId}] ${commentText.trim()}`;
            } else {
                finalContent = `[reply:${parentId}:@${replyAuthor?.displayName || "Người dùng"}] ${commentText.trim()}`;
            }
        }

        setIsSubmittingComment(true);
        try {
            const res = await api.post(`/posts/${post.id}/comments`, {
                content: finalContent
            });

            if (res.data && res.data.success) {
                // Thêm trực tiếp vào danh sách bình luận hiển thị
                setComments(prev => [...prev, res.data.data]);
                setCommentText("");
                setReplyingTo(null); // Reset trạng thái phản hồi
                setCommentCount(prev => prev + 1);
            }
        } catch (error) {
            console.error("❌ Lỗi khi gửi bình luận:", error);
            alert("Lỗi khi gửi bình luận!");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // 6. Xóa bình luận
    const handleDeleteComment = async (commentId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;

        try {
            const res = await api.delete(`/posts/${post.id}/comments/${commentId}`);
            if (res.data && res.data.success) {
                setComments(prev => prev.filter(c => c.id !== commentId && c._id !== commentId));
                setCommentCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error("❌ Lỗi khi xóa bình luận:", error);
            alert("Lỗi khi xóa bình luận!");
        }
    };

    // 7. Xử lý chia sẻ thành công từ ShareModal
    const handleShareSuccess = (newPost) => {
        setShareCount(prev => prev + 1);
        if (onPostShared) {
            onPostShared(newPost); // Thêm bài chia sẻ lên đầu Feed
        }
    };

    // 8. Xóa bài viết cá nhân
    const handleDeletePost = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;
        try {
            const res = await api.delete(`/posts/${post.id}`);
            if (res.data && res.data.success) {
                if (onPostDeleted) {
                    onPostDeleted(post.id);
                }
            }
        } catch (error) {
            console.error("❌ Lỗi khi xóa bài viết:", error);
            alert("Không thể xóa bài viết!");
        }
    };

    // 9. Nhận phản hồi cập nhật từ EditPostModal
    const handlePostUpdated = (updatedPost) => {
        const mergedPost = {
            ...updatedPost,
            author: post.author,
            isLikedByMe: isLiked,
            like_count: likeCount,
            comment_count: commentCount,
            share_count: shareCount
        };
        if (onPostUpdated) {
            onPostUpdated(mergedPost);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm mb-4 md:mb-6">
            {/* Header: Thông tin tác giả - Click để về trang cá nhân */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <Link to={`/profile/${post.author_id}`} className="block group">
                        <img
                            src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt="Author Avatar"
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover group-hover:opacity-85 transition"
                        />
                    </Link>
                    <div>
                        <Link to={`/profile/${post.author_id}`} className="font-semibold text-slate-800 text-sm hover:text-blue-600 transition">
                            {post.author?.displayName || "Người dùng SocialHub"}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(post.created_at || post.createdAt).toLocaleString()}</p>
                    </div>
                </div>

                {/* Nút sửa/xóa bài đăng (chỉ hiển thị nếu là chủ nhân bài đăng) */}
                {post.author_id === currentUserId && (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-650 rounded-xl transition cursor-pointer"
                            title="Sửa bài viết"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleDeletePost}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                            title="Xóa bài viết"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Nội dung chữ */}
            <p className="text-slate-700 text-base mb-4 leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Khung hiển thị đa phương tiện (Ảnh & Video Grid) */}
            {mediaItems.length > 0 && (
                <div className={`grid gap-2 rounded-2xl overflow-hidden border border-slate-200 mb-4 bg-slate-50 ${
                    mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}>
                    {mediaItems.map((item, idx) => (
                        <div key={item.id} className="relative overflow-hidden flex items-center justify-center bg-black/5 rounded-xl">
                            {item.isVideo ? (
                                <HlsVideoPlayer mediaId={item.id} controls autoPlay={false} className="w-full max-h-[450px] object-cover rounded-xl" />
                            ) : (
                                <img
                                    src={item.url}
                                    alt="Post Attachment"
                                    className="w-full max-h-[450px] object-cover hover:opacity-95 transition cursor-pointer"
                                    onClick={() => handleOpenLightbox(idx, mediaItems)}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}
            {isLoadingMedia && (
                <div className="h-48 bg-slate-50 animate-pulse rounded-xl flex items-center justify-center text-slate-400 mb-4">
                    Đang tải đa phương tiện...
                </div>
            )}

            {/* Nếu là bài chia sẻ, hiển thị bài gốc nhúng lồng bên trong (Nested Card) */}
            {post.is_shared && (post.original_post_id || post.original_reel_id) && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 mb-4 space-y-3 hover:border-blue-500/30 transition">
                    {isLoadingOriginal ? (
                        <div className="flex justify-center py-4">
                            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                    ) : originalPost ? (
                        <>
                            {/* Header bài gốc - Click để dẫn về trang cá nhân của tác giả gốc */}
                            <div className="flex items-center space-x-2.5">
                                <Link to={`/profile/${originalPost.author_id}`} className="block group">
                                    <img
                                        src={originalPost.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        className="w-7 h-7 rounded-full border border-slate-200 object-cover group-hover:opacity-85 transition"
                                        alt="Original Author"
                                    />
                                </Link>
                                <div>
                                    <Link to={`/profile/${originalPost.author_id}`} className="font-semibold text-slate-800 text-xs hover:text-blue-600 transition">
                                        {originalPost.author?.displayName}
                                    </Link>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(originalPost.created_at || originalPost.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Nội dung chữ bài gốc */}
                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{originalPost.content}</p>
                            {/* Các tệp Media đính kèm bài gốc */}
                            {originalMediaItems.length > 0 && (
                                <div className={`grid gap-1.5 rounded-xl overflow-hidden border border-slate-200 mt-2 bg-slate-50 max-w-lg ${
                                    originalMediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                }`}>
                                    {originalMediaItems.map((item, idx) => (
                                        <div key={item.id} className="relative overflow-hidden flex items-center justify-center bg-black/5 rounded-lg max-h-48">
                                            {item.isVideo ? (
                                                <HlsVideoPlayer mediaId={item.id} controls autoPlay={false} className="w-full max-h-48 object-cover rounded-lg" />
                                            ) : (
                                                <img
                                                    src={item.url}
                                                    alt="Original Attachment"
                                                    className="w-full max-h-48 object-cover hover:opacity-95 transition cursor-pointer"
                                                    onClick={() => handleOpenLightbox(idx, originalMediaItems)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {isLoadingOriginalMedia && (
                                <div className="h-24 bg-slate-50 animate-pulse rounded-xl flex items-center justify-center text-[10px] text-slate-400 mt-2">
                                    Đang tải đa phương tiện bài gốc...
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-slate-400 text-xs italic">Bài viết gốc đã bị xóa hoặc không thể truy cập.</p>
                    )}
                </div>
            )}

            {/* Footer tương tác */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-slate-500 text-xs md:text-sm">
                {/* Nút Thích */}
                <button
                    onClick={handleLike}
                    className={`flex items-center space-x-1 md:space-x-2 hover:text-rose-500 transition cursor-pointer ${isLiked ? "text-rose-600 font-bold" : ""}`}
                >
                    <Heart className={`w-4 h-4 md:w-5 md:h-5 ${isLiked ? "fill-rose-600" : ""}`} />
                    <span>{likeCount} <span className="hidden sm:inline">Thích</span></span>
                </button>

                {/* Nút Bình luận */}
                <button
                    onClick={() => setShowComments(!showComments)}
                    className={`flex items-center space-x-1 md:space-x-2 hover:text-blue-600 transition cursor-pointer ${showComments ? "text-blue-600 font-bold" : ""}`}
                >
                    <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
                    <span>{commentCount} <span className="hidden sm:inline">Bình luận</span></span>
                </button>

                {/* Nút Chia sẻ */}
                <button
                    onClick={() => setShowShareModal(true)}
                    className="flex items-center space-x-1 md:space-x-2 hover:text-blue-600 transition cursor-pointer"
                >
                    <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                    <span>{shareCount} <span className="hidden sm:inline">Chia sẻ</span></span>
                </button>
            </div>

            {/* BẢNG BÌNH LUẬN ACCORDION */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fadeIn">
                    {/* Banner hiển thị đang phản hồi ai */}
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-1.5 text-[10px] text-blue-700">
                            <span>Đang Phản hồi <strong>{replyingTo.author?.displayName}</strong></span>
                            <button
                                type="button"
                                onClick={() => setReplyingTo(null)}
                                className="text-slate-500 hover:text-red-500 font-bold transition ml-2 cursor-pointer"
                            >
                                Hủy
                            </button>
                        </div>
                    )}

                    {/* Ô nhập bình luận */}
                    <form onSubmit={handleAddComment} className="flex items-center space-x-3">
                        <input
                            ref={commentInputRef}
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={replyingTo ? `Phản hồi ${replyingTo.author?.displayName}...` : "Viết bình luận..."}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition"
                        />
                        <button
                            type="submit"
                            disabled={isSubmittingComment || !commentText.trim()}
                            className="p-2 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition"
                        >
                            {isSubmittingComment ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </form>

                    {/* Danh sách bình luận */}
                    {isLoadingComments ? (
                        <div className="flex justify-center py-4">
                            <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                        </div>
                    ) : comments.length > 0 ? (
                        <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                            {(() => {
                                const { parents, repliesByParent } = getStructuredComments();
                                
                                return parents.map((parentComment) => {
                                    const parentId = parentComment.id || parentComment._id;
                                    const isParentAuthor = parentComment.author_id === currentUserId;
                                    const isPostAuthor = post.author_id === currentUserId;
                                    const parentReplies = repliesByParent[parentId] || [];

                                    return (
                                        <div key={parentId} className="space-y-2">
                                            {/* Bình luận gốc */}
                                            <div className="flex items-start justify-between bg-slate-50/50 rounded-2xl p-3 border border-slate-100 group transition-all duration-200">
                                                <div className="flex items-start space-x-3">
                                                    <img
                                                        src={parentComment.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                        className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                                                        alt="Commenter Avatar"
                                                    />
                                                    <div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="font-bold text-slate-800 text-xs">{parentComment.author?.displayName}</span>
                                                            <span className="text-[10px] text-slate-500">{new Date(parentComment.created_at || parentComment.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-slate-600 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                                                            {parentComment.parsedInfo?.mentionName ? (
                                                                <span>
                                                                    <span className="text-blue-600 font-semibold cursor-pointer hover:underline mr-1.5">
                                                                        @{parentComment.parsedInfo.mentionName}
                                                                    </span>
                                                                    {parentComment.parsedInfo.cleanText}
                                                                </span>
                                                            ) : (
                                                                parentComment.parsedInfo?.cleanText || parentComment.content
                                                            )}
                                                        </p>
                                                        
                                                        {/* Nút Phản hồi */}
                                                        <button
                                                            onClick={() => handleReplyClick(parentComment)}
                                                            className="text-[10px] text-slate-500 hover:text-blue-600 font-semibold mt-1 transition cursor-pointer"
                                                        >
                                                            Phản hồi
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Nút xóa bình luận cha */}
                                                {(isParentAuthor || isPostAuthor) && (
                                                    <button
                                                        onClick={() => handleDeleteComment(parentId)}
                                                        className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Danh sách các phản hồi lồng dưới */}
                                            {parentReplies.map((reply) => {
                                                const rId = reply.id || reply._id;
                                                const isReplyAuthor = reply.author_id === currentUserId;
                                                
                                                return (
                                                    <div key={rId} className="flex items-start justify-between bg-blue-50/40 rounded-2xl p-3 border border-blue-100/50 ml-8 group transition-all duration-200">
                                                        <div className="flex items-start space-x-3">
                                                            <img
                                                                src={reply.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                                                                alt="Commenter Avatar"
                                                            />
                                                            <div>
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-bold text-slate-800 text-xs">{reply.author?.displayName}</span>
                                                                    <span className="text-[10px] text-slate-500">{new Date(reply.created_at || reply.createdAt).toLocaleString()}</span>
                                                                </div>
                                                                <p className="text-slate-600 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                                                                    {reply.parsedInfo?.mentionName ? (
                                                                        <span>
                                                                            <span className="text-blue-600 font-semibold cursor-pointer hover:underline mr-1.5">
                                                                                @{reply.parsedInfo.mentionName}
                                                                            </span>
                                                                            {reply.parsedInfo.cleanText}
                                                                        </span>
                                                                    ) : (
                                                                        reply.parsedInfo?.cleanText || reply.content
                                                                    )}
                                                                </p>
                                                                
                                                                {/* Nút Phản hồi (để phản hồi tiếp trên cùng nhánh cha) */}
                                                                <button
                                                                    onClick={() => handleReplyClick(parentComment)}
                                                                    className="text-[10px] text-slate-500 hover:text-blue-600 font-semibold mt-1 transition cursor-pointer"
                                                                >
                                                                    Phản hồi
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Nút xóa phản hồi */}
                                                        {(isReplyAuthor || isPostAuthor) && (
                                                            <button
                                                                onClick={() => handleDeleteComment(rId)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <p className="text-center text-slate-400 text-xs py-4">Chưa có bình luận nào. Hãy gửi lời bình luận đầu tiên!</p>
                    )}
                </div>
            )}

            {/* POP-UP MODAL CHIA SẺ BÀI VIẾT */}
            {showShareModal && (
                <ShareModal
                    post={post}
                    onClose={() => setShowShareModal(false)}
                    onShareSuccess={handleShareSuccess}
                />
            )}

            {/* POP-UP MODAL CHỈNH SỬA BÀI VIẾT */}
            {showEditModal && (
                <EditPostModal
                    post={post}
                    imageUrl={imageUrl}
                    onClose={() => setShowEditModal(false)}
                    onPostUpdated={handlePostUpdated}
                />
            )}

            {/* POP-UP MODAL XEM ẢNH FULLSCREEN */}
            {lightboxData && (
                <ImageLightboxModal
                    images={lightboxData.items}
                    initialIndex={lightboxData.index}
                    onClose={() => setLightboxData(null)}
                />
            )}
        </div>
    );
};

export default PostCard;
