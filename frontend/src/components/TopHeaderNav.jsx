import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { formatRelativeTime } from "../utils/dateUtils";
import { 
    Users, 
    MessageSquare, 
    Bell, 
    Check, 
    X, 
    Heart, 
    UserPlus, 
    UserCheck, 
    Share2, 
    Loader, 
    CheckCheck,
    ChevronRight,
    Sparkles
} from "lucide-react";

const TopHeaderNav = () => {
    const { user } = useAuth();
    const { unreadCount, setUnreadCount, onlineUsers } = useSocket();
    const navigate = useNavigate();

    // Quản lý dropdown đang mở: 'friends' | 'messages' | 'notifications' | null
    const [activeDropdown, setActiveDropdown] = useState(null);

    // State dữ liệu Bạn bè
    const [friendRequests, setFriendRequests] = useState([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [processingRequestId, setProcessingRequestId] = useState(null);

    // State dữ liệu Tin nhắn
    const [conversations, setConversations] = useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // State dữ liệu Thông báo
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

    const containerRef = useRef(null);

    // Click ngoài để tự đóng dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 1. Tải Lời mời kết bạn
    const fetchFriendRequests = async () => {
        setIsLoadingFriends(true);
        try {
            const res = await api.get("/friends/requests?type=received");
            if (res.data && res.data.success) {
                setFriendRequests(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy lời mời kết bạn:", err);
        } finally {
            setIsLoadingFriends(false);
        }
    };

    // 2. Tải Cuộc trò chuyện gần đây
    const fetchConversations = async () => {
        setIsLoadingMessages(true);
        try {
            const res = await api.get("/conversations?page=1&limit=6");
            if (res.data && res.data.success) {
                setConversations(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy cuộc hội thoại:", err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // 3. Tải Thông báo
    const fetchNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const res = await api.get("/notifications");
            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy danh sách thông báo:", err);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    // Lắng nghe sự kiện thông báo realtime
    useEffect(() => {
        const handleNewNotification = (e) => {
            const newNotif = e.detail;
            setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
            });
        };
        window.addEventListener("notification-received", handleNewNotification);
        return () => window.removeEventListener("notification-received", handleNewNotification);
    }, []);

    // Bật/Tắt Dropdown
    const toggleDropdown = (name) => {
        if (activeDropdown === name) {
            setActiveDropdown(null);
            return;
        }

        setActiveDropdown(name);
        if (name === "friends") fetchFriendRequests();
        if (name === "messages") fetchConversations();
        if (name === "notifications") fetchNotifications();
    };

    // Chấp nhận lời mời kết bạn
    const handleAcceptRequest = async (e, requestId) => {
        e.stopPropagation();
        setProcessingRequestId(requestId);
        try {
            const res = await api.put(`/friends/requests/${requestId}/accept`);
            if (res.data && res.data.success) {
                setFriendRequests(prev => prev.filter(req => req.id !== requestId));
                window.dispatchEvent(new CustomEvent("friends-updated"));
            }
        } catch (err) {
            console.error("Lỗi chấp nhận lời mời:", err);
        } finally {
            setProcessingRequestId(null);
        }
    };

    // Từ chối lời mời kết bạn
    const handleRejectRequest = async (e, requestId) => {
        e.stopPropagation();
        setProcessingRequestId(requestId);
        try {
            const res = await api.put(`/friends/requests/${requestId}/reject`);
            if (res.data && res.data.success) {
                setFriendRequests(prev => prev.filter(req => req.id !== requestId));
            }
        } catch (err) {
            console.error("Lỗi từ chối lời mời:", err);
        } finally {
            setProcessingRequestId(null);
        }
    };

    // Mở khung chat khi click vào cuộc hội thoại
    const handleSelectConversation = (conv) => {
        setActiveDropdown(null);
        window.dispatchEvent(new CustomEvent("open-chat-conversation", { detail: conv }));
    };

    // Đánh dấu 1 thông báo đã đọc và điều hướng
    const handleNotificationClick = async (notif) => {
        setActiveDropdown(null);
        if (!notif.isRead) {
            try {
                const res = await api.put(`/notifications/${notif.id}/read`);
                if (res.data && res.data.success) {
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
            } catch (err) {
                console.error("Lỗi đánh dấu đã đọc:", err);
            }
        }

        // Điều hướng
        if (notif.type === "friend_request") {
            navigate("/friends");
        } else if (notif.type === "friend_accepted" && notif.fromUser?.id) {
            navigate(`/profile/${notif.fromUser.id}`);
        } else if (notif.referenceId) {
            navigate(`/post/${notif.referenceId}`);
        } else {
            navigate("/");
        }
    };

    // Đánh dấu tất cả thông báo là đã đọc
    const handleMarkAllNotificationsRead = async () => {
        try {
            const res = await api.put("/notifications/read-all");
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (err) {
            console.error("Lỗi đọc tất cả thông báo:", err);
        }
    };

    // Helper format thời gian tương đối
    const formatTimeAgo = (dateString) => {
        if (!dateString) return "";
        try {
            return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: vi });
        } catch {
            return "";
        }
    };

    // Helper icon theo loại thông báo
    const getNotificationIcon = (type) => {
        switch (type) {
            case "post_liked":
                return <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />;
            case "post_commented":
                return <MessageSquare className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />;
            case "friend_request":
                return <UserPlus className="w-3.5 h-3.5 text-indigo-500" />;
            case "friend_accepted":
                return <UserCheck className="w-3.5 h-3.5 text-emerald-500" />;
            case "post_shared":
                return <Share2 className="w-3.5 h-3.5 text-purple-500" />;
            default:
                return <Bell className="w-3.5 h-3.5 text-blue-500" />;
        }
    };

    return (
        <div ref={containerRef} className="relative flex items-center space-x-2 sm:space-x-3">
            
            {/* ------------------------------------------------------------- */}
            {/* 1. ICON BẠN BÈ (Friends Icon - Leftmost) */}
            {/* ------------------------------------------------------------- */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown("friends")}
                    className={`relative p-2.5 rounded-full transition-all duration-200 cursor-pointer shadow-sm ${
                        activeDropdown === "friends"
                            ? "bg-blue-600 text-white shadow-blue-500/30 scale-105"
                            : "bg-slate-100/80 hover:bg-slate-200/90 text-slate-700 hover:text-blue-600 active:scale-95"
                    }`}
                    title="Lời mời kết bạn"
                >
                    <Users className="w-5 h-5" />
                    {friendRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-md ring-2 ring-white">
                            {friendRequests.length > 9 ? "9+" : friendRequests.length}
                        </span>
                    )}
                </button>

                {/* Dropdown Lời Mời Kết Bạn */}
                {activeDropdown === "friends" && (
                    <div className="absolute right-0 sm:right-auto sm:left-0 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-300/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center space-x-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                <h3 className="font-bold text-slate-800 text-sm">Lời mời kết bạn</h3>
                                {friendRequests.length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        {friendRequests.length}
                                    </span>
                                )}
                            </div>
                            <Link 
                                to="/friends" 
                                onClick={() => setActiveDropdown(null)} 
                                className="text-xs text-blue-600 hover:underline font-medium flex items-center"
                            >
                                Xem tất cả <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
                            {isLoadingFriends ? (
                                <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                                    <Loader className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                                    <span className="text-xs">Đang tải lời mời...</span>
                                </div>
                            ) : friendRequests.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">Không có lời mời kết bạn mới</p>
                                    <p className="text-xs text-slate-400 mt-1">Các yêu cầu kết bạn mới sẽ hiển thị tại đây.</p>
                                </div>
                            ) : (
                                friendRequests.map((req) => {
                                    const sender = req.sender || {};
                                    return (
                                        <div 
                                            key={req.id} 
                                            className="p-3.5 hover:bg-slate-50/80 transition flex items-center justify-between space-x-3"
                                        >
                                            <Link 
                                                to={`/profile/${sender.id}`} 
                                                onClick={() => setActiveDropdown(null)} 
                                                className="flex items-center space-x-3 flex-1 min-w-0"
                                            >
                                                <img 
                                                    src={sender.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} 
                                                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0" 
                                                    alt="Avatar" 
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-sm text-slate-800 hover:text-blue-600 truncate">
                                                        {sender.displayName || "Người dùng"}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        {formatTimeAgo(req.createdAt)}
                                                    </p>
                                                </div>
                                            </Link>

                                            <div className="flex items-center space-x-1.5 shrink-0">
                                                {processingRequestId === req.id ? (
                                                    <Loader className="w-4 h-4 animate-spin text-blue-600" />
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleAcceptRequest(e, req.id)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-sm hover:shadow active:scale-95 cursor-pointer"
                                                        >
                                                            Đồng ý
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectRequest(e, req.id)}
                                                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition active:scale-95 cursor-pointer"
                                                        >
                                                            Xóa
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 2. ICON TIN NHẮN (Messages Icon - Middle) */}
            {/* ------------------------------------------------------------- */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown("messages")}
                    className={`relative p-2.5 rounded-full transition-all duration-200 cursor-pointer shadow-sm ${
                        activeDropdown === "messages"
                            ? "bg-blue-600 text-white shadow-blue-500/30 scale-105"
                            : "bg-slate-100/80 hover:bg-slate-200/90 text-slate-700 hover:text-blue-600 active:scale-95"
                    }`}
                    title="Tin nhắn"
                >
                    <MessageSquare className="w-5 h-5" />
                </button>

                {/* Dropdown Hộp Thư Tin Nhắn */}
                {activeDropdown === "messages" && (
                    <div className="absolute right-0 sm:right-auto sm:-left-20 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-300/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center space-x-2">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <h3 className="font-bold text-slate-800 text-sm">Tin nhắn gần đây</h3>
                            </div>
                            <Link 
                                to="/messages" 
                                onClick={() => setActiveDropdown(null)} 
                                className="text-xs text-blue-600 hover:underline font-medium flex items-center"
                            >
                                Tất cả cuộc gọi <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
                            {isLoadingMessages ? (
                                <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                                    <Loader className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                                    <span className="text-xs">Đang tải tin nhắn...</span>
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">Chưa có tin nhắn nào</p>
                                    <p className="text-xs text-slate-400 mt-1">Bắt đầu trò chuyện với bạn bè ngay!</p>
                                </div>
                            ) : (
                                conversations.map((conv) => {
                                    const isGroup = conv.isGroup;
                                    let avatar = "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
                                    let name = "Cuộc trò chuyện";
                                    let partnerId = null;

                                    if (isGroup) {
                                        name = conv.name || "Nhóm trò chuyện";
                                        avatar = `https://api.dicebear.com/7.x/shapes/svg?seed=${conv.id || conv._id}`;
                                    } else {
                                        const otherMember = conv.participants?.find(p => (p.userId || p.id) !== user?.id);
                                        if (otherMember) {
                                            name = otherMember.displayName || otherMember.name || "Bạn bè";
                                            avatar = otherMember.avatarUrl || avatar;
                                            partnerId = otherMember.userId || otherMember.id;
                                        }
                                    }

                                    const isOnline = partnerId && onlineUsers.includes(partnerId);

                                    return (
                                        <div
                                            key={conv.id || conv._id}
                                            onClick={() => handleSelectConversation(conv)}
                                            className="p-3 hover:bg-slate-50 transition cursor-pointer flex items-center space-x-3 group"
                                        >
                                            <div className="relative shrink-0">
                                                <img 
                                                    src={avatar} 
                                                    className="w-11 h-11 rounded-full object-cover border border-slate-200" 
                                                    alt="Avatar" 
                                                />
                                                {isOnline && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-sm text-slate-800 group-hover:text-blue-600 truncate">
                                                        {name}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                                        {formatTimeAgo(conv.updatedAt || conv.lastMessageAt)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                                    {conv.lastMessage?.content || "Nhấn để bắt đầu trò chuyện"}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 3. ICON THÔNG BÁO (Notifications Icon - Rightmost) */}
            {/* ------------------------------------------------------------- */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown("notifications")}
                    className={`relative p-2.5 rounded-full transition-all duration-200 cursor-pointer shadow-sm ${
                        activeDropdown === "notifications"
                            ? "bg-blue-600 text-white shadow-blue-500/30 scale-105"
                            : "bg-slate-100/80 hover:bg-slate-200/90 text-slate-700 hover:text-blue-600 active:scale-95"
                    }`}
                    title="Thông báo"
                >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-md ring-2 ring-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown Danh Sách Thông Báo */}
                {activeDropdown === "notifications" && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-300/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center space-x-2">
                                <Bell className="w-4 h-4 text-blue-600" />
                                <h3 className="font-bold text-slate-800 text-sm">Thông báo</h3>
                                {unreadCount > 0 && (
                                    <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        {unreadCount} chưa đọc
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllNotificationsRead}
                                    className="text-xs text-blue-600 hover:underline font-medium flex items-center cursor-pointer"
                                >
                                    <CheckCheck className="w-3.5 h-3.5 mr-1" /> Đọc tất cả
                                </button>
                            )}
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
                            {isLoadingNotifications ? (
                                <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                                    <Loader className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                                    <span className="text-xs">Đang tải thông báo...</span>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                        <Bell className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">Chưa có thông báo nào</p>
                                    <p className="text-xs text-slate-400 mt-1">Các hoạt động tương tác mới sẽ xuất hiện ở đây.</p>
                                </div>
                            ) : (
                                notifications.map((notif) => {
                                    const fromUser = notif.fromUser || {};
                                    return (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start space-x-3 group relative ${
                                                !notif.isRead ? "bg-blue-50/40" : ""
                                            }`}
                                        >
                                            <div className="relative shrink-0">
                                                <img 
                                                    src={fromUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} 
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                                                    alt="Avatar" 
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                                                    {getNotificationIcon(notif.type)}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs text-slate-800 line-clamp-2 ${!notif.isRead ? "font-semibold" : "font-normal"}`}>
                                                    {notif.message}
                                                </p>
                                                <span className="text-[10px] text-blue-600 font-medium mt-1 inline-block">
                                                    {formatRelativeTime(notif.createdAt)}
                                                </span>
                                            </div>

                                            {!notif.isRead && (
                                                <span className="w-2.5 h-2.5 bg-blue-600 rounded-full shrink-0 mt-1.5 shadow-sm shadow-blue-500/50"></span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default TopHeaderNav;
