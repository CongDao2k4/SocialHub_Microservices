import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { Loader, Calendar, Mail, FileText, UserPlus, UserCheck, UserMinus, MessageSquare } from "lucide-react";

const Profile = () => {
    const { id } = useParams(); // Lấy ID người dùng từ thanh địa chỉ /profile/:id
    const { user: loggedInUser } = useAuth();

    const [profileUser, setProfileUser] = useState(null);
    const [userPosts, setUserPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [relation, setRelation] = useState({ status: "none", requestId: null });

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
            <div className="text-center py-12 text-slate-400">
                Không tìm thấy người dùng này hoặc tài khoản đã bị xóa.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Thẻ thông tin tài khoản Glassmorphism */}
            <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 overflow-hidden shadow-xl">
                {/* Background phát quang trang cá nhân */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-pink-500/10 rounded-full blur-[96px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    {/* Avatar */}
                    <img
                        src={profileUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Profile Avatar"
                        className="w-28 h-28 rounded-full border-4 border-white/10 shadow-lg object-cover"
                    />

                    {/* Meta Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">{profileUser.displayName}</h2>
                            <p className="text-slate-400 text-sm mt-1">ID người dùng: {profileUser.id}</p>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-6 text-sm text-slate-300">
                            <span className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-violet-400" />
                                <span>{profileUser.email}</span>
                            </span>
                            <span className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-pink-400" />
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
                                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-md shadow-violet-600/25"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span>Thêm bạn bè</span>
                                    </button>
                                )}
                                {relation.status === "pending_sent" && (
                                    <span className="flex items-center space-x-1.5 px-4 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-xs italic">
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
                                            className="flex items-center space-x-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                                        >
                                            Từ chối
                                        </button>
                                    </div>
                                )}
                                {relation.status === "friends" && (
                                    <button
                                        onClick={handleUnfriend}
                                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-xl text-xs font-semibold cursor-pointer transition"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                        <span>Hủy kết bạn</span>
                                    </button>
                                )}

                                {/* Nút nhắn tin */}
                                <button
                                    onClick={handleStartChat}
                                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition"
                                >
                                    <MessageSquare className="w-4 h-4 text-sky-400" />
                                    <span>Nhắn tin</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Khu vực danh sách bài đăng */}
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-white border-b border-white/10 pb-3">
                    <FileText className="w-5 h-5 text-violet-400" />
                    <h3 className="text-xl font-bold">Bài đăng của {isOwnProfile ? "bạn" : profileUser.displayName}</h3>
                    <span className="bg-white/10 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-300">{userPosts.length}</span>
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
                            return (
                                <PostCard 
                                    key={post.id} 
                                    post={post} 
                                    currentUserId={loggedInUser?.id} 
                                    onPostShared={handlePostShared} 
                                    onPostDeleted={handlePostDeleted} 
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl text-slate-400">
                        Chưa đăng tải bài viết nào.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
