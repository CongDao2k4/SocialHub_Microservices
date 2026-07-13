import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Users, UserPlus, UserCheck, UserMinus, Search, Loader, Sparkles } from "lucide-react";

const Friends = () => {
    const { user: currentUser } = useAuth();

    // Quản lý tab hiện tại: 'requests' | 'list' | 'suggestions'
    const [activeTab, setActiveTab] = useState("requests");

    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    // Quản lý Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchStatuses, setSearchStatuses] = useState({}); // key: userId, value: { status, requestId }
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 1. Tải danh sách lời mời kết bạn (Received requests)
    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/friends/requests?type=received");
            if (res.data && res.data.success) {
                setRequests(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy lời mời kết bạn:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Tải danh sách bạn bè
    const fetchFriends = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/friends");
            if (res.data && res.data.success) {
                setFriends(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy danh sách bạn bè:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Tải danh sách gợi ý bạn bè
    const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/friends/suggestions?limit=10");
            if (res.data && res.data.success) {
                setSuggestions(res.data.suggestions || []);
            }
        } catch (err) {
            console.error("Lỗi lấy gợi ý bạn bè:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Tải toàn bộ danh sách khi mount để cập nhật đúng các con số đếm ngay từ đầu
    useEffect(() => {
        fetchRequests();
        fetchFriends();
        fetchSuggestions();
    }, []);

    // Chỉ xóa ô tìm kiếm khi chuyển Tab
    useEffect(() => {
        setSearchResults([]);
        setSearchQuery("");
    }, [activeTab]);

    // 4. Xử lý tìm kiếm thành viên
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            // Gọi API search của user-service
            const res = await api.get(`/users/search?q=${searchQuery}`);
            if (res.data && res.data.success) {
                const users = res.data.data.filter(u => u.id !== currentUser.id); // Loại trừ chính mình
                setSearchResults(users);

                // Check trạng thái kết bạn cho từng người tìm thấy
                const statusPromises = users.map(async (u) => {
                    const statusRes = await api.get(`/friends/check/${u.id}`);
                    return { userId: u.id, data: statusRes.data };
                });

                const statuses = await Promise.all(statusPromises);
                const statusMap = {};
                statuses.forEach(item => {
                    statusMap[item.userId] = {
                        status: item.data.status, // 'friends' | 'pending_sent' | 'pending_received' | 'none'
                        requestId: item.data.requestId
                    };
                });
                setSearchStatuses(statusMap);
            }
        } catch (err) {
            console.error("Lỗi tìm kiếm người dùng:", err);
        } finally {
            setIsSearching(false);
        }
    };

    // 5. Gửi lời mời kết bạn (Add Friend)
    const handleSendRequest = async (userId) => {
        try {
            const res = await api.post("/friends/request", { toUserId: userId });
            if (res.data && res.data.success) {
                // Cập nhật lại status hiển thị
                setSearchStatuses(prev => ({
                    ...prev,
                    [userId]: { status: "pending_sent", requestId: res.data.data.id }
                }));
                // Cập nhật nếu nằm trong list suggestions
                setSuggestions(prev => prev.filter(s => s.id !== userId));
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi gửi yêu cầu!");
        }
    };

    // 6. Chấp nhận kết bạn (Accept Request)
    const handleAccept = async (requestId, fromUserId) => {
        try {
            const res = await api.put(`/friends/requests/${requestId}/accept`);
            if (res.data && res.data.success) {
                // Lấy thông tin user gửi yêu cầu từ danh sách requests hoặc searchResults hiện tại
                const acceptedRequest = requests.find(r => r.id === requestId);
                let newFriend = null;

                if (acceptedRequest && acceptedRequest.user) {
                    newFriend = {
                        id: fromUserId,
                        displayName: acceptedRequest.user.displayName,
                        avatarUrl: acceptedRequest.user.avatarUrl,
                        email: acceptedRequest.user.email
                    };
                } else {
                    const searchUser = searchResults.find(u => u.id === fromUserId);
                    if (searchUser) {
                        newFriend = {
                            id: fromUserId,
                            displayName: searchUser.displayName,
                            avatarUrl: searchUser.avatarUrl,
                            email: searchUser.email
                        };
                    }
                }

                // Cập nhật ngay lập tức vào danh sách bạn bè (friends state)
                if (newFriend) {
                    setFriends(prev => {
                        // Đảm bảo không trùng lặp
                        if (prev.some(f => f.id === fromUserId)) return prev;
                        return [...prev, newFriend];
                    });
                }

                // Xóa khỏi danh sách lời mời
                setRequests(prev => prev.filter(r => r.id !== requestId));
                
                // Nếu đang ở ô tìm kiếm, cập nhật trạng thái hiển thị
                if (searchStatuses[fromUserId]) {
                    setSearchStatuses(prev => ({
                        ...prev,
                        [fromUserId]: { status: "friends", requestId: null }
                    }));
                }

                // Phát sự kiện đồng bộ sidebar chat
                window.dispatchEvent(new Event("friends-updated"));
            }
        } catch (err) {
            console.error("Chấp nhận kết bạn thất bại:", err);
        }
    };

    // 7. Từ chối yêu cầu (Reject Request)
    const handleReject = async (requestId) => {
        try {
            const res = await api.put(`/friends/requests/${requestId}/reject`);
            if (res.data && res.data.success) {
                setRequests(prev => prev.filter(r => r.id !== requestId));
                // Phát sự kiện đồng bộ
                window.dispatchEvent(new Event("friends-updated"));
            }
        } catch (err) {
            console.error("Từ chối kết bạn thất bại:", err);
        }
    };

    // 8. Hủy kết bạn (Unfriend)
    const handleUnfriend = async (friendId) => {
        if (!window.confirm("Bạn có chắc chắn muốn hủy kết bạn với người này?")) return;
        try {
            const res = await api.delete(`/friends/${friendId}`);
            if (res.data && res.data.success) {
                setFriends(prev => prev.filter(f => f.id !== friendId));
                if (searchStatuses[friendId]) {
                    setSearchStatuses(prev => ({
                        ...prev,
                        [friendId]: { status: "none", requestId: null }
                    }));
                }
                // Phát sự kiện đồng bộ sidebar chat
                window.dispatchEvent(new Event("friends-updated"));
            }
        } catch (err) {
            console.error("Hủy kết bạn thất bại:", err);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header trang */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-violet-400 to-pink-500 bg-clip-text text-transparent">Mạng lưới bạn bè</h1>
                    <p className="text-slate-400 text-sm mt-1">Kết nối, tìm kiếm bạn mới và phê duyệt lời mời kết bạn.</p>
                </div>

                {/* Thanh tìm kiếm người dùng */}
                <form onSubmit={handleSearch} className="relative w-full md:w-80">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm bạn bè bằng tên/email..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm transition"
                    />
                    <button type="submit" className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer">
                        <Search className="w-5 h-5" />
                    </button>
                </form>
            </div>

            {/* HIỂN THỊ KẾT QUẢ TÌM KIẾM (Nếu có gõ tìm kiếm) */}
            {searchResults.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Search className="w-4 h-4 text-violet-400" />
                        <span>Kết quả tìm kiếm ({searchResults.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {searchResults.map(u => {
                            const relation = searchStatuses[u.id] || { status: "none" };
                            return (
                                <div key={u.id} className="flex items-center justify-between p-4 bg-slate-900/40 border border-white/5 rounded-xl">
                                    <Link to={`/profile/${u.id}`} className="flex items-center space-x-3 group cursor-pointer">
                                        <img src={u.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-10 h-10 rounded-full border border-white/10 group-hover:opacity-80 transition object-cover" alt="Avatar" />
                                        <div>
                                            <p className="font-semibold text-white text-sm group-hover:text-violet-400 transition">{u.displayName}</p>
                                            <p className="text-xs text-slate-400">{u.email}</p>
                                        </div>
                                    </Link>

                                    {/* Các nút hành động tương ứng với trạng thái kết bạn */}
                                    {relation.status === "friends" && (
                                        <button onClick={() => handleUnfriend(u.id)} className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs cursor-pointer transition">
                                            <UserMinus className="w-4 h-4" />
                                            <span>Hủy kết bạn</span>
                                        </button>
                                    )}
                                    {relation.status === "pending_sent" && (
                                        <span className="text-xs text-slate-500 italic bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">Đã gửi yêu cầu</span>
                                    )}
                                    {relation.status === "pending_received" && (
                                        <button onClick={() => handleAccept(relation.requestId, u.id)} className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs cursor-pointer transition">
                                            <UserCheck className="w-4 h-4" />
                                            <span>Chấp nhận</span>
                                        </button>
                                    )}
                                    {relation.status === "none" && (
                                        <button onClick={() => handleSendRequest(u.id)} className="flex items-center space-x-1.5 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg text-xs cursor-pointer transition">
                                            <UserPlus className="w-4 h-4" />
                                            <span>Kết bạn</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isSearching && (
                <div className="flex justify-center py-4"><Loader className="w-6 h-6 text-violet-500 animate-spin" /></div>
            )}

            {/* HỆ THỐNG TABS ĐIỀU HƯỚNG CHÍNH */}
            <div className="flex border-b border-white/10">
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`flex items-center space-x-2 px-6 py-3 font-semibold text-sm border-b-2 transition cursor-pointer ${activeTab === "requests" ? "border-violet-500 text-violet-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <span>Lời mời ({requests.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab("list")}
                    className={`flex items-center space-x-2 px-6 py-3 font-semibold text-sm border-b-2 transition cursor-pointer ${activeTab === "list" ? "border-violet-500 text-violet-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <span>Danh sách bạn bè ({friends.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab("suggestions")}
                    className={`flex items-center space-x-2 px-6 py-3 font-semibold text-sm border-b-2 transition cursor-pointer ${activeTab === "suggestions" ? "border-violet-500 text-violet-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span>Gợi ý bạn bè</span>
                </button>
            </div>

            {/* NỘI DUNG HIỂN THỊ CHO TỪNG TAB */}
            {isLoading ? (
                <div className="flex justify-center py-12"><Loader className="w-8 h-8 text-violet-500 animate-spin" /></div>
            ) : (
                <div className="min-h-[200px]">
                    {/* TAB 1: LỜI MỜI ĐÃ NHẬN */}
                    {activeTab === "requests" && (
                        requests.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                                {requests.map(r => (
                                    <div key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                                        <Link to={`/profile/${r.fromUserId}`} className="flex items-center space-x-3 group cursor-pointer">
                                            <img src={r.user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-12 h-12 rounded-full border border-white/10 group-hover:opacity-80 transition object-cover" alt="Avatar" />
                                            <div>
                                                <p className="font-bold text-white group-hover:text-violet-400 transition">{r.user?.displayName}</p>
                                                <p className="text-xs text-slate-400">Gửi lúc: {new Date(r.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </Link>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleAccept(r.id, r.fromUserId)}
                                                className="px-3.5 py-2 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition hover:opacity-90"
                                            >
                                                Đồng ý
                                            </button>
                                            <button
                                                onClick={() => handleReject(r.id)}
                                                className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                                            >
                                                Từ chối
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 text-sm">Hộp thư trống. Không có lời mời kết bạn nào!</div>
                        )
                    )}

                    {/* TAB 2: DANH SÁCH BẠN BÈ */}
                    {activeTab === "list" && (
                        friends.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                                {friends.map(f => (
                                    <div key={f.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
                                        <Link to={`/profile/${f.id}`} className="group block cursor-pointer">
                                            <img src={f.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-16 h-16 rounded-full border-2 border-violet-500/20 group-hover:opacity-80 transition object-cover" alt="Avatar" />
                                        </Link>
                                        <div>
                                            <Link to={`/profile/${f.id}`} className="font-bold text-white text-sm hover:text-violet-400 transition block truncate max-w-[150px]">{f.displayName}</Link>
                                            <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{f.email}</p>
                                        </div>
                                        <button
                                            onClick={() => handleUnfriend(f.id)}
                                            className="w-full flex items-center justify-center space-x-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs cursor-pointer transition"
                                        >
                                            <UserMinus className="w-3.5 h-3.5" />
                                            <span>Hủy kết bạn</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 text-sm">Bạn chưa kết bạn với ai. Hãy dùng ô tìm kiếm để tìm bạn bè mới nhé!</div>
                        )
                    )}

                    {/* TAB 3: GỢI Ý BẠN BÈ */}
                    {activeTab === "suggestions" && (
                        suggestions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                                {suggestions.map(s => (
                                    <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                                        <Link to={`/profile/${s.id}`} className="flex items-center space-x-3 group cursor-pointer">
                                            <img src={s.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-12 h-12 rounded-full border border-white/10 group-hover:opacity-80 transition object-cover" alt="Avatar" />
                                            <div>
                                                <p className="font-bold text-white group-hover:text-violet-400 transition">{s.displayName}</p>
                                                <p className="text-xs text-violet-400 font-medium">{s.mutualFriendCount} bạn chung</p>
                                            </div>
                                        </Link>
                                        <button
                                            onClick={() => handleSendRequest(s.id)}
                                            className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                                        >
                                            Thêm bạn
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 text-sm">Chưa tìm thấy gợi ý bạn bè phù hợp dựa trên bạn chung.</div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default Friends;
