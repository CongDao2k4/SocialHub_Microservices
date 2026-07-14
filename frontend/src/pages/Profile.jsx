import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { Loader, Calendar, Mail, FileText, UserPlus, UserCheck, UserMinus, MessageSquare, Edit3, Camera, Save, X } from "lucide-react";

// Modal chỉnh sửa profile
const EditProfileModal = ({ profileUser, onClose, onProfileUpdated }) => {
    const [displayName, setDisplayName] = useState(profileUser.displayName || "");
    const [bio, setBio] = useState(profileUser.bio || "");
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(profileUser.avatarUrl || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!displayName.trim()) {
            alert("Tên hiển thị không được để trống!");
            return;
        }

        setIsSubmitting(true);
        let uploadedAvatarUrl = profileUser.avatarUrl;

        try {
            // 1. Tải lên avatar mới nếu được chọn
            if (avatarFile) {
                setIsUploading(true);
                const formData = new FormData();
                formData.append("file", avatarFile);
                const uploadRes = await api.post("/media/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                
                if (uploadRes.data && uploadRes.data.id) {
                    uploadedAvatarUrl = `/media/file/${uploadRes.data.id}`;
                }
                setIsUploading(false);
            }

            // 2. Cập nhật profile người dùng qua user-service
            const updateRes = await api.put(`/users/${profileUser.id}`, {
                name: displayName.trim(),
                bio: bio.trim(),
                avatarUrl: uploadedAvatarUrl
            });

            if (updateRes.data && updateRes.data.success) {
                onProfileUpdated(updateRes.data.user);
                onClose();
            }
        } catch (error) {
            console.error("❌ Lỗi khi cập nhật trang cá nhân:", error);
            alert(error.response?.data?.message || "Không thể cập nhật trang cá nhân. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (avatarFile && avatarPreview.startsWith("blob:")) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarFile, avatarPreview]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Chỉnh sửa trang cá nhân</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg hover:bg-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="flex flex-col items-center space-y-2">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <img
                                src={avatarPreview || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                alt="Avatar Preview"
                                className="w-24 h-24 rounded-full object-cover border-2 border-violet-500/50 shadow-md group-hover:opacity-85 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Nhấp để đổi ảnh đại diện</span>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase">Họ và tên</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Nhập tên hiển thị..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-violet-600 transition"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase">Tiểu sử (Bio)</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Giới thiệu ngắn về bản thân..."
                            rows={3}
                            maxLength={200}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-violet-600 transition resize-none"
                        />
                        <span className="block text-[9px] text-right text-slate-400">{bio.length}/200 ký tự</span>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 text-slate-650 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs font-semibold"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || isUploading}
                            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white rounded-xl transition cursor-pointer text-xs font-semibold shadow-md shadow-violet-500/10 flex items-center space-x-1.5 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>{isSubmitting ? (isUploading ? "Đang tải ảnh..." : "Đang lưu...") : "Cập nhật"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Profile = () => {
    const { id } = useParams(); // Lấy ID người dùng từ thanh địa chỉ /profile/:id
    const { user: loggedInUser, setUser } = useAuth();

    const [profileUser, setProfileUser] = useState(null);
    const [userPosts, setUserPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [relation, setRelation] = useState({ status: "none", requestId: null });
    const [showEditModal, setShowEditModal] = useState(false);

    const isOwnProfile = loggedInUser?.id === id;

    // A. Hàm gửi yêu cầu kết bạn
    const handleSendRequest = async () => {
        try {
            const res = await api.post("/friends/request", { toUserId: id });
            if (res.data && res.data.success) {
                setRelation({ status: "pending_sent", requestId: res.data.data.id });
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi gửi yêu cầu!");
        }
    };

    // B. Hàm chấp nhận kết bạn
    const handleAccept = async () => {
        try {
            const res = await api.put(`/friends/requests/${relation.requestId}/accept`);
            if (res.data && res.data.success) {
                setRelation({ status: "friends", requestId: null });
                window.dispatchEvent(new Event("friends-updated"));
            }
        } catch (err) {
            console.error("Chấp nhận kết bạn thất bại:", err);
        }
    };

    // C. Hàm từ chối kết bạn
    const handleReject = async () => {
        try {
            const res = await api.put(`/friends/requests/${relation.requestId}/reject`);
            if (res.data && res.data.success) {
                setRelation({ status: "none", requestId: null });
                window.dispatchEvent(new Event("friends-updated"));
            }
        } catch (err) {
            console.error("Từ chối kết bạn thất bại:", err);
        }
    };

    // D. Hàm hủy kết bạn
    const handleUnfriend = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn hủy kết bạn với người này?")) return;
        try {
            const res = await api.delete(`/friends/${id}`);
            if (res.data && res.data.success) {
                setRelation({ status: "none", requestId: null });
                window.dispatchEvent(new Event("friends-updated"));
            }
        } catch (err) {
            console.error("Hủy kết bạn thất bại:", err);
        }
    };

    // E. Kích hoạt mở ô chat nổi
    const handleStartChat = () => {
        window.dispatchEvent(new CustomEvent("open-chat", {
            detail: {
                id: profileUser.id,
                displayName: profileUser.displayName,
                avatarUrl: profileUser.avatarUrl
            }
        }));
    };

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            try {
                // 1. Lấy thông tin cá nhân của User từ user-service
                const userRes = await api.get(`/users/${id}`);
                if (userRes.data && userRes.data.success) {
                    setProfileUser(userRes.data.user);
                }

                // 2. Lấy danh sách bài viết của User này từ post-service
                const postsRes = await api.get(`/posts/user/${id}`);
                if (postsRes.data && postsRes.data.success) {
                    setUserPosts(postsRes.data.data || []);
                }

                // 3. Nếu không phải trang cá nhân của mình, kiểm tra thêm trạng thái kết bạn
                if (loggedInUser && loggedInUser.id !== id) {
                    const relRes = await api.get(`/friends/check/${id}`);
                    setRelation({
                        status: relRes.data.status,
                        requestId: relRes.data.requestId
                    });
                }
            } catch (error) {
                console.error("❌ Lỗi lấy thông tin trang cá nhân:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [id, loggedInUser]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-24">
                <Loader className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
        );
    }

    if (!profileUser) {
        return (
            <div className="text-center py-12 text-slate-500">
                Không tìm thấy người dùng này hoặc tài khoản đã bị xóa.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Thẻ thông tin tài khoản Glassmorphism */}
            <div className="relative bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden shadow-sm">
                {/* Background phát quang trang cá nhân */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-pink-500/5 rounded-full blur-[96px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    {/* Avatar */}
                    <img
                        src={profileUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Profile Avatar"
                        className="w-28 h-28 rounded-full border-4 border-slate-100 shadow-md object-cover"
                    />

                    {/* Meta Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{profileUser.displayName}</h2>
                            {profileUser.bio ? (
                                <p className="text-slate-655 text-sm mt-2 italic whitespace-pre-line max-w-md">{profileUser.bio}</p>
                            ) : (
                                <p className="text-slate-400 text-sm mt-2 italic">Chưa có tiểu sử.</p>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-6 text-sm text-slate-650">
                            <span className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-violet-500" />
                                <span>{profileUser.email}</span>
                            </span>
                            <span className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-pink-500" />
                                <span>Đã tham gia: {new Date(profileUser.createdAt || Date.now()).toLocaleDateString()}</span>
                            </span>
                        </div>

                        {/* HÀNH ĐỘNG KẾT BẠN / CHAT VỚI NGƯỜI DÙNG KHÁC */}
                        {!isOwnProfile && (
                            <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
                                {/* Khung kết bạn */}
                                {relation.status === "none" && (
                                    <button
                                        onClick={handleSendRequest}
                                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-md shadow-violet-500/10"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span>Thêm bạn bè</span>
                                    </button>
                                )}
                                {relation.status === "pending_sent" && (
                                    <span className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs italic">
                                        Đã gửi yêu cầu kết bạn
                                    </span>
                                )}
                                {relation.status === "pending_received" && (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={handleAccept}
                                            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition"
                                        >
                                            <UserCheck className="w-4 h-4" />
                                            <span>Đồng ý kết bạn</span>
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer transition"
                                        >
                                            Từ chối
                                        </button>
                                    </div>
                                )}
                                {relation.status === "friends" && (
                                    <button
                                        onClick={handleUnfriend}
                                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 rounded-xl text-xs font-semibold cursor-pointer transition"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                        <span>Hủy kết bạn</span>
                                    </button>
                                )}

                                {/* Nút nhắn tin */}
                                <button
                                    onClick={handleStartChat}
                                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition"
                                >
                                    <MessageSquare className="w-4 h-4 text-sky-500" />
                                    <span>Nhắn tin</span>
                                </button>
                            </div>
                        )}

                        {/* Nút chỉnh sửa trang cá nhân cho chính mình */}
                        {isOwnProfile && (
                            <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-750 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-md shadow-violet-500/10"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    <span>Chỉnh sửa trang cá nhân</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Khu vực danh sách bài đăng */}
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-slate-800 border-b border-slate-200 pb-3">
                    <FileText className="w-5 h-5 text-violet-550" />
                    <h3 className="text-xl font-bold">Bài đăng của {isOwnProfile ? "bạn" : profileUser.displayName}</h3>
                    <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600">{userPosts.length}</span>
                </div>

                {userPosts.length > 0 ? (
                    <div className="space-y-6">
                        {userPosts.map((post) => {
                            const handlePostShared = (newSharedPost) => {
                                if (isOwnProfile) {
                                    setUserPosts(prev => [newSharedPost, ...prev]);
                                }
                            };
                            const handlePostDeleted = (deletedPostId) => {
                                setUserPosts(prev => prev.filter(p => p.id !== deletedPostId));
                            };
                            const handlePostUpdated = (updatedPost) => {
                                setUserPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                            };
                            return (
                                <PostCard 
                                    key={post.id} 
                                    post={post} 
                                    currentUserId={loggedInUser?.id} 
                                    onPostShared={handlePostShared} 
                                    onPostDeleted={handlePostDeleted} 
                                    onPostUpdated={handlePostUpdated}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-550 shadow-sm">
                        Chưa đăng tải bài viết nào.
                    </div>
                )}
            </div>

            {/* Modal chỉnh sửa trang cá nhân */}
            {showEditModal && (
                <EditProfileModal
                    profileUser={profileUser}
                    onClose={() => setShowEditModal(false)}
                    onProfileUpdated={(updatedUser) => {
                        setProfileUser(updatedUser);
                        // Cập nhật lên AuthContext
                        setUser(prev => ({
                            ...prev,
                            displayName: updatedUser.displayName,
                            avatarUrl: updatedUser.avatarUrl
                        }));
                    }}
                />
            )}
        </div>
    );
};

export default Profile;
