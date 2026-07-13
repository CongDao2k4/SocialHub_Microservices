import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { X, Send, Loader, Image } from "lucide-react"; // <-- Import thêm Image

// Component con tải hình ảnh an toàn thông qua Axios (hỗ trợ headers như Authorization và ngrok-skip-browser-warning)
const ChatImage = ({ mediaId }) => {
    const [imageUrl, setImageUrl] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let localUrl = "";
        const fetchImage = async () => {
            try {
                // 1. Lấy url tương đối của ảnh từ gateway
                const res = await api.get(`/media/${mediaId}/url`);
                if (res.data && res.data.url) {
                    const url = res.data.url;
                    const fullUrl = url.startsWith("http") ? url : `${api.defaults.baseURL}${url}`;
                    
                    // 2. Tải blob ảnh kèm các header cần thiết
                    const imgRes = await api.get(fullUrl, { responseType: "blob" });
                    localUrl = URL.createObjectURL(imgRes.data);
                    setImageUrl(localUrl);
                }
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
                <Loader className="w-4 h-4 text-violet-500 animate-spin" />
            </div>
        );
    }

    if (!imageUrl) {
        return <p className="text-[10px] text-red-400 italic">Không tải được ảnh</p>;
    }

    return (
        <img
            src={imageUrl}
            alt="Attached"
            className="rounded-lg max-h-48 object-contain cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(imageUrl, "_blank")}
        />
    );
};

const ChatBox = ({ conversation, onClose, currentUserId }) => {
    const { chatSocket } = useSocket();
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

                const uploadRes = await api.post("/media/upload", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                });

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
        <div className="w-80 bg-slate-900 border border-white/10 rounded-t-2xl shadow-2xl flex flex-col h-[400px]">
            {/* Header hộp thoại */}
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-slate-950/60 rounded-t-2xl">
                <div className="flex items-center space-x-2.5">
                    <img
                        src={otherParticipant.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        className="w-8 h-8 rounded-full object-cover"
                        alt="Avatar"
                    />
                    <div className="truncate max-w-[150px]">
                        <h4 className="font-semibold text-white text-xs truncate">{otherParticipant.displayName}</h4>
                        <p className="text-[10px] text-slate-400">
                            {conversation.isOnline || otherParticipant.isOnline ? "Trực tuyến" : "Ngoại tuyến"}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition cursor-pointer">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Vùng tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-950/20">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader className="w-6 h-6 text-violet-500 animate-spin" />
                    </div>
                ) : messages.length > 0 ? (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === currentUserId;
                        const msgTime = new Date(msg.createdAt || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        return (
                            <div key={msg.id || msg._id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}>
                                <div className={`flex items-end space-x-2 ${isMe ? "justify-end" : "justify-start"} max-w-[85%]`}>
                                    {/* Avatar người gửi đối phương */}
                                    {!isMe && (
                                        <img
                                            src={msg.senderAvatar || otherParticipant.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                            className="w-6.5 h-6.5 rounded-full object-cover border border-white/10 flex-shrink-0"
                                            alt="Sender Avatar"
                                        />
                                    )}
                                    
                                    <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
                                        isMe
                                            ? "bg-violet-600 text-white rounded-br-none"
                                            : "bg-slate-800 text-slate-200 rounded-bl-none border border-white/5"
                                    }`}>
                                        {msg.type === "image" && msg.mediaId ? (
                                            <div className="space-y-1.5">
                                                <ChatImage mediaId={msg.mediaId} />
                                                {msg.content && msg.content !== "Sent an image" && (
                                                    <p className="mt-1 text-slate-200">{msg.content}</p>
                                                )}
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                                {/* Thời gian gửi tin nhắn */}
                                <span className={`text-[8px] text-slate-500 select-none ${isMe ? "mr-1" : "ml-8.5"}`}>
                                    {msgTime}
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-slate-500 text-[10px] py-12">Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên!</div>
                )}
                
                {/* Chỉ chỉ số đang gõ */}
                {isOtherUserTyping && (
                    <div className="flex items-center space-x-2 text-slate-400 text-[10px] italic">
                        <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        <span>Đang nhập...</span>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            {/* Input gõ tin nhắn */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-slate-950/40 space-y-2">
                {/* Phần hiển thị ảnh xem trước (Preview) */}
                {imagePreview && (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 max-h-20 max-w-[120px] flex items-center bg-slate-950">
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
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/50 text-slate-400 hover:text-violet-400 rounded-xl transition cursor-pointer disabled:opacity-50"
                        title="Đính kèm ảnh"
                    >
                        <Image className="w-4 h-4" />
                    </button>

                    <input
                        type="text"
                        value={inputText}
                        onChange={handleInputChange}
                        placeholder={isSubmitting ? "Đang gửi..." : "Aa..."}
                        disabled={isSubmitting}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting || (!inputText.trim() && !imageFile)}
                        className="p-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
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
