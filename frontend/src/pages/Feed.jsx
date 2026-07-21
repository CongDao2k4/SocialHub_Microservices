import { useState, useEffect } from "react";
import api from "../services/api";
import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { Loader, MessageCircle } from "lucide-react";

const Feed = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Tải danh sách bài viết từ post-service qua API Gateway
    const fetchFeed = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/feed");
            if (res.data && res.data.success) {
                setPosts(res.data.data || []);
            }
        } catch (error) {
            console.error("❌ Lỗi lấy bảng tin:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
    }, []);

    // 2. Hàm callback khi đăng bài viết thành công (Chèn bài viết mới lên đầu trang)
    const handlePostCreated = (newPost) => {

        // Gắn thêm profile của chính mình làm author để hiển thị luôn không cần f5
        const postWithAuthor = {
            ...newPost,
            author: {
                id: user.id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
            isLikedByMe: false,
        };
        setPosts((prevPosts) => [postWithAuthor, ...prevPosts]);
    };

    // 3. Hàm callback khi chia sẻ bài đăng thành công (Chèn bài chia sẻ lên đầu trang)
    const handlePostShared = (newSharedPost) => {
        setPosts((prevPosts) => [newSharedPost, ...prevPosts]);
    };

    // 4. Hàm callback khi xóa bài viết thành công (Loại bỏ bài viết ra khỏi feed)
    const handlePostDeleted = (deletedPostId) => {
        setPosts((prevPosts) => prevPosts.filter(p => p.id !== deletedPostId));
    };

    // 5. Hàm callback khi cập nhật bài viết thành công
    const handlePostUpdated = (updatedPost) => {
        setPosts((prevPosts) => prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

    return (
        <div className="space-y-6">
            {/* Tiêu đề trang */}
            <div className="mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Bảng Tin</h1>
                <p className="text-slate-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Cập nhật những hoạt động mới nhất từ bạn bè của bạn.</p>
            </div>

            {/* Hộp đăng bài */}
            <CreatePost onPostCreated={handlePostCreated} />

            {/* Danh sách bài viết */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            ) : posts.length > 0 ? (
                <div className="space-y-6">
                    {posts.map((post) => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            currentUserId={user?.id} 
                            onPostShared={handlePostShared} 
                            onPostDeleted={handlePostDeleted} 
                            onPostUpdated={handlePostUpdated}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <MessageCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-700 text-lg">Chưa có bài viết nào ở đây.</p>
                    <p className="text-slate-500 text-sm mt-1">Hãy là người đầu tiên đăng bài viết hoặc kết bạn mới nhé!</p>
                </div>
            )}
        </div>
    );
};

export default Feed;
