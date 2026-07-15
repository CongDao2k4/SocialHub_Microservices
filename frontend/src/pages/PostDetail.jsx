import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Loader, MessageCircle } from "lucide-react";

const PostDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [post, setPost] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPost = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get(`/posts/${id}`);
            if (res.data && res.data.success) {
                setPost(res.data.data);
            } else {
                setError("Không tìm thấy bài viết hoặc bài viết đã bị xóa.");
            }
        } catch (err) {
            console.error("❌ Lỗi khi tải chi tiết bài viết:", err.message);
            setError("Không tìm thấy bài viết hoặc bài viết đã bị xóa.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchPost();
        }
    }, [id]);

    const handlePostDeleted = (deletedPostId) => {
        if (deletedPostId === id) {
            navigate("/");
        }
    };

    const handlePostUpdated = (updatedPost) => {
        setPost(updatedPost);
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Nút quay lại */}
            <div className="flex items-center space-x-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center space-x-2 text-slate-600 hover:text-blue-600 p-2 rounded-xl hover:bg-slate-200/50 transition cursor-pointer"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-medium text-sm">Quay lại</span>
                </button>
                <h1 className="text-xl font-bold text-slate-800">Chi tiết bài viết</h1>
            </div>

            {/* Content Body */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            ) : error ? (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <MessageCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-700 text-lg font-semibold">{error}</p>
                    <Link
                        to="/"
                        className="inline-block mt-4 text-sm font-medium text-blue-600 hover:underline"
                    >
                        Trở về trang chủ
                    </Link>
                </div>
            ) : post ? (
                <PostCard
                    post={post}
                    currentUserId={user?.id}
                    onPostDeleted={handlePostDeleted}
                    onPostUpdated={handlePostUpdated}
                />
            ) : null}
        </div>
    );
};

export default PostDetail;
