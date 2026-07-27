import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
    Globe, Lock, Users, Shield, Check, Clock, Trash2, 
    MessageCircle, ThumbsUp, Image as ImageIcon, Send, ArrowLeft 
} from "lucide-react";
import api from "../services/api";
import { getMediaFileUrl } from "../services/mediaUrl";
import PostCard from "../components/PostCard";

const GroupDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [posts, setPosts] = useState([]);
    const [pendingPosts, setPendingPosts] = useState([]);
    const [pendingMembers, setPendingMembers] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("posts"); // "posts" | "members" | "moderation"

    // Create post in group state
    const [newPostContent, setNewPostContent] = useState("");
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [mediaIds, setMediaIds] = useState([]);
    const [mediaPreviews, setMediaPreviews] = useState([]);

    useEffect(() => {
        fetchGroupDetails();
    }, [id]);

    const fetchGroupDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/social-groups/${id}`);
            if (res.data && res.data.success) {
                const groupData = res.data.data;
                setGroup(groupData);

                // Fetch posts if public or if user is approved member
                if (groupData.privacy === "public" || groupData.currentUserMemberStatus === "approved") {
                    fetchGroupPosts();
                    fetchGroupMembers();

                    // If user is admin/moderator, fetch moderation details
                    if (groupData.currentUserRole === "admin" || groupData.currentUserRole === "moderator") {
                        fetchPendingPosts();
                        fetchPendingMembers();
                    }
                }
            }
        } catch (err) {
            console.error("❌ Lỗi tải chi tiết nhóm:", err);
            if (err.response?.status === 404) {
                alert("Không tìm thấy nhóm này.");
                navigate("/groups");
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchGroupPosts = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/posts?status=approved`);
            if (res.data && res.data.success) {
                setPosts(res.data.data.posts || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy bài viết nhóm:", err);
        }
    };

    const fetchPendingPosts = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/posts?status=pending`);
            if (res.data && res.data.success) {
                setPendingPosts(res.data.data.posts || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy bài viết chờ duyệt:", err);
        }
    };

    const fetchGroupMembers = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/members?status=approved`);
            if (res.data && res.data.success) {
                setMembers(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy thành viên nhóm:", err);
        }
    };

    const fetchPendingMembers = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/members?status=pending`);
            if (res.data && res.data.success) {
                setPendingMembers(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy thành viên chờ duyệt:", err);
        }
    };

    const handleJoinGroup = async () => {
        try {
            const res = await api.post(`/social-groups/${id}/join`);
            if (res.data && res.data.success) {
                fetchGroupDetails();
            }
        } catch (err) {
            alert("Lỗi tham gia nhóm: " + (err.response?.data?.message || err.message));
        }
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn rời nhóm này?")) return;
        try {
            const res = await api.post(`/social-groups/${id}/leave`);
            if (res.data && res.data.success) {
                fetchGroupDetails();
            }
        } catch (err) {
            alert("Lỗi rời nhóm: " + (err.response?.data?.message || err.message));
        }
    };

    const handleApproveMember = async (userId) => {
        try {
            const res = await api.post(`/social-groups/${id}/members/${userId}/approve`);
            if (res.data && res.data.success) {
                fetchPendingMembers();
                fetchGroupMembers();
                // Update members count locally in group object
                setGroup(prev => ({
                    ...prev,
                    _count: {
                        ...prev._count,
                        members: (prev._count?.members || 0) + 1
                    }
                }));
            }
        } catch (err) {
            alert("Lỗi duyệt thành viên: " + (err.response?.data?.message || err.message));
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?")) return;
        try {
            const res = await api.delete(`/social-groups/${id}/members/${userId}/remove`);
            if (res.data && res.data.success) {
                fetchGroupMembers();
                setGroup(prev => ({
                    ...prev,
                    _count: {
                        ...prev._count,
                        members: Math.max((prev._count?.members || 0) - 1, 1)
                    }
                }));
            }
        } catch (err) {
            alert("Lỗi xóa thành viên: " + (err.response?.data?.message || err.message));
        }
    };

    const handleApprovePost = async (postId) => {
        try {
            const res = await api.post(`/social-groups/${id}/posts/${postId}/approve`);
            if (res.data && res.data.success) {
                fetchPendingPosts();
                fetchGroupPosts();
            }
        } catch (err) {
            alert("Lỗi duyệt bài: " + (err.response?.data?.message || err.message));
        }
    };

    const handleRejectPost = async (postId) => {
        if (!window.confirm("Bạn có chắc chắn muốn từ chối và xóa bài viết này?")) return;
        try {
            const res = await api.post(`/social-groups/${id}/posts/${postId}/reject`);
            if (res.data && res.data.success) {
                fetchPendingPosts();
            }
        } catch (err) {
            alert("Lỗi từ chối bài: " + (err.response?.data?.message || err.message));
        }
    };

    const handleMediaUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadingMedia(true);
        try {
            const uploadedIds = [];
            const previews = [];

            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file);

                const res = await api.post("/media/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                if (res.data && res.data.id) {
                    uploadedIds.push(res.data.id);
                    previews.push(getMediaFileUrl(res.data.id));
                }
            }

            setMediaIds(prev => [...prev, ...uploadedIds]);
            setMediaPreviews(prev => [...prev, ...previews]);
        } catch (err) {
            console.error("❌ Lỗi upload ảnh:", err);
            alert("Không thể tải ảnh lên. Vui lòng thử lại.");
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() && mediaIds.length === 0) return;

        try {
            const res = await api.post(`/social-groups/${id}/posts`, {
                content: newPostContent,
                mediaIds: mediaIds
            });

            if (res.data && res.data.success) {
                setNewPostContent("");
                setMediaIds([]);
                setMediaPreviews([]);
                
                if (res.data.data.status === "pending") {
                    alert("Bài viết của bạn đã được gửi. Đang chờ Admin phê duyệt!");
                } else {
                    fetchGroupPosts();
                }
            }
        } catch (err) {
            console.error("❌ Lỗi đăng bài vào nhóm:", err);
            alert("Không thể đăng bài: " + (err.response?.data?.message || err.message));
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Đang tải dữ liệu nhóm...</p>
            </div>
        );
    }

    if (!group) return null;

    const isAdminOrMod = group.currentUserRole === "admin" || group.currentUserRole === "moderator";
    const isApprovedMember = group.currentUserMemberStatus === "approved";

    return (
        <div className="space-y-6 pb-12">
            {/* Back to list Link */}
            <Link to="/groups" className="inline-flex items-center space-x-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold transition cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách nhóm</span>
            </Link>

            {/* Group Header Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Cover Photo */}
                <div className="h-44 md:h-60 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                    {group.cover_url && (
                        <img src={group.cover_url} alt="Cover" className="w-full h-full object-cover" />
                    )}
                </div>

                {/* Profile Details area */}
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-10 md:-mt-14 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0">
                        <img
                            src={group.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`}
                            alt={group.name}
                            className="w-20 h-20 md:w-28 md:h-28 rounded-2xl object-cover border-4 border-white shadow-md bg-white shrink-0"
                        />
                        <div className="min-w-0 pb-1">
                            <h2 className="text-xl md:text-2xl font-black text-slate-800 truncate">{group.name}</h2>
                            <p className="text-xs md:text-sm text-slate-500 mt-1 flex items-center space-x-2">
                                {group.privacy === "public" ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                <span>Nhóm {group.privacy === "public" ? "Công khai" : "Riêng tư"}</span>
                                <span>•</span>
                                <Users className="w-4 h-4" />
                                <span>{group._count?.members || 0} thành viên</span>
                            </p>
                        </div>
                    </div>

                    {/* Join / Leave Buttons */}
                    <div className="shrink-0 flex items-center space-x-3">
                        {group.currentUserMemberStatus === null ? (
                            <button
                                onClick={handleJoinGroup}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-blue-500/15 active:scale-95 transition cursor-pointer"
                            >
                                Tham gia nhóm
                            </button>
                        ) : group.currentUserMemberStatus === "pending" ? (
                            <div className="flex items-center space-x-1.5 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200">
                                <Clock className="w-4 h-4 animate-pulse" />
                                <span>Đang chờ duyệt vào nhóm</span>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center space-x-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Đã tham gia ({group.currentUserRole === "admin" ? "Admin" : group.currentUserRole === "moderator" ? "Moderator" : "Thành viên"})</span>
                                </span>
                                {group.currentUserRole !== "admin" && (
                                    <button
                                        onClick={handleLeaveGroup}
                                        className="text-slate-500 hover:text-red-600 text-xs font-semibold px-3 py-1.5 border border-slate-200 hover:border-red-200 rounded-lg transition cursor-pointer"
                                    >
                                        Rời nhóm
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Group Description Block */}
                {group.description && (
                    <div className="px-6 md:px-8 pb-6 border-b border-slate-100">
                        <p className="text-slate-600 text-sm leading-relaxed">{group.description}</p>
                    </div>
                )}

                {/* Navigation Tabs */}
                {(group.privacy === "public" || isApprovedMember) && (
                    <div className="flex border-t border-slate-100 px-6 md:px-8 bg-slate-50/50">
                        <button
                            onClick={() => setActiveTab("posts")}
                            className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition cursor-pointer ${activeTab === "posts" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                        >
                            Thảo luận
                        </button>
                        <button
                            onClick={() => setActiveTab("members")}
                            className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition cursor-pointer ${activeTab === "members" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                        >
                            Thành viên ({group._count?.members || 0})
                        </button>
                        {isAdminOrMod && (
                            <button
                                onClick={() => setActiveTab("moderation")}
                                className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${activeTab === "moderation" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                            >
                                <Shield className="w-4 h-4 text-blue-600" />
                                <span>Kiểm duyệt ({pendingPosts.length + pendingMembers.length})</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* TAB CONTENTS */}
            {group.privacy === "private" && !isApprovedMember ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                    <Lock className="w-12 h-12 text-slate-400 mx-auto" />
                    <h3 className="text-lg font-bold text-slate-800">Đây là nhóm Riêng tư (Private)</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto">Chỉ các thành viên đã được phê duyệt mới có thể xem các bài đăng và danh sách thành viên trong nhóm này.</p>
                    {group.currentUserMemberStatus === null && (
                        <button
                            onClick={handleJoinGroup}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl cursor-pointer"
                        >
                            Yêu cầu tham gia nhóm
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Main Area */}
                    <div className="md:col-span-2 space-y-6">
                        {activeTab === "posts" && (
                            <>
                                {/* Create Post block (Only visible for approved members) */}
                                {isApprovedMember && (
                                    <form onSubmit={handleCreatePost} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                        <div className="flex items-start space-x-3.5">
                                            <textarea
                                                placeholder={`Đăng bài viết thảo luận trong nhóm ${group.name}...`}
                                                rows="3"
                                                value={newPostContent}
                                                onChange={(e) => setNewPostContent(e.target.value)}
                                                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 text-slate-800 outline-none placeholder-slate-400 transition text-sm resize-none"
                                            />
                                        </div>

                                        {/* Image Previews */}
                                        {mediaPreviews.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                                                {mediaPreviews.map((src, i) => (
                                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
                                                        <img src={src} className="w-full h-full object-cover" alt="Preview" />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMediaIds(prev => prev.filter((_, idx) => idx !== i));
                                                                setMediaPreviews(prev => prev.filter((_, idx) => idx !== i));
                                                            }}
                                                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black cursor-pointer"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between border-t border-slate-100 pt-3.5">
                                            <label className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition cursor-pointer">
                                                <ImageIcon className="w-5 h-5 text-emerald-500" />
                                                <span className="text-xs font-semibold">Thêm hình ảnh</span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleMediaUpload}
                                                    className="hidden"
                                                />
                                            </label>

                                            <button
                                                type="submit"
                                                disabled={uploadingMedia || (!newPostContent.trim() && mediaIds.length === 0)}
                                                className="flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>{group.post_approval_required && group.currentUserRole === "member" ? "Gửi duyệt bài" : "Đăng bài"}</span>
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Posts List */}
                                <div className="space-y-4">
                                    {posts.length === 0 ? (
                                        <div className="bg-white p-12 text-center border border-slate-200/80 rounded-2xl">
                                            <p className="text-slate-500 text-sm">Chưa có bài viết nào trong nhóm này.</p>
                                        </div>
                                    ) : (
                                        posts.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === "members" && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-slate-800">Danh sách thành viên ({members.length})</h3>
                                <div className="divide-y divide-slate-100">
                                    {members.map((m) => (
                                        <div key={m.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                                            <Link to={`/groups/${id}/user/${m.user_id}`} className="flex items-center space-x-3 cursor-pointer group">
                                                <img
                                                    src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.displayName}`}
                                                    alt={m.displayName}
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200 group-hover:opacity-80 transition"
                                                />
                                                <div>
                                                    <h5 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition">{m.displayName}</h5>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m.role === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' : m.role === 'moderator' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                                                        {m.role === 'admin' ? 'Admin' : m.role === 'moderator' ? 'Moderator' : 'Thành viên'}
                                                    </span>
                                                </div>
                                            </Link>

                                            {/* Action buttons (only for admin) */}
                                            {group.currentUserRole === "admin" && m.user_id !== group.created_by && (
                                                <div className="flex items-center space-x-2">
                                                    <select
                                                        value={m.role}
                                                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                                                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs cursor-pointer outline-none"
                                                    >
                                                        <option value="member">Thành viên</option>
                                                        <option value="moderator">Kiểm duyệt</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleRemoveMember(m.user_id)}
                                                        className="text-red-500 hover:bg-red-50 p-1.5 rounded transition cursor-pointer"
                                                        title="Mời ra khỏi nhóm"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === "moderation" && isAdminOrMod && (
                            <div className="space-y-6">
                                {/* Pending Posts section */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                                        <Shield className="w-5 h-5 text-blue-600" />
                                        <span>Bài viết đang chờ phê duyệt ({pendingPosts.length})</span>
                                    </h3>

                                    {pendingPosts.length === 0 ? (
                                        <p className="text-slate-500 text-sm">Không có bài viết nào đang chờ duyệt.</p>
                                    ) : (
                                        <div className="space-y-6">
                                            {pendingPosts.map((post) => (
                                                <div key={post.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2.5">
                                                            <img
                                                                src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                                className="w-8 h-8 rounded-full border object-cover"
                                                                alt="Author"
                                                            />
                                                            <div>
                                                                <h6 className="font-semibold text-slate-800 text-sm">{post.author?.displayName}</h6>
                                                                <p className="text-[10px] text-slate-400 font-mono">{new Date(post.created_at).toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleApprovePost(post.id)}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                                            >
                                                                Duyệt đăng
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectPost(post.id)}
                                                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                                            >
                                                                Từ chối
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <p className="text-slate-700 text-sm whitespace-pre-wrap">{post.content}</p>

                                                    {post.media_ids && post.media_ids.length > 0 && (
                                                        <div className="grid gap-1.5 grid-cols-2">
                                                            {post.media_ids.map((mediaId, idx) => (
                                                                <img
                                                                    key={idx}
                                                                    src={getMediaFileUrl(mediaId)}
                                                                    alt="Media"
                                                                    className="rounded-xl max-h-48 w-full object-cover border border-slate-200"
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pending Join Requests section */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                                        <Users className="w-5 h-5 text-blue-600" />
                                        <span>Yêu cầu tham gia nhóm chờ duyệt ({pendingMembers.length})</span>
                                    </h3>

                                    {pendingMembers.length === 0 ? (
                                        <p className="text-slate-500 text-sm">Không có yêu cầu tham gia nào đang chờ duyệt.</p>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {pendingMembers.map((m) => (
                                                <div key={m.id} className="flex items-center justify-between py-3">
                                                    <Link to={`/groups/${id}/user/${m.user_id}`} className="flex items-center space-x-3 group">
                                                        <img
                                                            src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.displayName}`}
                                                            alt={m.displayName}
                                                            className="w-10 h-10 rounded-full object-cover border border-slate-200 group-hover:opacity-80 transition"
                                                        />
                                                        <div>
                                                            <h5 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition">{m.displayName}</h5>
                                                            <span className="text-[10px] text-slate-400">Yêu cầu tham gia {new Date(m.joined_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </Link>

                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleApproveMember(m.user_id)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                                        >
                                                            Duyệt tham gia
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveMember(m.user_id)}
                                                            className="text-slate-500 hover:bg-slate-100 text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg transition cursor-pointer"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-6">
                        {/* Rules card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                            <h4 className="font-bold text-slate-800 flex items-center space-x-2">
                                <Shield className="w-5 h-5 text-blue-600" />
                                <span>Quy tắc hoạt động</span>
                            </h4>
                            <ul className="text-slate-600 text-xs space-y-3 leading-relaxed">
                                <li className="flex items-start space-x-2">
                                    <span className="bg-blue-50 text-blue-600 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">1</span>
                                    <span>Tôn trọng ý kiến mọi thành viên trong cộng đồng.</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="bg-blue-50 text-blue-600 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">2</span>
                                    <span>Chia sẻ thông tin hữu ích và không spam quảng cáo.</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="bg-blue-50 text-blue-600 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">3</span>
                                    <span>Mọi bài viết vi phạm sẽ bị xóa và chặn vĩnh viễn.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetail;
