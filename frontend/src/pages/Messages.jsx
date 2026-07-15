import {useState, useEffect, useRef} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import {useSocket} from "../context/SocketContext";
import api from "../services/api";
import ImageLightboxModal from "../components/ImageLightboxModal";
import { compressImageBeforeUpload } from "../utils/imageCompressor";
import ChatMedia from "../components/chat/ChatMedia";
import RenderShareMessage from "../components/chat/RenderShareMessage";
import GroupMembersModal from "../components/chat/GroupMembersModal";
import CreateGroupModal from "../components/chat/CreateGroupModal";
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
    Trash2
} from "lucide-react";

const formatLastMessagePreview = (lastMsg) => {
    if (!lastMsg) return "Chưa có tin nhắn...";
    if (lastMsg.type === "image") return "Đã gửi tệp media";
    if (lastMsg.type === "share") return "Đã chia sẻ một bài viết";
    const content = lastMsg.content || "";
    if (content.trim().startsWith("{") && content.includes('"postId"')) {
        return "Đã chia sẻ một bài viết";
    }
    return content;
};

const Messages = () => {
    const {user: currentUser} = useAuth();
    const navigate = useNavigate();
    const {onlineUsers, chatSocket} = useSocket();

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

    // Multi-file media attachments & Lightbox Modal
    const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, previewUrl, isVideo }]
    const [isSending, setIsSending] = useState(false);
    const [activeLightboxUrl, setActiveLightboxUrl] = useState(null);

    const handleOpenLightbox = async (mId) => {
        try {
            const res = await api.get(`/media/file/${mId}?variant=original`, {responseType: "blob"});
            const objUrl = URL.createObjectURL(res.data);
            setActiveLightboxUrl(objUrl);
        } catch (err) {
            console.error("❌ Lỗi tải ảnh chất lượng cao gốc:", err.message);
        }
    };

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Thêm các state phân trang tin nhắn và container ref
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const chatContainerRef = useRef(null);

    // Scroll to bottom
    const scrollToBottom = (behavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({behavior});
    };

    // 1. Tải danh sách cuộc hội thoại của User
    const fetchConversations = async (showLoading = true) => {
        if (showLoading) setIsLoadingConvs(true);
        try {
            const res = await api.get("/conversations");
            if (res.data && res.data.success) {
                setConversations(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy danh sách hội thoại:", err.message);
        } finally {
            if (showLoading) setIsLoadingConvs(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (!chatSocket || !selectedConv) return;
        const cId = selectedConv._id || selectedConv.id;

        // Join room khi mở hội thoại và tự động re-join khi socket reconnect
        const joinRoom = () => {
            chatSocket.emit("conversation:join", {conversationId: cId});
            console.log(`📡 Đã kết nối & gửi yêu cầu join conversation room: ${cId}`);
        };

        joinRoom();
        chatSocket.on("connect", joinRoom);

        // Lắng nghe tin nhắn mới đúng cách: đăng ký listener ở cấp useEffect, không phải trong callback
        const handleNewMessage = (msg) => {
            if (String(msg.conversationId) === String(cId)) {
                const newMsg = {...msg, allowScroll: true};
                setMessages((prev) => [...prev, newMsg]);
                chatSocket.emit("message:read", {conversationId: cId, messageId: msg.id || msg._id});
                setTimeout(() => {
                    scrollToBottom("smooth");
                }, 50);
            }
            // Cập nhật lại conversation list (unread count, last message) ngầm, không làm nhấp nháy bar Hội thoại
            fetchConversations(false);
        };

        const handleReadAck = (ack) => {
            if (String(ack.conversationId) === String(cId)) {
                setConversations(prev => prev.map(c => {
                    const id = c._id || c.id;
                    if (String(id) === String(cId)) {
                        return {...c, unreadCount: 0};
                    }
                    return c;
                }));
            }
        };

        chatSocket.on("message:received", handleNewMessage);
        chatSocket.on("message:read:ack", handleReadAck);

        return () => {
            chatSocket.off("connect", joinRoom);
            chatSocket.off("message:received", handleNewMessage);
        };
    }, [chatSocket, selectedConv]);



    // 3. Khi chọn 1 cuộc hội thoại -> Tải danh sách tin nhắn lịch sử (Ban đầu lấy 10 tin nhắn gần nhất)
    useEffect(() => {
        if (!selectedConv) return;
        const cId = selectedConv._id || selectedConv.id;

        const fetchMessages = async () => {
            setIsLoadingMsgs(true);
            try {
                const res = await api.get(`/conversations/${cId}/messages?limit=10`);
                if (res.data && res.data.success) {
                    const fetchedMsgs = res.data.data?.data ? [...res.data.data.data].reverse() : [];
                    const enrichedMsgs = fetchedMsgs.map(msg => ({...msg, allowScroll: true}));
                    setMessages(enrichedMsgs);
                    setHasMore(res.data.data?.hasMore || false);
                    setNextCursor(res.data.data?.nextCursor || null);

                    // Đánh dấu đã đọc tất cả tin nhắn cũ
                    if (fetchedMsgs.length > 0 && chatSocket) {
                        const lastMsg = fetchedMsgs[fetchedMsgs.length - 1];
                        chatSocket.emit("message:read", {
                            conversationId: cId,
                            messageId: lastMsg.id || lastMsg._id
                        });
                    }

                    // Cuộn xuống dưới cùng sau khi tải xong
                    setTimeout(() => {
                        scrollToBottom("auto");
                    }, 50);
                }
            } catch (err) {
                console.error("❌ Lỗi tải lịch sử tin nhắn:", err.message);
            } finally {
                setIsLoadingMsgs(false);
            }
        };

        fetchMessages();
    }, [selectedConv, chatSocket]);

    const loadMoreMessages = async () => {
        if (!selectedConv || !nextCursor || isLoadingMore) return;
        const cId = selectedConv._id || selectedConv.id;
        setIsLoadingMore(true);

        const container = chatContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;
        const prevScrollTop = container ? container.scrollTop : 0;

        try {
            const res = await api.get(`/conversations/${cId}/messages?before=${nextCursor}&limit=10`);
            if (res.data && res.data.success) {
                const oldMsgs = res.data.data?.data ? [...res.data.data.data].reverse() : [];
                const enrichedOldMsgs = oldMsgs.map(msg => ({...msg, allowScroll: false}));
                setMessages(prev => [...enrichedOldMsgs, ...prev]);
                setHasMore(res.data.data?.hasMore || false);
                setNextCursor(res.data.data?.nextCursor || null);

                // Giữ vị trí cuộn không đổi
                if (container) {
                    setTimeout(() => {
                        const newScrollHeight = container.scrollHeight;
                        container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
                    }, 10);
                }
            }
        } catch (err) {
            console.error("❌ Lỗi tải thêm tin nhắn:", err.message);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const {scrollTop} = chatContainerRef.current;
        // Nếu cuộn lên gần trên cùng
        if (scrollTop <= 5 && hasMore && !isLoadingMore && !isLoadingMsgs) {
            loadMoreMessages();
        }
    };

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

            // Bước A: Nén ảnh tại Client & Upload tất cả file media đính kèm nếu có
            if (selectedFiles.length > 0) {
                const uploadPromises = selectedFiles.map(async (item) => {
                    let fileToUpload = item.file;
                    if (!item.isVideo && item.file.type.startsWith('image/') && item.file.type !== 'image/gif') {
                        try {
                            fileToUpload = await compressImageBeforeUpload(item.file);
                        } catch (err) {
                            console.warn('[COMPRESS] Messages fallback to raw file:', err.message);
                        }
                    }

                    const formData = new FormData();
                    formData.append("file", fileToUpload);
                    const res = await api.post("/media/upload", formData, {
                        headers: {"Content-Type": "multipart/form-data"}
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
            setTimeout(() => {
                scrollToBottom("smooth");
            }, 50);
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

        return {title, avatar, isOnline, other};
    };

    return (
        <div className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden h-[calc(100vh-4rem)] shadow-sm w-full">
            {/* Cột trái: Danh sách hội thoại */}
            <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                    <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        <span>Hội thoại</span>
                    </h2>
                    <button
                        onClick={handleOpenGroupModal}
                        title="Tạo nhóm mới"
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-650 hover:text-blue-600 border border-slate-200 rounded-xl transition cursor-pointer shadow-sm"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                </div>

                {/* Danh sách các cuộc hội thoại */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isLoadingConvs ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                        </div>
                    ) : conversations.length > 0 ? (
                        conversations.map((conv) => {
                            const cId = conv._id || conv.id;
                            const isSelected = selectedConv && (selectedConv._id === cId || selectedConv.id === cId);
                            const {title, avatar, isOnline} = getConvInfo(conv);

                            return (
                                <div
                                    key={cId}
                                    onClick={() => setSelectedConv(conv)}
                                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group ${isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-100"
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
                                            <h4 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition">
                                                {title}
                                            </h4>
                                            {conv.unreadCount > 0 ? (
                                                <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md shadow-rose-500/20 min-w-[18px] text-center group-hover:hidden animate-pulse">
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
                                        <p className="text-xs text-slate-500 mt-1 truncate">
                                            {formatLastMessagePreview(conv.lastMessage)}
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
                            const {title, avatar, isOnline} = getConvInfo(selectedConv);
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
                                            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
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
                                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 hover:text-blue-600 rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm"
                                        >
                                            <Users className="w-4 h-4" />
                                            <span>Thành viên</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Vùng nội dung danh sách tin nhắn */}
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
                        >
                            {isLoadingMore && (
                                <div className="flex justify-center items-center py-2 shrink-0">
                                    <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                                </div>
                            )}

                            {isLoadingMsgs ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader className="w-7 h-7 text-blue-600 animate-spin" />
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
                                                <span className="text-xs text-slate-500 font-semibold ml-10 select-none">
                                                    {sender.displayName}
                                                </span>
                                            )}

                                            <div className={`flex items-end space-x-2 ${isMe ? "justify-end" : "justify-start"} max-w-[80%]`}>
                                                {!isMe && (
                                                    <img
                                                        src={sender.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.senderId}`}
                                                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                                        alt="Sender Avatar"
                                                    />
                                                )}

                                                {/* Hiển thị Media đính kèm (Hình ảnh / Video) độc lập - Không bị lót viền màu tím */}
                                                {msg.type === "image" && msg.mediaId ? (
                                                    <div className={`flex flex-col space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                                                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm bg-black/5">
                                                            <ChatMedia
                                                                mediaId={msg.mediaId}
                                                                onLoad={msg.allowScroll ? () => scrollToBottom("smooth") : undefined}
                                                                onOpenLightbox={handleOpenLightbox}
                                                            />
                                                        </div>
                                                        {msg.content && msg.content !== "Sent an image" && (
                                                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                                                                }`}>
                                                                {msg.content}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : msg.type === "share" ? (
                                                    <RenderShareMessage msgContent={msg.content} isMe={isMe} onNavigate={navigate} />
                                                ) : (
                                                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${isMe
                                                        ? "bg-blue-600 text-white rounded-br-none"
                                                        : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                                                        }`}>
                                                        {msg.content}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-[10px] text-slate-400 select-none ${isMe ? "mr-1" : "ml-10"}`}>
                                                {msgTime}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm italic">
                                    Chưa có tin nhắn nào. Gửi lời chào để bắt đầu cuộc trò chuyện!
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Ô nhập tin nhắn */}
                        <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-200 bg-white space-y-3 shrink-0">
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
                                    className="p-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded-2xl transition cursor-pointer shrink-0"
                                >
                                    <ImageIcon className="w-5 h-5" />
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
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition"
                                />

                                <button
                                    type="submit"
                                    disabled={isSending || (!inputText.trim() && selectedFiles.length === 0)}
                                    className="p-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white rounded-2xl transition cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
                                >
                                    {isSending ? (
                                        <Loader className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 select-none">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-3xl mb-4 animate-pulse">
                            <MessageSquare className="w-12 h-12 text-blue-600" />
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
                <CreateGroupModal
                    onClose={() => {
                        setShowGroupModal(false);
                        setGroupName("");
                        setSelectedFriends([]);
                    }}
                    groupName={groupName}
                    setGroupName={setGroupName}
                    friends={friends}
                    selectedFriends={selectedFriends}
                    toggleSelectFriend={toggleSelectFriend}
                    onSubmit={handleCreateGroup}
                />
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
                                participants: updatedGroup.members.map(m => ({userId: m.userId, joinedAt: m.joinedAt}))
                            };
                        });
                        // Cập nhật lại conversations list
                        setConversations(prev => prev.map(c => {
                            const cId = c._id || c.id;
                            const targetId = selectedConv._id || selectedConv.id;
                            if (cId === targetId) {
                                return {
                                    ...c,
                                    participants: updatedGroup.members.map(m => ({userId: m.userId, joinedAt: m.joinedAt}))
                                };
                            }
                            return c;
                        }));
                    }}
                />
            )}

            {/* Modal Xem ảnh Fullscreen */}
            {activeLightboxUrl && (
                <ImageLightboxModal
                    imageUrl={activeLightboxUrl}
                    onClose={() => {
                        URL.revokeObjectURL(activeLightboxUrl);
                        setActiveLightboxUrl(null);
                    }}
                />
            )}
        </div>
    );
};

export default Messages;
