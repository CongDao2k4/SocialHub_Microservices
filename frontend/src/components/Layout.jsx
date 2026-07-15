import {Outlet, Link, useNavigate, useLocation} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import {useSocket} from "../context/SocketContext";
import ChatWidget from "./ChatWidget"; // <-- Import thêm ChatWidget
import {Home, Users, User, LogOut, Bell, MessageSquare} from "lucide-react";
const Layout = () => {
    const { user, logout } = useAuth();
    const { unreadCount, toast, setToast } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();

    const isMessagesPage = location.pathname === "/messages";

    // Helper: trả về className cho nav link dựa trên active state
    const navLinkClass = (path) => {
        const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
        return isActive
            ? "flex items-center space-x-3 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-semibold transition"
            : "flex items-center space-x-3 px-4 py-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition group";
    };

    const navIconClass = (path) => {
        const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
        return isActive
            ? "w-5 h-5 text-blue-600"
            : "w-5 h-5 text-slate-400 group-hover:text-blue-600";
    };

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const handleToastClick = (t) => {
        setToast(null);
        if (t.referenceType === "post" || ["post_liked", "post_commented", "post_shared"].includes(t.type)) {
            if (t.referenceId) {
                navigate(`/post/${t.referenceId}`);
            } else {
                navigate("/");
            }
        } else if (t.type === "friend_request") {
            navigate("/friends");
        } else if (t.type === "friend_accepted" && t.fromUser?.id) {
            navigate(`/profile/${t.fromUser.id}`);
        } else if (t.type === "new_message") {
            navigate("/messages");
        } else {
            navigate("/notifications");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex">
            {/* Toast Thông báo Realtime */}
            {toast && (
                <div
                    onClick={() => handleToastClick(toast)}
                    className="fixed top-5 right-5 z-[9999] bg-white border-l-4 border-blue-600 shadow-xl shadow-slate-200/60 rounded-xl p-4 flex items-center space-x-3.5 cursor-pointer max-w-sm hover:shadow-2xl transition-shadow duration-300 animate-slide-in-right"
                >
                    <img
                        src={toast.fromUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                        alt="Sender Avatar"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-800 text-sm font-semibold truncate-2-lines">{toast.message}</p>
                        <p className="text-blue-600 text-xs mt-0.5 font-medium">Bấm để xem chi tiết →</p>
                    </div>
                </div>
            )}

            {/* Sidebar bên trái */}
            <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between fixed h-screen">
                <div className="space-y-8">
                    {/* Brand Logo */}
                    <Link to="/" className="flex items-center space-x-3 group cursor-pointer select-none">
                        <img
                            src="/logo.svg"
                            alt="SocialHub Logo"
                            className="w-10 h-10 object-contain group-hover:scale-105 transition duration-200"
                        />
                        <span className="text-xl font-bold tracking-tight text-slate-800 group-hover:text-blue-600 transition duration-200">
                            SocialHub
                        </span>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="space-y-1">
                        <Link to="/" className={navLinkClass("/")}>
                            <Home className={navIconClass("/")} />
                            <span>Bảng tin</span>
                        </Link>
                        <Link to="/friends" className={navLinkClass("/friends")}>
                            <Users className={navIconClass("/friends")} />
                            <span>Bạn bè</span>
                        </Link>
                        <Link to="/messages" className={navLinkClass("/messages")}>
                            <MessageSquare className={navIconClass("/messages")} />
                            <span>Tin nhắn</span>
                        </Link>
                        <Link to="/notifications" className={`${navLinkClass("/notifications")} justify-between`}>
                            <div className="flex items-center space-x-3">
                                <Bell className={navIconClass("/notifications")} />
                                <span>Thông báo</span>
                            </div>
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    </nav>
                </div>

                {/* Phần thông tin user đăng nhập ở đáy Sidebar */}
                <div className="pt-6 border-t border-slate-100 space-y-3">
                    <Link
                        to={`/profile/${user?.id}`}
                        className="flex items-center space-x-3 cursor-pointer group hover:bg-slate-50 p-2.5 rounded-xl transition"
                    >
                        <img
                            src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt="Avatar"
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                        />
                        <div className="truncate">
                            <p className="font-semibold text-sm text-slate-800 group-hover:text-blue-600 transition">{user?.displayName}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 py-2.5 rounded-xl transition cursor-pointer text-sm border border-slate-200 hover:border-red-200"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* Nội dung chính bên phải */}
            <main className={`flex-1 ml-64 mr-64 min-h-screen ${isMessagesPage ? "p-4" : "p-8"}`}>
                <div className={isMessagesPage ? "w-full h-full" : "max-w-4xl mx-auto"}>
                    <Outlet /> {/* Nơi các trang con hiển thị */}
                </div>
            </main>

            {/* Thanh chat sidebar bên phải và các ô chat nổi */}
            <ChatWidget />
        </div>
    );
};

export default Layout;
