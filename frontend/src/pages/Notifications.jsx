import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { Bell, Heart, MessageSquare, UserPlus, UserCheck, Share2, Eye, Check, Loader } from "lucide-react";

const Notifications = () => {
    const { setUnreadCount } = useSocket();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Tải danh sách thông báo
    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/notifications");
            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
            }
        } catch (error) {
            console.error("❌ Lỗi khi tải danh sách thông báo:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    // Lắng nghe sự kiện thông báo thời gian thực để cập nhật UI ngay lập tức
    useEffect(() => {
        const handleNewNotification = (e) => {
            const newNotif = e.detail;
            setNotifications(prev => {
                // Tránh trùng lặp nếu trùng id
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
            });
        };

        window.addEventListener("notification-received", handleNewNotification);
        return () => {
            window.removeEventListener("notification-received", handleNewNotification);
        };
    }, []);

    // 2. Đánh dấu một thông báo là đã đọc
    const handleMarkAsRead = async (notification) => {
        if (notification.isRead) {
            // Nếu đã đọc rồi, chuyển hướng thẳng
            handleRedirect(notification);
            return;
        }

        try {
            const res = await api.put(`/notifications/${notification.id}/read`);
            if (res.data && res.data.success) {
                // Cập nhật state cục bộ
                setNotifications(prev =>
                    prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
                );
                // Giảm số lượng chưa đọc ở Sidebar
                setUnreadCount(prev => Math.max(0, prev - 1));
                
                // Chuyển hướng người dùng
                handleRedirect(notification);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đánh dấu đã đọc:", error);
            // Vẫn cho chuyển hướng dù lỗi mạng API
            handleRedirect(notification);
        }
    };

    // 3. Đánh dấu tất cả là đã đọc
    const handleMarkAllAsRead = async () => {
        try {
            const res = await api.put("/notifications/read-all");
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đánh dấu đọc tất cả:", error);
        }
    };

    // 4. Hàm điều hướng tùy theo loại thông báo
    const handleRedirect = (notif) => {
        if (notif.type === "friend_request") {
            navigate("/friends");
        } else if (notif.type === "friend_accepted") {
            if (notif.fromUser?.id) {
                navigate(`/profile/${notif.fromUser.id}`);
            } else {
                navigate("/friends");
            }
        } else if (["post_liked", "post_commented", "post_shared"].includes(notif.type) || notif.referenceType === "post") {
            if (notif.referenceId) {
                navigate(`/post/${notif.referenceId}`);
            } else {
                navigate("/");
            }
        } else if (notif.type === "new_message") {
            navigate("/messages");
        } else {
            navigate("/");
        }
    };

    // 5. Trả về Icon tương ứng với loại tương tác
    const getIcon = (type) => {
        switch (type) {
            case "post_liked":
                return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
            case "post_commented":
                return <MessageSquare className="w-5 h-5 text-blue-600 fill-blue-600/10" />;
            case "post_shared":
                return <Share2 className="w-5 h-5 text-sky-500" />;
            case "friend_request":
                return <UserPlus className="w-5 h-5 text-amber-500" />;
            case "friend_accepted":
                return <UserCheck className="w-5 h-5 text-emerald-600" />;
            default:
                return <Bell className="w-5 h-5 text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header thông báo */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Thông báo</h1>
                    <p className="text-slate-600 text-sm mt-1">Nơi lưu lại các lượt tương tác của mọi người với bạn.</p>
                </div>
                
                {notifications.some(n => !n.isRead) && (
                    <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition cursor-pointer shadow-sm"
                    >
                        <Check className="w-4 h-4" />
                        <span>Đánh dấu đọc tất cả</span>
                    </button>
                )}
            </div>

            {/* Danh sách thông báo */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            ) : notifications.length > 0 ? (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition duration-200 cursor-pointer ${
                                notif.isRead
                                    ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                                    : "bg-blue-50/50 border-blue-100 shadow-md shadow-blue-600/5 hover:bg-blue-100/30 text-slate-900"
                            }`}
                        >
                            <div className="flex items-center space-x-4">
                                {/* Khung Avatar tròn kèm badge Icon tương tác đè góc */}
                                <div className="relative">
                                    <img
                                        src={notif.fromUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        alt="Avatar"
                                        className="w-12 h-12 rounded-full border border-slate-200 object-cover"
                                    />
                                    <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm">
                                        {getIcon(notif.type)}
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-sm font-medium leading-relaxed">{notif.message}</p>
                                    <p className="text-xs text-slate-500 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Dấu chấm xanh báo hiệu chưa đọc */}
                            {!notif.isRead && (
                                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse shadow-md shadow-blue-600/50 mr-2"></div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                    <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-700 text-lg">Hộp thư thông báo của bạn trống</p>
                    <p className="text-slate-500 text-sm mt-1">Khi có người tương tác, kết bạn hoặc bình luận bài đăng của bạn, chúng sẽ xuất hiện ở đây.</p>
                </div>
            )}
        </div>
    );
};

export default Notifications;
