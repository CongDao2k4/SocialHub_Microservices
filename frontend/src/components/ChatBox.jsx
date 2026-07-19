import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { X, Send, Loader, Image, Phone, Video } from "lucide-react";

// Component con tải hình ảnh an toàn thông qua Axios (hỗ trợ headers như Authorization và ngrok-skip-browser-warning)
const ChatImage = ({ mediaId }) => {
    const [imageUrl, setImageUrl] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let localUrl = "";
        const fetchImage = async () => {
            try {
                // Tải blob ảnh/video trực tiếp qua /media/file/:id (kèm ngrok-skip-browser-warning header tự động)
                const res = await api.get(`/media/file/${mediaId}?variant=thumbnail`, { responseType: "blob" });
                localUrl = URL.createObjectURL(res.data);
                const type = res.data.type || "";
                setImageUrl({ url: localUrl, isVideo: type.startsWith("video/") });
            } catch (err) {
                console.error("❌ Lỗi tải ảnh chat:", err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (mediaId) {
            fetchImage();
        }

        return () => {
            if (localUrl) {
                URL.revokeObjectURL(localUrl);
            }
        };
    }, [mediaId]);

    if (isLoading) {
        return (
            <div className="w-40 h-28 flex items-center justify-center bg-white/5 animate-pulse rounded-lg">
                <Loader className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (!imageUrl) {
        return <p className="text-[10px] text-red-400 italic">Không tải được ảnh</p>;
    }

    if (imageUrl.isVideo) {
        return (
            <video
                src={imageUrl.url}
                controls
                className="rounded-lg max-h-48 max-w-full object-cover"
            />
        );
    }

    return (
        <img
            src={imageUrl.url}
            alt="Attached"
            className="rounded-lg max-h-48 object-contain cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(imageUrl.url, "_blank")}
        />
    );
};

// Component hiển thị tin nhắn chia sẻ bài viết đẹp mắt tương tự Facebook
const RenderShareMessage = ({ msgContent, isMe, onNavigate }) => {
    let data = null;
    try {
        data = JSON.parse(msgContent);
    } catch (e) {
        return <div className="text-[10px] italic text-slate-400">Tin nhắn chia sẻ (Không tải được nội dung)</div>;
    }

    return (
        <div className={`flex flex-col space-y-1 max-w-[200px] ${isMe ? "items-end" : "items-start"}`}>
            {/* Lời dẫn đi kèm (nếu có) */}
            {data.shareText && (
                <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                    isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                }`}>
                    {data.shareText}
                </div>
            )}
            
            {/* Block bài viết chia sẻ kiểu Facebook */}
            <div
                onClick={() => onNavigate(`/post/${data.postId}`)}
                className="bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-slate-100 rounded-xl overflow-hidden shadow-sm cursor-pointer transition duration-150 text-left w-full max-w-[190px] flex flex-col"
            >
                {/* Phần hình ảnh ở trên */}
                {data.mediaId ? (
                    <div className="w-full h-24 overflow-hidden bg-black/5 flex items-center justify-center border-b border-slate-200/60 relative shrink-0">
                        <ChatImage mediaId={data.mediaId} />
                        <div className="absolute top-1.5 left-1.5 flex items-center space-x-1 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/10 max-w-[90%] select-none">
                            <img
                                src={data.authorAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.postId}`}
                                className="w-3.5 h-3.5 rounded-full object-cover border border-white/20"
                                alt="Author"
                            />
                            <span className="font-bold text-[8px] text-white truncate">{data.authorName}</span>
                        </div>
                    </div>
                ) : null}

                {/* Phần nội dung text và logo ở dưới */}
                <div className="p-2.5 space-y-1.5">
                    {!data.mediaId && (
                        <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                            <img
                                src={data.authorAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.postId}`}
                                className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200"
                                alt="Author"
                            />
                            <span className="font-bold text-[9px] text-slate-850 truncate">{data.authorName}</span>
                        </div>
                    )}
                    
                    <p className="text-[9px] font-bold text-slate-800 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {data.postContent || "Bài viết không có nội dung văn bản."}
                    </p>

                    {/* Logo SocialHub chân trang tương tự Facebook */}
                    <div className="flex items-center space-x-1 text-[8px] text-slate-500 font-semibold pt-1.5 border-t border-slate-200/50 mt-1 select-none">
                        <img src="/logo.svg" alt="SocialHub Logo" className="w-3.5 h-3.5 object-contain" />
                        <span>SocialHub</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChatBox = ({ conversation, onClose, currentUserId }) => {
    const { chatSocket, initiateCall } = useSocket();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const messageEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Trạng thái đính kèm ảnh trong ô chat
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    const conversationId = conversation._id || conversation.id;
    
    // Tìm người trò chuyện đối phương
    const otherParticipant = conversation.participants?.find(p => p.userId !== currentUserId) || {
        displayName: "Người dùng",
        avatarUrl: null,
        userId: ""
    };

    const isGroup = conversation.type === "group";
    const chatTitle = isGroup
        ? conversation.groupRef?.name || "Cuộc trò chuyện nhóm"
        : otherParticipant.displayName;
    
    const chatAvatar = isGroup
        ? conversation.groupRef?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${conversationId}`
        : otherParticipant.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
        
    const chatSubtitle = isGroup
        ? `${conversation.participants?.length || 0} thành viên`
        : (conversation.isOnline || otherParticipant.isOnline ? "Trực tuyến" : "Ngoại tuyến");

    // 1a. Tải lịch sử tin nhắn
    useEffect(() => {
        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const res = await api.get(`/conversations/${conversationId}/messages?limit=40`);
                if (res.data && res.data.success) {
                    // Đảo ngược mảng tin nhắn lịch sử (từ mới nhất về cũ nhất sang cũ nhất tới mới nhất) để hiển thị đúng thứ tự thời gian
                    setMessages(res.data.data?.data ? [...res.data.data.data].reverse() : []);
                }
            } catch (error) {
                console.error("❌ Lỗi lấy tin nhắn lịch sử:", error.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();
    }, [conversationId]);

    // 1b. Join và tự động Re-join room Websocket khi socket mất kết nối rồi tự kết nối lại (reconnect)
    useEffect(() => {
        if (!chatSocket) return;

        const joinRoom = () => {
            chatSocket.emit("conversation:join", { conversationId });
            console.log(`📡 Đã kết nối & gửi yêu cầu join conversation room: ${conversationId}`);
        };

        joinRoom();

        // Lắng nghe sự kiện kết nối lại để tự động join lại room
        chatSocket.on("connect", joinRoom);

        return () => {
            chatSocket.off("connect", joinRoom);
        };
    }, [conversationId, chatSocket]);

    // 2. Lắng nghe tin nhắn mới & typing indicators từ socket
    useEffect(() => {
        if (!chatSocket) return;

        // Nhận tin nhắn mới
        const handleNewMessage = (message) => {
            // Ép kiểu sang String để tránh việc so sánh sai kiểu dữ liệu giữa ObjectId và String
            if (String(message.conversationId) === String(conversationId)) {
                setMessages(prev => [...prev, message]);
                // Đánh dấu đã đọc gửi ngược lại
                chatSocket.emit("message:read", { conversationId, messageId: message.id || message._id });
            }
        };

        // Nhận chỉ số đang gõ
        const handleTypingIndicator = (data) => {
            if (String(data.conversationId) === String(conversationId) && data.userId !== currentUserId) {
                setIsOtherUserTyping(data.isTyping);
            }
        };

        chatSocket.on("message:received", handleNewMessage);
        chatSocket.on("typing:indicator", handleTypingIndicator);

        return () => {
            chatSocket.off("message:received", handleNewMessage);
            chatSocket.off("typing:indicator", handleTypingIndicator);
        };
    }, [chatSocket, conversationId, currentUserId]);

    // 3. Cuộn xuống cuối khi có tin mới
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOtherUserTyping]);

    // 4. Xử lý gõ phím & báo hiệu "đang gõ..."
    const handleInputChange = (e) => {
        setInputText(e.target.value);

        if (!chatSocket) return;

        if (!isTyping) {
            setIsTyping(true);
            chatSocket.emit("typing:start", { conversationId });
        }

        // Tạo trễ tắt chỉ số đang gõ sau 1.5 giây không nhập
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            chatSocket.emit("typing:stop", { conversationId });
        }, 1500);
    };

    // 4b. Chọn ảnh đính kèm
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // 4c. Xóa ảnh đính kèm đã chọn
    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // 4d. Dán ảnh trực tiếp từ clipboard
    const handleInputPaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    setImageFile(blob);
                    const previewUrl = URL.createObjectURL(blob);
                    setImagePreview(previewUrl);
                    e.preventDefault(); // Ngăn hiển thị text nhị phân
                    break;
                }
            }
        }
    };

    // 5. Gửi tin nhắn (Hỗ trợ cả tin nhắn văn bản và tin nhắn hình ảnh)
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!inputText.trim() && !imageFile) || !chatSocket) return;

        setIsSubmitting(true);
        let mediaId = null;

        try {
            // Bước A: Nếu có hình ảnh đính kèm, tải lên media-service trước qua Gateway
            if (imageFile) {
                const formData = new FormData();
                formData.append("file", imageFile);

                const uploadRes = await api.post("/media/upload", formData);

                if (uploadRes.data && uploadRes.data.id) {
                    mediaId = uploadRes.data.id;
                }
            }

            // Bước B: Gửi payload tin nhắn qua socket
            chatSocket.emit("message:send", {
                conversationId,
                content: inputText.trim(),
                type: mediaId ? "image" : "text",
                mediaId
            });

            // Dọn dẹp trạng thái gõ chữ
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setIsTyping(false);
            chatSocket.emit("typing:stop", { conversationId });

            setInputText("");
            handleRemoveImage();
        } catch (error) {
            console.error("❌ Lỗi khi gửi tin nhắn:", error);
            alert("Không thể gửi tin nhắn!");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-80 bg-white border border-slate-200 rounded-t-2xl shadow-xl flex flex-col h-[400px]">
            {/* Header hộp thoại */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <div className="flex items-center space-x-2.5">
                    <img
                        src={chatAvatar}
                        className="w-8 h-8 rounded-full object-cover"
                        alt="Avatar"
                    />
                    <div className="truncate max-w-[150px]">
                        <h4 className="font-semibold text-slate-800 text-xs truncate">{chatTitle}</h4>
                        <p className="text-[10px] text-slate-500">
                            {chatSubtitle}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => initiateCall(
                            isGroup ? {
                                id: conversation.groupRef?._id || conversationId,
                                displayName: chatTitle,
                                avatarUrl: chatAvatar,
                                isGroup: true,
                                groupId: conversation.groupRef?._id || conversationId,
                                targetUserIds: conversation.participants?.map(p => p.userId).filter(id => String(id) !== String(currentUserId)) || []
                            } : {
                                id: otherParticipant.userId,
                                displayName: otherParticipant.displayName,
                                avatarUrl: otherParticipant.avatarUrl
                            }, "audio"
                        )}
                        title={isGroup ? "Gọi thoại nhóm" : "Gọi thoại"}
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                    >
                        <Phone className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => initiateCall(
                            isGroup ? {
                                id: conversation.groupRef?._id || conversationId,
                                displayName: chatTitle,
                                avatarUrl: chatAvatar,
                                isGroup: true,
                                groupId: conversation.groupRef?._id || conversationId,
                                targetUserIds: conversation.participants?.map(p => p.userId).filter(id => String(id) !== String(currentUserId)) || []
                            } : {
                                id: otherParticipant.userId,
                                displayName: otherParticipant.displayName,
                                avatarUrl: otherParticipant.avatarUrl
                            }, "video"
                        )}
                        title={isGroup ? "Gọi Video nhóm" : "Gọi Video"}
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition cursor-pointer"
                    >
                        <Video className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Vùng tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-50/50">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                ) : messages.length > 0 ? (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === currentUserId;
                        const msgTime = new Date(msg.createdAt || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const sender = conversation.participants?.find(p => p.userId === msg.senderId) || {
                            displayName: "Thành viên",
                            avatarUrl: null
                        };
                        
                        return (
                            <div key={msg.id || msg._id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}>
                                {/* Tên người gửi nếu là group và không phải mình */}
                                {!isMe && isGroup && (
                                    <span className="text-[9px] text-slate-500 font-semibold ml-8.5 select-none">
                                        {sender.displayName}
                                    </span>
                                )}
                                <div className={`flex items-end space-x-2 ${isMe ? "justify-end" : "justify-start"} max-w-[85%]`}>
                                    {/* Avatar người gửi đối phương */}
                                    {!isMe && (
                                        <img
                                            src={sender.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.senderId}`}
                                            className="w-6.5 h-6.5 rounded-full object-cover border border-slate-200 flex-shrink-0"
                                            alt="Sender Avatar"
                                        />
                                    )}
                                    
                                    {msg.type === "image" && msg.mediaId ? (
                                        <div className={`flex flex-col space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black/5">
                                                <ChatImage mediaId={msg.mediaId} />
                                            </div>
                                            {msg.content && msg.content !== "Sent an image" && (
                                                <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                                                    isMe
                                                        ? "bg-blue-600 text-white rounded-br-none"
                                                        : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                                                }`}>
                                                    {msg.content}
                                                </div>
                                            )}
                                        </div>
                                    ) : msg.type === "share" ? (
                                        <RenderShareMessage msgContent={msg.content} isMe={isMe} onNavigate={navigate} />
                                    ) : (
                                        <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                                            isMe
                                                ? "bg-blue-600 text-white rounded-br-none"
                                                : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                                        }`}>
                                            {msg.content}
                                        </div>
                                    )}
                                </div>
                                {/* Thời gian gửi tin nhắn */}
                                <span className={`text-[8px] text-slate-400 select-none ${isMe ? "mr-1" : "ml-8.5"}`}>
                                    {msgTime}
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-slate-400 text-[10px] py-12">Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên!</div>
                )}
                
                {/* Chỉ chỉ số đang gõ */}
                {isOtherUserTyping && (
                    <div className="flex items-center space-x-2 text-slate-500 text-[10px] italic">
                        <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        <span>Đang nhập...</span>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            {/* Input gõ tin nhắn */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
                {/* Phần hiển thị ảnh xem trước (Preview) */}
                {imagePreview && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-20 max-w-[120px] flex items-center bg-white">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain max-h-20" />
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                <div className="flex items-center space-x-2">
                    {/* Nút đính kèm ảnh */}
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="p-2 bg-white border border-slate-200 hover:bg-slate-100 hover:border-blue-600 text-slate-500 hover:text-blue-600 rounded-xl transition cursor-pointer disabled:opacity-50"
                        title="Đính kèm ảnh"
                    >
                        <Image className="w-4 h-4" />
                    </button>

                    <input
                        type="text"
                        value={inputText}
                        onChange={handleInputChange}
                        onPaste={handleInputPaste}
                        placeholder={isSubmitting ? "Đang gửi..." : "Aa..."}
                        disabled={isSubmitting}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting || (!inputText.trim() && !imageFile)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
                    >
                        {isSubmitting ? (
                            <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatBox;
