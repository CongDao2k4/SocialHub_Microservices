import { useState, useEffect, Component } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import ChatBox from "./ChatBox";
import IncomingCallModal from "./IncomingCallModal";
import CallWindow from "./CallWindow";
import { Users, Loader, MessageSquarePlus, X, UserPlus, Sparkles } from "lucide-react";

// ErrorBoundary: ngăn tòan bộ trang bị trắng khi ChatBox gặp lỗi bất ngờ
class ChatBoxErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error("ChatBox Error:", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full sm:w-80 bg-white border border-red-200 rounded-t-2xl shadow-xl flex items-center justify-between p-3">
                    <p className="text-xs text-red-500">Không thể mở cuộc trò chuyện</p>
                    <button onClick={this.props.onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
            );
        }
        return this.props.children;
    }
}

const ChatWidget = () => {
    const { user: currentUser } = useAuth();
    const { 
        onlineUsers, 
        chatSocket, 
        incomingCall, 
        activeCall, 
        setActiveCall, 
        handleAcceptIncomingCall, 
        handleRejectIncomingCall 
    } = useSocket();
    const [friends, setFriends] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Quản lý các ô chat đang được mở nổi dưới đáy màn hình (Mở tối đa 3 ô thoại cùng lúc)
    const [openChats, setOpenChats] = useState([]);

    // Trạng thái cho việc Tạo nhóm chat
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);

    // 1. Tải danh sách bạn bè và lắng nghe sự kiện đồng bộ từ các trang khác
    useEffect(() => {
        const fetchFriendsList = async () => {
            setIsLoading(true);
            try {
                const res = await api.get("/friends");
                if (res.data && res.data.success) {
                    setFriends(res.data.data || []);
                }
            } catch (error) {
                console.error("❌ Lỗi lấy danh sách bạn bè ở ChatWidget:", error.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentUser) {
            fetchFriendsList();
        }

        window.addEventListener("friends-updated", fetchFriendsList);
        return () => {
            window.removeEventListener("friends-updated", fetchFriendsList);
        };
    }, [currentUser]);

    // 2. Xử lý mở một cuộc trò chuyện khi click vào người bạn
    const handleOpenChat = async (friend) => {
        try {
            // Gọi API lấy hoặc tạo mới cuộc trò chuyện 1-1
            const res = await api.post("/conversations", { participantId: friend.id });
            if (res.data && res.data.success) {
                const conversation = res.data.data;

                // Nếu cuộc trò chuyện này chưa có trong danh sách mở chat
                if (!openChats.some(c => c._id === conversation._id || c.id === conversation.id)) {
                    // Mở thêm ô chat, giới hạn tối đa 3 ô chat nổi
                    setOpenChats(prev => {
                        const newChats = [...prev, conversation];
                        if (newChats.length > 3) {
                            newChats.shift(); // Tự động đóng ô chat lâu nhất
                        }
                        return newChats;
                    });
                }
            }
        } catch (error) {
            console.error("❌ Lỗi mở cuộc hội thoại:", error);
            alert("Không thể khởi tạo cuộc trò chuyện!");
        }
    };

    // 3. Đóng một ô chat
    const handleCloseChat = (conversationId) => {
        setOpenChats(prev => prev.filter(c => (c._id !== conversationId && c.id !== conversationId)));
    };

    // 4. Lắng nghe sự kiện "open-chat" và "open-chat-conversation" từ các trang khác
    useEffect(() => {
        const handleOpenChatEvent = (e) => {
            const friend = e.detail;
            handleOpenChat(friend);
        };

        const handleOpenConversationEvent = async (e) => {
            const conversation = e.detail;
            if (!conversation) return;
            
            const convId = conversation._id || conversation.id;
            if (!convId) {
                console.error("❌ open-chat-conversation: conversation thiếu ID", conversation);
                return;
            }

            // Nếu conversation thiếu participants (dữ liệu partial từ list API), fetch full từ API
            const hasValidParticipants = Array.isArray(conversation.participants) && conversation.participants.length > 0;
            let fullConversation = conversation;
            if (!hasValidParticipants) {
                try {
                    const res = await api.get(`/conversations/${convId}`);
                    if (res.data?.success) {
                        fullConversation = res.data.data;
                    }
                } catch (err) {
                    console.error("❌ Lỗi fetch cuộc hội thoại khi mở chat:", err);
                    return;
                }
            }

            setOpenChats(prev => {
                const id = fullConversation._id || fullConversation.id;
                if (prev.some(c => (c._id || c.id) === id)) return prev;
                const newChats = [...prev, fullConversation];
                if (newChats.length > 3) newChats.shift();
                return newChats;
            });
        };

        window.addEventListener("open-chat", handleOpenChatEvent);
        window.addEventListener("open-chat-conversation", handleOpenConversationEvent);
        return () => {
            window.removeEventListener("open-chat", handleOpenChatEvent);
            window.removeEventListener("open-chat-conversation", handleOpenConversationEvent);
        };
    }, [openChats]);


    // 5. Lắng nghe tin nhắn mới từ chatSocket để tự động bật popup ChatBox
    useEffect(() => {
        if (!chatSocket) return;

        const handleIncomingMessage = async (message) => {
            // Nếu đang ở trang tin nhắn đầy đủ (/messages), không tự động mở hộp thoại nhỏ nổi
            if (window.location.pathname === "/messages") return;

            const isAlreadyOpen = openChats.some(c => c._id === message.conversationId || c.id === message.conversationId);
            if (!isAlreadyOpen) {
                try {
                    const res = await api.get(`/conversations/${message.conversationId}`);
                    if (res.data && res.data.success) {
                        const conversation = res.data.data;
                        setOpenChats(prev => {
                            if (prev.some(c => c._id === conversation._id || c.id === conversation.id)) return prev;
                            const newChats = [...prev, conversation];
                            if (newChats.length > 3) newChats.shift();
                            return newChats;
                        });
                    }
                } catch (err) {
                    console.error("❌ Lỗi lấy thông tin cuộc hội thoại khi có tin nhắn đến:", err);
                }
            }
        };

        chatSocket.on("message:received", handleIncomingMessage);
        return () => {
            chatSocket.off("message:received", handleIncomingMessage);
        };
    }, [chatSocket, openChats]);

    const handleToggleMember = (friendId) => {
        setSelectedMembers(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    const handleCreateGroupSubmit = async (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedMembers.length === 0) return;

        try {
            const res = await api.post("/groups", {
                name: groupName.trim(),
                memberIds: selectedMembers
            });
            if (res.data && res.data.success) {
                const newGroup = res.data.data;
                
                // Lấy thông tin chi tiết cuộc trò chuyện qua endpoint gateway
                const convRes = await api.get(`/conversations/${newGroup.conversationId}`);
                if (convRes.data && convRes.data.success) {
                    const conversation = convRes.data.data;
                    setOpenChats(prev => {
                        if (prev.some(c => c._id === conversation._id || c.id === conversation.id)) return prev;
                        const newChats = [...prev, conversation];
                        if (newChats.length > 3) newChats.shift();
                        return newChats;
                    });
                }
                
                setGroupName("");
                setSelectedMembers([]);
                setShowCreateGroupModal(false);
            }
        } catch (err) {
            console.error("❌ Lỗi tạo nhóm chat:", err);
            alert("Không thể tạo nhóm chat!");
        }
    };

    if (!currentUser) return null;

    const onlineCount = friends.filter(f => onlineUsers[f.id] === true).length;

    return (
        <>
            {/* Sidebar cố định bên phải (Right Sidebar) hiển thị danh sách bạn bè */}
            <aside className="hidden lg:flex w-64 bg-white border-l border-slate-200 p-5 fixed right-0 top-0 h-screen flex-col pt-20 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                    <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-slate-800 text-sm">Bạn bè ({friends.length})</h3>
                    </div>
                    <button
                        onClick={() => setShowCreateGroupModal(true)}
                        title="Tạo nhóm chat"
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition cursor-pointer border border-slate-200"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        {friends.length > 0 ? (
                            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                                {friends.map(friend => {
                                    // Xem trạng thái trực tuyến của bạn bè qua onlineUsers trong SocketContext
                                    const isOnline = onlineUsers[friend.id] === true;

                                    return (
                                        <div
                                            key={friend.id}
                                            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-slate-100 transition group"
                                        >
                                            {/* Nhấp ảnh đại diện -> Đi tới trang cá nhân */}
                                            <Link
                                                to={`/profile/${friend.id}`}
                                                className="relative cursor-pointer hover:opacity-85 transition block shrink-0"
                                            >
                                                <img
                                                    src={friend.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                                    alt="Avatar"
                                                />
                                                {/* Chấm tròn báo trạng thái online/offline */}
                                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                                }`} />
                                            </Link>

                                            {/* Nhấp tên -> Bật ô chat thoại */}
                                            <div
                                                onClick={() => handleOpenChat(friend)}
                                                className="truncate flex-1 cursor-pointer"
                                            >
                                                <p className="text-xs font-semibold text-slate-700 group-hover:text-slate-950 truncate transition">
                                                    {friend.displayName}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <p className="text-slate-400 text-xs mb-3">Chưa có bạn bè trong danh sách.</p>
                            </div>
                        )}

                        {/* Phần Gợi ý kết bạn & Trạng thái hoạt động ở đáy sidebar */}
                        <div className="pt-4 border-t border-slate-200 mt-2 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <h4 className="font-bold text-slate-800 text-xs">Gợi ý kết bạn</h4>
                                </div>
                                {onlineCount > 0 && (
                                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        {onlineCount} online
                                    </span>
                                )}
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    {onlineCount > 0 
                                        ? `Đang có ${onlineCount} bạn bè trực tuyến sẵn sàng trò chuyện!` 
                                        : "Khám phá thêm những người bạn mới trên SocialHub."}
                                </p>
                                <Link
                                    to="/friends"
                                    className="flex items-center justify-center space-x-1.5 w-full bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Tìm bạn mới</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Container chứa các ô chat nổi ở góc dưới bên phải màn hình */}
            <div className="fixed bottom-16 sm:bottom-0 right-0 sm:right-6 lg:right-72 inset-x-0 sm:inset-x-auto z-40 flex items-end justify-end space-x-4 pointer-events-none px-2 sm:px-0">
                {openChats.map(conv => {
                    const convKey = conv._id || conv.id;
                    if (!convKey) return null; // bỏ qua conversation không có ID
                    return (
                        <div key={convKey} className="pointer-events-auto w-full sm:w-auto">
                            <ChatBoxErrorBoundary onClose={() => handleCloseChat(convKey)}>
                                <ChatBox
                                    conversation={{
                                        ...conv,
                                        isOnline: Array.isArray(conv.participants)
                                            ? conv.participants.some(p => {
                                                const pId = p.userId || p.id || p._id;
                                                return pId && pId !== currentUser.id && onlineUsers[pId] === true;
                                              })
                                            : false
                                    }}
                                    onClose={() => handleCloseChat(convKey)}
                                    currentUserId={currentUser.id}
                                />
                            </ChatBoxErrorBoundary>
                        </div>
                    );
                })}
            </div>

            {/* Modal Tạo Nhóm Chat */}
            {showCreateGroupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fadeIn">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm">Tạo nhóm chat</h3>
                            <button
                                onClick={() => {
                                    setShowCreateGroupModal(false);
                                    setGroupName("");
                                    setSelectedMembers([]);
                                }}
                                className="text-slate-400 hover:text-slate-850 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateGroupSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Tên nhóm</label>
                                <input
                                    type="text"
                                    required
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Nhập tên nhóm..."
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] text-slate-550 font-semibold uppercase mb-1.5">
                                    Chọn thành viên ({selectedMembers.length})
                                </label>
                                {friends.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {friends.map(friend => (
                                            <div
                                                key={friend.id}
                                                onClick={() => handleToggleMember(friend.id)}
                                                className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer ${
                                                    selectedMembers.includes(friend.id)
                                                        ? "bg-blue-50 border border-blue-200"
                                                        : "bg-slate-50 border-transparent hover:bg-slate-100"
                                                }`}
                                            >
                                                <div className="flex items-center space-x-2.5">
                                                    <img
                                                        src={friend.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                        alt="Friend Avatar"
                                                    />
                                                    <span className="text-xs text-slate-700 font-medium">{friend.displayName}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMembers.includes(friend.id)}
                                                    readOnly
                                                    className="w-3.5 h-3.5 accent-blue-600 rounded border-slate-200 cursor-pointer"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-slate-400 text-[10px] py-4">Không có bạn bè để tạo nhóm.</p>
                                )}
                            </div>
                            
                            <button
                                type="submit"
                                disabled={!groupName.trim() || selectedMembers.length === 0}
                                className="w-full bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer shadow-md shadow-blue-600/10"
                            >
                                Tạo nhóm
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Nhận cuộc gọi đến (WebRTC Incoming Call) */}
            {incomingCall && (
                <IncomingCallModal
                    incomingCall={incomingCall}
                    onAccept={handleAcceptIncomingCall}
                    onReject={handleRejectIncomingCall}
                />
            )}

            {/* Cửa sổ Cuộc gọi Video/Audio đang diễn ra (WebRTC Active Call) */}
            {activeCall && (
                <CallWindow
                    activeCall={activeCall}
                    chatSocket={chatSocket}
                    currentUserId={currentUser.id}
                    onClose={() => setActiveCall(null)}
                />
            )}
        </>
    );
};

export default ChatWidget;
