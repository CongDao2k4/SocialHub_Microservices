import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Globe, Lock, Users, BookOpen } from "lucide-react";
import api from "../services/api";
import PostCard from "../components/PostCard";

const GroupUserProfile = () => {
    const { groupId, userId } = useParams();
    const navigate = useNavigate();

    const [group, setGroup] = useState(null);
    const [profileUser, setProfileUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [groupId, userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Lấy thông tin Nhóm
            const groupRes = await api.get(`/social-groups/${groupId}`);
            if (groupRes.data && groupRes.data.success) {
                setGroup(groupRes.data.data);
            }

            // 2. Lấy thông tin thành viên (User Profile) từ user-service
            const userRes = await api.get(`/users/${userId}`);
            if (userRes.data && userRes.data.success) {
                setProfileUser(userRes.data.user);
            }

            // 3. Lấy toàn bộ bài đăng của user này trong group
            const postsRes = await api.get(`/social-groups/${groupId}/posts?authorId=${userId}&status=approved`);
            if (postsRes.data && postsRes.data.success) {
                setPosts(postsRes.data.data.posts || []);
            }
        } catch (err) {
            console.error("❌ Lỗi tải dữ liệu trang thành viên nhóm:", err);
            alert("Không thể tải thông tin thành viên.");
            navigate(`/groups/${groupId}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Đang tải bài viết của thành viên...</p>
            </div>
        );
    }

    if (!group || !profileUser) return null;

    return (
        <div className="space-y-6 pb-12">
            {/* Breadcrumb quay lại nhóm */}
            <Link 
                to={`/groups/${groupId}`} 
                className="inline-flex items-center space-x-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold transition cursor-pointer"
            >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại nhóm {group.name}</span>
            </Link>

            {/* Member Card Summary */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center space-x-4 min-w-0">
                    <img
                        src={profileUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt={profileUser.displayName}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-slate-200"
                    />
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{profileUser.displayName}</h2>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1 flex items-center space-x-2">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            <span>Bài viết trong nhóm <strong>{group.name}</strong></span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                            <span>Có {posts.length} bài đăng thảo luận</span>
                        </p>
                    </div>
                </div>

                {/* View Profile Button */}
                <Link
                    to={`/profile/${userId}`}
                    className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-500/15 active:scale-95 transition cursor-pointer"
                >
                    <User className="w-4 h-4" />
                    <span>View Profile (Trang cá nhân)</span>
                </Link>
            </div>

            {/* Posts Area */}
            <div className="space-y-4 max-w-2xl mx-auto">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Các bài viết đã duyệt ({posts.length})</h3>
                {posts.length === 0 ? (
                    <div className="bg-white p-12 text-center border border-slate-200/80 rounded-2xl">
                        <p className="text-slate-500 text-sm">Thành viên này chưa đăng bài viết nào trong nhóm.</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))
                )}
            </div>
        </div>
    );
};

export default GroupUserProfile;
