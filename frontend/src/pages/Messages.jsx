import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../services/api";
import {
    MessageSquare,
    Send,
    Image as ImageIcon,
    Video,
    Users,
    X,
    Loader,
    MessageSquarePlus,
    Circle,
    Trash2,
    UserPlus,
    UserMinus
} from "lucide-react";

// Component con tải Ảnh & Video an toàn bằng blob đính kèm JWT Token (Không có viền lót tím)
const ChatMedia = ({ mediaId }) => {
    const [mediaData, setMediaData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchMedia = async () => {
            try {
                const response = await api.get(`/media/file/${mediaId}`, {
                    responseType: "blob"
                });
                if (isMounted) {
                    const objectUrl = URL.createObjectURL(response.data);
                    const type = response.data.type || "";
                    setMediaData({
                        url: objectUrl,
                        isVideo: type.startsWith("video/")
                    });
                }
            } catch (err) {
                console.error("❌ Lỗi tải media đính kèm chat:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchMedia();

        return () => {
            isMounted = false;
            if (mediaData?.url) URL.revokeObjectURL(mediaData.url);
        };
    }, [mediaId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4 bg-slate-100 rounded-xl min-w-[120px]">
                <Loader className="w-4 h-4 text-violet-500 animate-spin" />
            </div>
        );
    }

    if (!mediaData) {
        return <p className="text-[10px] text-red-400 italic p-2">Không tải được media</p>;
    }

    if (mediaData.isVideo) {
        return (
            <video
                src={mediaData.url}
                controls
                className="rounded-xl max-h-72 max-w-full object-cover shadow-sm bg-black"
            />
        );
    }

    return (
        <img
            src={mediaData.url}
            alt="Attached"
            className="rounded-xl max-h-72 max-w-full object-contain cursor-pointer hover:opacity-95 transition shadow-sm"
            onClick={() => window.open(mediaData.url, "_blank")}
        />
    );
};

// Component con quản lý thành viên nhóm chat
const GroupMembersModal = ({ conversation, onClose, onGroupUpdated, friends }) => {
    const { user: currentUser } = useAuth();
    const [isAdding, setIsAdding] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const groupId = conversation.groupRef?._id || conversation.groupRef?.id;
    const currentMembers = conversation.groupRef?.members || [];
    const currentMemberIds = new Set(currentMembers.map(m => m.userId));

    // Xác định vai trò của user hiện tại
    const currentUserMember = currentMembers.find(m => m.userId === currentUser?.id);
    const isCurrentUserAdmin = currentUserMember?.role === "admin";

    // Lọc danh sách bạn bè chưa có trong nhóm
    const addableFriends = friends.filter(f => !currentMemberIds.has(f.id));

    const handleAddMember = async (friendId) => {
        if (!groupId) return;
        setIsAdding(true);
        try {
            const res = await api.post(`/groups/${groupId}/members`, { userId: friendId });
            if (res.data && res.data.success) {
                onGroupUpdated(res.data.data);
                alert("Đã thêm thành viên thành công!");
            }
        } catch (err) {
            console.error("❌ Lỗi thêm thành viên vào nhóm:", err);
            alert(err.response?.data?.message || "Không thể thêm thành viên!");
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (memberId) => {
        const confirmRemove = window.confirm("Bạn có chắc chắn muốn mời thành viên này rời khỏi nhóm?");
        if (!confirmRemove) return;

        setIsRemoving(true);
        try {
            const res = await api.delete(`/groups/${groupId}/members/${memberId}`);
            if (res.data && res.data.success) {
                // API DELETE trả về { status, group }
                onGroupUpdated(res.data.data.group);
                alert("Đã xóa thành viên khỏi nhóm.");
            }
        } catch (err) {
            console.error("❌ Lỗi xóa thành viên khỏi nhóm:", err);
            alert(err.response?.data?.message || "Không thể xóa thành viên!");
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Quản lý thành viên nhóm</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg hover:bg-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Danh sách thành viên hiện tại */}
                    <div>
                        <h4 className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mb-2">
                            Thành viên hiện tại ({currentMembers.length})
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                            {currentMembers.map((member) => (
                                <div key={member.userId} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                                    <div className="flex items-center space-x-2.5">
                                        <img
                                            src={member.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${member.userId}`}
                                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                            alt="Avatar"
                                        />
                                        <span className="text-xs font-semibold text-slate-800">{member.displayName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${member.role === "admin" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                                            }`}>
                                            {member.role === "admin" ? "Trưởng nhóm" : "Thành viên"}
                                        </span>
                                        {/* Chỉ Trưởng nhóm (Admin) mới có quyền xóa thành viên khác */}
                                        {isCurrentUserAdmin && member.userId !== currentUser?.id && (
                                            <button
                                                disabled={isRemoving}
                                                onClick={() => handleRemoveMember(member.userId)}
                                                title="Mới ra khỏi nhóm"
                                                className="p-1 hover:bg-rose-50 text-slate-450 hover:text-rose-600 rounded-lg transition disabled:opacity-50 cursor-pointer"
                                            >
                                                <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Thêm thành viên mới */}
                    <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mb-2">
                            Thêm thành viên mới
                        </h4>
                        {addableFriends.length > 0 ? (
                            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                                {addableFriends.map((friend) => (
                                    <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                                        <div className="flex items-center space-x-2.5">
                                            <img
                                                src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.id}`}
                                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                alt="Avatar"
                                            />
                                            <span className="text-xs font-semibold text-slate-800">{friend.displayName}</span>
                                        </div>
                                        <button
                                            disabled={isAdding}
                                            onClick={() => handleAddMember(friend.id)}
                                            className="flex items-center space-x-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-750 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-50 cursor-pointer"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>Thêm</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-400 italic text-center py-4">Tất cả bạn bè đã tham gia nhóm này.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Component hiển thị tin nhắn chia sẻ bài viết đẹp mắt tương tự Facebook
const RenderShareMessage = ({ msgContent, isMe, onNavigate }) => {
    let data = null;
    try {
        data = JSON.parse(msgContent);
    } catch (e) {
        return <div className="text-xs italic text-slate-400">Tin nhắn chia sẻ (Không tải được nội dung)</div>;
    }

    return (
        <div className={`flex flex-col space-y-1.5 max-w-[280px] ${isMe ? "items-end" : "items-start"}`}>
            {/* Lời dẫn đi kèm (nếu có) */}
            {data.shareText && (
                <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${isMe ? "bg-violet-600 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                    }`}>
                    {data.shareText}
                </div>
            )}

            {/* Block bài viết chia sẻ kiểu Facebook */}
            <div
                onClick={() => onNavigate(`/post/${data.postId}`)}
                className="bg-slate-50 border border-slate-200 hover:border-violet-450 hover:bg-slate-100 rounded-2xl overflow-hidden shadow-sm cursor-pointer transition duration-200 text-left w-full max-w-[260px] flex flex-col"
            >
                {/* Phần hình ảnh ở trên */}
                {data.mediaId ? (
                    <div className="w-full h-36 overflow-hidden bg-black/5 flex items-center justify-center border-b border-slate-200/60 relative shrink-0">
                        <ChatMedia mediaId={data.mediaId} />
                        <div className="absolute top-2 left-2 flex items-center space-x-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/10 max-w-[90%] select-none">
                            <img
                                src={data.authorAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.postId}`}
                                className="w-4 h-4 rounded-full object-cover border border-white/20"
                                alt="Author"
                            />
                            <span className="font-bold text-[9px] text-white truncate">{data.authorName}</span>
                        </div>
                    </div>
                ) : null}

                {/* Phần nội dung text và logo ở dưới */}
                <div className="p-3.5 space-y-2">
                    {!data.mediaId && (
                        <div className="flex items-center space-x-2 border-b border-slate-200/60 pb-1.5">
                            <img
                                src={data.authorAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.postId}`}
                                className="w-5.5 h-5.5 rounded-full object-cover border border-slate-200"
                                alt="Author"
                            />
                            <span className="font-bold text-[11px] text-slate-800 truncate">{data.authorName}</span>
                        </div>
                    )}

                    <p className="text-[10px] font-bold text-slate-800 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {data.postContent || "Bài viết không có nội dung văn bản."}
                    </p>

                    {/* Logo SocialHub chân trang tương tự Facebook */}
                    <div className="flex items-center space-x-1 text-[9px] text-slate-500 font-semibold pt-2 border-t border-slate-200/50 mt-1 select-none">
                        <div className="w-3.5 h-3.5 rounded-full bg-violet-600 flex items-center justify-center text-white font-extrabold text-[8px]">
                            S
                        </div>
                        <span>SocialHub</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Messages = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const { onlineUsers, chatSocket } = useSocket();

    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [inputText, setInputText] = useState("");

    const [isLoadingConvs, setIsLoadingConvs] = useState(true);
    const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);

    // Group Chat Modal
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);

    // Multi-file media attachments
    const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, previewUrl, isVideo }]
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 1. Tải danh sách cuộc hội thoại của User
    const fetchConversations = async () => {
        setIsLoadingConvs(true);
        try {
            const res = await api.get("/conversations");
            if (res.data && res.data.success) {
                setConversations(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy danh sách hội thoại:", err.message);
        } finally {
            setIsLoadingConvs(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    // 2. Join và tự động Re-join room Websocket khi socket mất kết nối rồi tự kết nối lại (reconnect)
    useEffect(() => {
        if (!chatSocket || !selectedConv) return;
        const cId = selectedConv._id || selectedConv.id;

        const joinRoom = () => {
            chatSocket.emit("conversation:join", { conversationId: cId });
            console.log(`📡 Đã kết nối & gửi yêu cầu join conversation room: ${cId}`);
        };

        joinRoom();

        // Lắng nghe sự kiện kết nối lại để tự động join lại room
        chatSocket.on("connect", joinRoom);

        return () => {
            chatSocket.off("connect", joinRoom);
        };
    }, [selectedConv, chatSocket]);

    // 2b. Lắng nghe sự kiện nhắn tin Realtime qua Socket.IO Chat Namespace
    useEffect(() => {
        if (!chatSocket) return;

        const handleNewMessage = (msg) => {
            if (selectedConv) {
                const cId = selectedConv._id || selectedConv.id;
                if (String(msg.conversationId) === String(cId)) {
                    if (String(msg.conversationId) === String(cId)) {
                        setMessages((prev) => [...prev, msg]);
                        // Đánh dấu đã đọc gửi ngược lại
                        chatSocket.emit("message:read", { conversationId: cId, messageId: msg.id || msg._id });
                    }
                }
                fetchConversations();
            };

            chatSocket.on("message:received", handleNewMessage);
            return () => {
                chatSocket.off("message:received", handleNewMessage);
            };
        }
    }, [chatSocket, selectedConv]);

    // 2b. Join Room conversation socket khi thay đổi cuộc hội thoại được chọn
    useEffect(() => {
        if (!chatSocket || !selectedConv) return;
        const cId = selectedConv._id || selectedConv.id;

        const joinRoom = () => {
            chatSocket.emit("conversation:join", { conversationId: cId });
            console.log(`📡 [Messages page] Đã gửi yêu cầu join conversation room: ${cId}`);
        };

        joinRoom();
        chatSocket.on("connect", joinRoom);

        return () => {
            chatSocket.off("connect", joinRoom);
        };
    }, [chatSocket, selectedConv]);

    // 3. Khi chọn 1 cuộc hội thoại -> Tải danh sách tin nhắn lịch sử
    useEffect(() => {
        if (!selectedConv) return;
        const cId = selectedConv._id || selectedConv.id;

        const fetchMessages = async () => {
            setIsLoadingMsgs(true);
            try {
                const res = await api.get(`/conversations/${cId}/messages`);
                if (res.data && res.data.success) {
                    setMessages(res.data.data?.data ? [...res.data.data.data].reverse() : []);
                }
            } catch (err) {
                console.error("❌ Lỗi tải lịch sử tin nhắn:", err.message);
            } finally {
                setIsLoadingMsgs(false);
            }
        };

        fetchMessages();
    }, [selectedConv]);

    // Xử lý chọn nhiều File (Ảnh & Video)
    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newItems = files.map((file) => ({
            id: Math.random().toString(36).substring(2, 9),
            file,
            previewUrl: URL.createObjectURL(file),
            isVideo: file.type.startsWith("video/")
        }));

        setSelectedFiles((prev) => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveFile = (idToRemove) => {
        setSelectedFiles((prev) => {
            const item = prev.find((f) => f.id === idToRemove);
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return prev.filter((f) => f.id !== idToRemove);
        });
    };

    // 3b. Dán ảnh trực tiếp từ clipboard
    const handleInputPaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const previewUrl = URL.createObjectURL(blob);
                    const fileItem = {
                        id: Math.random().toString(36).substring(2, 9),
                        file: blob,
                        previewUrl: previewUrl,
                        isVideo: false
                    };
                    setSelectedFiles((prev) => [...prev, fileItem]);
                    e.preventDefault(); // Ngăn hiển thị text nhị phân linh tinh
                    break;
                }
            }
        }
    };

    // 4. Gửi tin nhắn (Văn bản và/hoặc nhiều Ảnh/Video) qua Socket
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!selectedConv || !chatSocket) return;
        if (!inputText.trim() && selectedFiles.length === 0) return;

        const cId = selectedConv._id || selectedConv.id;
        setIsSending(true);

        try {
            let uploadedMediaIds = [];

            // Bước A: Upload tất cả file media đính kèm nếu có
            if (selectedFiles.length > 0) {
                const uploadPromises = selectedFiles.map(async (item) => {
                    const formData = new FormData();
                    formData.append("file", item.file);
                    const res = await api.post("/media/upload", formData, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                    return res.data?.id;
                });
                const resIds = await Promise.all(uploadPromises);
                uploadedMediaIds = resIds.filter(Boolean);
            }

            // Gửi từng media kèm theo hoặc tin nhắn tổng thể qua WebSocket event message:send
            if (uploadedMediaIds.length > 0) {
                for (let i = 0; i < uploadedMediaIds.length; i++) {
                    const mId = uploadedMediaIds[i];
                    const isLast = i === uploadedMediaIds.length - 1;
                    const contentText = isLast && inputText.trim() ? inputText.trim() : "Sent an image";

                    chatSocket.emit("message:send", {
                        conversationId: cId,
                        content: contentText,
                        type: "image",
                        mediaId: mId
                    });
                }
            } else if (inputText.trim()) {
                chatSocket.emit("message:send", {
                    conversationId: cId,
                    content: inputText.trim(),
                    type: "text"
                });
            }

            // Reset form
            setInputText("");
            selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
            setSelectedFiles([]);
        } catch (err) {
            console.error("❌ Lỗi gửi tin nhắn:", err.message);
            alert("Không thể gửi tin nhắn. Vui lòng thử lại!");
        } finally {
            setIsSending(false);
        }
    };

    // 5. Tải danh sách bạn bè để chọn làm nhóm
    const fetchFriends = async () => {
        try {
            const res = await api.get("/friends");
            if (res.data && res.data.success) {
                setFriends(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy danh sách bạn bè:", err.message);
        }
    };

    const handleOpenGroupModal = () => {
        setShowGroupModal(true);
        fetchFriends();
    };

    const handleOpenMembersModal = () => {
        setShowMembersModal(true);
        fetchFriends();
    };

    const toggleSelectFriend = (friendId) => {
        setSelectedFriends((prev) =>
            prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
        );
    };

    // 5b. Xóa cuộc trò chuyện
    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation();
        const confirmDelete = window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Mọi tin nhắn sẽ bị xóa vĩnh viễn và không thể khôi phục.");
        if (!confirmDelete) return;

        try {
            const res = await api.delete(`/conversations/${convId}`);
            if (res.data && res.data.success) {
                setConversations(prev => prev.filter(c => (c._id || c.id) !== convId));
                if (selectedConv && (selectedConv._id === convId || selectedConv.id === convId)) {
                    setSelectedConv(null);
                    setMessages([]);
                }
            }
        } catch (err) {
            console.error("❌ Lỗi xóa cuộc trò chuyện:", err.message);
            alert("Không thể xóa cuộc trò chuyện!");
        }
    };

    // 6. Tạo nhóm chat mới
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedFriends.length === 0) {
            alert("Vui lòng nhập tên nhóm và chọn ít nhất 1 thành viên!");
            return;
        }

        try {
            const res = await api.post("/groups", {
                name: groupName.trim(),
                memberIds: selectedFriends
            });

            if (res.data && res.data.success) {
                setShowGroupModal(false);
                setGroupName("");
                setSelectedFriends([]);
                fetchConversations();
            }
        } catch (err) {
            console.error("❌ Lỗi tạo nhóm chat:", err.message);
            alert("Không thể tạo nhóm chat!");
        }
    };

    // Helper trích xuất thông tin đối phương từ conversation
    const getConvInfo = (conv) => {
        const isGroup = conv.type === "group";
        const cId = conv._id || conv.id;

        const other = conv.participants?.find((p) => p.userId !== currentUser?.id) || {
            displayName: "Người dùng SocialHub",
            avatarUrl: null,
            userId: ""
        };

        const title = isGroup ? conv.groupRef?.name || "Cuộc trò chuyện nhóm" : other.displayName;
        const avatar = isGroup
            ? conv.groupRef?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${cId}`
            : other.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
        const isOnline = !isGroup && onlineUsers[other.userId] === true;

        return { title, avatar, isOnline, other };
    };

    return (
        <div className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden h-[calc(100vh-4rem)] shadow-sm w-full">
            {/* Cột trái: Danh sách hội thoại */}
            <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                    <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5 text-violet-600" />
                        <span>Hội thoại</span>
                    </h2>
                    <button
                        onClick={handleOpenGroupModal}
                        title="Tạo nhóm mới"
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-650 hover:text-violet-600 border border-slate-200 rounded-xl transition cursor-pointer shadow-sm"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                </div>

                {/* Danh sách các cuộc hội thoại */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isLoadingConvs ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader className="w-6 h-6 text-violet-500 animate-spin" />
                        </div>
                    ) : conversations.length > 0 ? (
                        conversations.map((conv) => {
                            const cId = conv._id || conv.id;
                            const isSelected = selectedConv && (selectedConv._id === cId || selectedConv.id === cId);
                            const { title, avatar, isOnline } = getConvInfo(conv);

                            return (
                                <div
                                    key={cId}
                                    onClick={() => setSelectedConv(conv)}
                                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group ${isSelected ? "bg-violet-50 border border-violet-200" : "hover:bg-slate-100"
                                        }`}
                                >
                                    <div className="relative shrink-0">
                                        <img
                                            src={avatar}
                                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                                            alt="Avatar"
                                        />
                                        {isOnline && (
                                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-violet-600 transition">
                                                {title}
                                            </h4>
                                            {conv.unreadCount > 0 ? (
                                                <span className="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-md shadow-rose-500/20 min-w-[16px] text-center group-hover:hidden animate-pulse">
                                                    {conv.unreadCount}
                                                </span>
                                            ) : null}
                                            <button
                                                onClick={(e) => handleDeleteConversation(e, cId)}
                                                title="Xóa hội thoại"
                                                className="hidden group-hover:flex items-center justify-center p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0 cursor-pointer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                            {conv.lastMessage?.content || (conv.lastMessage?.type === "image" ? "Đã gửi tệp media" : "Chưa có tin nhắn...")}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-slate-400 text-xs py-12">Không tìm thấy cuộc trò chuyện nào.</div>
                    )}
                </div>
            </div>

            {/* Cột phải: Khung nội dung hội thoại */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {selectedConv ? (
                    <>
                        {/* Header Chat */}
                        {(() => {
                            const { title, avatar, isOnline } = getConvInfo(selectedConv);
                            const isGroup = selectedConv.type === "group";

                            return (
                                <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                                    <div className="flex items-center space-x-3">
                                        <img
                                            src={avatar}
                                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                                            alt="Avatar"
                                        />
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-800">{title}</h3>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                {isGroup
                                                    ? `${selectedConv.participants?.length || 0} thành viên`
                                                    : isOnline
                                                        ? "Đang hoạt động"
                                                        : "Ngoại tuyến"}
                                            </p>
                                        </div>
                                    </div>

                                    {isGroup && (
                                        <button
                                            onClick={handleOpenMembersModal}
                                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 hover:text-violet-600 rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm"
                                        >
                                            <Users className="w-4 h-4" />
                                            <span>Thành viên</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Vùng nội dung danh sách tin nhắn */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {isLoadingMsgs ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader className="w-7 h-7 text-violet-500 animate-spin" />
                                </div>
                            ) : messages.length > 0 ? (
                                messages.map((msg, index) => {
                                    const isMe = msg.senderId === currentUser.id;
                                    const isGroup = selectedConv.type === "group";
                                    const sender = selectedConv.participants?.find((p) => p.userId === msg.senderId) || {
                                        displayName: "Thành viên",
                                        avatarUrl: null
                                    };
                                    const msgTime = new Date(msg.createdAt || msg.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    });

                                    return (
                                        <div key={msg.id || msg._id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}>
                                            {!isMe && isGroup && (
                                                <span className="text-[9px] text-slate-500 font-semibold ml-9 select-none">
                                                    {sender.displayName}
                                                </span>
                                            )}

                                            <div className={`flex items-end space-x-2 ${isMe ? "justify-end" : "justify-start"} max-w-[80%]`}>
                                                {!isMe && (
                                                    <img
                                                        src={sender.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.senderId}`}
                                                        className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                                        alt="Sender Avatar"
                                                    />
                                                )}

                                                {/* Hiển thị Media đính kèm (Hình ảnh / Video) độc lập - Không bị lót viền màu tím */}
                                                {msg.type === "image" && msg.mediaId ? (
                                                    <div className="flex flex-col space-y-1 items-end">
                                                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm bg-black/5">
                                                            <ChatMedia mediaId={msg.mediaId} />
                                                        </div>
                                                        {msg.content && msg.content !== "Sent an image" && (
                                                            <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${isMe ? "bg-violet-600 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                                                                }`}>
                                                                {msg.content}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : msg.type === "share" ? (
                                                    <RenderShareMessage msgContent={msg.content} isMe={isMe} onNavigate={navigate} />
                                                ) : (
                                                    <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${isMe
                                                        ? "bg-violet-600 text-white rounded-br-none"
                                                        : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                                                        }`}>
                                                        {msg.content}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-[8px] text-slate-400 select-none ${isMe ? "mr-1" : "ml-9"}`}>
                                                {msgTime}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                                    Chưa có tin nhắn nào. Gửi lời chào để bắt đầu cuộc trò chuyện!
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Ô nhập tin nhắn */}
                        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white space-y-3 shrink-0">
                            {/* Khung xem trước nhiều file đính kèm */}
                            {selectedFiles.length > 0 && (
                                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                                    {selectedFiles.map((item) => (
                                        <div key={item.id} className="relative rounded-xl overflow-hidden border border-slate-200 w-20 h-20 shrink-0 bg-slate-100 flex items-center justify-center">
                                            {item.isVideo ? (
                                                <video src={item.previewUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(item.id)}
                                                className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/85 text-white rounded-full transition cursor-pointer"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Khung thanh công cụ và ô gõ nội dung */}
                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-violet-600 rounded-xl transition cursor-pointer shrink-0"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                </button>
                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    onChange={handleFilesChange}
                                    accept="image/*,video/*"
                                    className="hidden"
                                />

                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onPaste={handleInputPaste}
                                    placeholder="Nhập tin nhắn..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-600 transition"
                                />

                                <button
                                    type="submit"
                                    disabled={isSending || (!inputText.trim() && selectedFiles.length === 0)}
                                    className="p-2.5 bg-violet-600 disabled:opacity-50 hover:bg-violet-700 text-white rounded-xl transition cursor-pointer shrink-0 shadow-md shadow-violet-600/20"
                                >
                                    {isSending ? (
                                        <Loader className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 select-none">
                        <div className="p-4 bg-violet-50 border border-violet-100 rounded-3xl mb-4 animate-pulse">
                            <MessageSquare className="w-12 h-12 text-violet-500" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base">Chào mừng tới Trung tâm Tin nhắn!</h3>
                        <p className="text-slate-500 text-xs max-w-sm mt-2 leading-relaxed">
                            Hãy chọn một cuộc hội thoại ở danh sách bên trái hoặc nhấn vào biểu tượng Tạo nhóm để bắt đầu tán gẫu với bạn bè.
                        </p>
                    </div>
                )}
            </div>

            {/* Modal Tạo nhóm */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fadeIn">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm">Tạo nhóm chat mới</h3>
                            <button
                                onClick={() => {
                                    setShowGroupModal(false);
                                    setGroupName("");
                                    setSelectedFriends([]);
                                }}
                                className="text-slate-400 hover:text-slate-800 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Tên nhóm</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Ví dụ: Nhóm Học Tập..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-violet-600 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-2">Chọn thành viên</label>
                                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                    {friends.length > 0 ? (
                                        friends.map((f) => {
                                            const isSelected = selectedFriends.includes(f.id);
                                            return (
                                                <div
                                                    key={f.id}
                                                    onClick={() => toggleSelectFriend(f.id)}
                                                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition ${isSelected ? "bg-violet-50 border-violet-300" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-2.5">
                                                        <img
                                                            src={f.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                            alt="Avatar"
                                                        />
                                                        <span className="text-xs font-medium text-slate-800">{f.displayName}</span>
                                                    </div>
                                                    <Circle className={`w-4 h-4 ${isSelected ? "fill-violet-600 text-violet-600" : "text-slate-300"}`} />
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic text-center py-4">Bạn chưa có người bạn nào để tạo nhóm.</p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!groupName.trim() || selectedFriends.length === 0}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-md shadow-violet-600/20"
                            >
                                Tạo nhóm
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal quản lý thành viên nhóm */}
            {showMembersModal && selectedConv && (
                <GroupMembersModal
                    conversation={selectedConv}
                    onClose={() => setShowMembersModal(false)}
                    friends={friends}
                    onGroupUpdated={(updatedGroup) => {
                        setSelectedConv(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                groupRef: {
                                    ...prev.groupRef,
                                    members: updatedGroup.members
                                },
                                participants: updatedGroup.members.map(m => ({ userId: m.userId, joinedAt: m.joinedAt }))
                            };
                        });
                        // Cập nhật lại conversations list
                        setConversations(prev => prev.map(c => {
                            const cId = c._id || c.id;
                            const targetId = selectedConv._id || selectedConv.id;
                            if (cId === targetId) {
                                return {
                                    ...c,
                                    participants: updatedGroup.members.map(m => ({ userId: m.userId, joinedAt: m.joinedAt }))
                                };
                            }
                            return c;
                        }));
                    }}
                />
            )}
        </div>
    );
};

export default Messages;
