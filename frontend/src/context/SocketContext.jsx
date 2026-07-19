import { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import api from "../services/api";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notificationSocket, setNotificationSocket] = useState(null);
    const [chatSocket, setChatSocket] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toast, setToast] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState({}); // Lưu danh sách user đang online: { userId: true }
    const [incomingCall, setIncomingCall] = useState(null); // { callerId, callerName, callerAvatar, callType }
    const [activeCall, setActiveCall] = useState(null); // { targetUser, callType, isCaller, offerSdp }

    // 1. Tải số lượng tin chưa đọc ban đầu bằng REST API
    const fetchUnreadCount = async () => {
        try {
            const res = await api.get("/notifications/unread-count");
            if (res.data && res.data.success) {
                setUnreadCount(res.data.count || 0);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy số thông báo chưa đọc:", err.message);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) {
            // Ngắt kết nối các socket nếu logout
            if (notificationSocket) {
                notificationSocket.disconnect();
                setNotificationSocket(null);
            }
            if (chatSocket) {
                chatSocket.disconnect();
                setChatSocket(null);
            }
            setUnreadCount(0);
            setToast(null);
            setOnlineUsers({});
            return;
        }

        // Tải số lượng chưa đọc
        fetchUnreadCount();

        // Xác định socketBaseURL động dựa trên api.defaults.baseURL (bỏ đuôi /api nếu có)
        const apiBase = api.defaults.baseURL || "http://localhost:8080/api";
        const socketBaseURL = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

        // 2. Khởi tạo Notification Socket (qua đường dẫn /notification/socket.io/)
        const notifSock = io(socketBaseURL, {
            auth: (cb) => {
                cb({ token: localStorage.getItem("accessToken") });
            },
            path: "/notification/socket.io/",
            transports: ["websocket"],
            // Thêm header để bypass ngrok browser warning cho WebSocket upgrade request
            extraHeaders: {
                "ngrok-skip-browser-warning": "any-value"
            }
        });

        notifSock.on("connect", () => {
            console.log("⚡ Kết nối thành công tới Notification Socket!");
        });

        notifSock.on("connect_error", async (err) => {
            console.warn("⚠️ Lỗi kết nối Notification Socket:", err.message);
            if (err.message.includes("expired") || err.message.includes("Authentication error") || err.message.includes("Token missing")) {
                try {
                    // Gọi một API đơn giản để kích hoạt bộ lọc làm mới token của Axios
                    await api.get("/notifications/unread-count");
                    console.log("🔄 Đã làm mới token thành công, thử kết nối lại Notification Socket...");
                    notifSock.connect();
                } catch (refreshErr) {
                    console.error("❌ Không thể tự động làm mới token cho socket:", refreshErr.message);
                }
            }
        });

        notifSock.on("notification:count", (data) => {
            setUnreadCount(data.unreadCount);
        });

        notifSock.on("notification:new", (notification) => {
            console.log("📡 Nhận thông báo realtime:", notification);
            // Increment unread count instantly
            setUnreadCount(prev => prev + 1);
            
            // Dispatch custom event to notify open Notifications page
            window.dispatchEvent(new CustomEvent("notification-received", { detail: notification }));

            setToast({
                id: notification.id,
                message: notification.message,
                avatarUrl: notification.fromUser?.avatarUrl,
                type: notification.type,
                referenceId: notification.referenceId,
                referenceType: notification.referenceType,
                fromUser: notification.fromUser
            });

            const timer = setTimeout(() => {
                setToast(null);
            }, 4000);

            return () => clearTimeout(timer);
        });

        setNotificationSocket(notifSock);

        // 3. Khởi tạo Chat Socket (qua đường dẫn /chat/socket.io/)
        const chSock = io(socketBaseURL, {
            auth: (cb) => {
                cb({ token: localStorage.getItem("accessToken") });
            },
            path: "/chat/socket.io/",
            transports: ["websocket"],
            // Thêm header để bypass ngrok browser warning cho WebSocket upgrade request
            extraHeaders: {
                "ngrok-skip-browser-warning": "any-value"
            }
        });

        chSock.on("connect", () => {
            console.log("⚡ Kết nối thành công tới Chat Socket!");
        });

        chSock.on("connect_error", async (err) => {
            console.warn("⚠️ Lỗi kết nối Chat Socket:", err.message);
            if (err.message.includes("expired") || err.message.includes("Authentication error") || err.message.includes("Token missing")) {
                try {
                    // Gọi một API đơn giản để kích hoạt bộ lọc làm mới token của Axios
                    await api.get("/notifications/unread-count");
                    console.log("🔄 Đã làm mới token thành công, thử kết nối lại Chat Socket...");
                    chSock.connect();
                } catch (refreshErr) {
                    console.error("❌ Không thể tự động làm mới token cho socket:", refreshErr.message);
                }
            }
        });

        // Lắng nghe trạng thái trực tuyến của người dùng khác
        chSock.on("user:online", ({ userId }) => {
            console.log(`🟢 User ${userId} online`);
            setOnlineUsers(prev => ({ ...prev, [userId]: true }));
        });

        chSock.on("user:offline", ({ userId }) => {
            console.log(`🔴 User ${userId} offline`);
            setOnlineUsers(prev => {
                const updated = { ...prev };
                delete updated[userId];
                return updated;
            });
        });

        // Lắng nghe cuộc gọi đến (Realtime WebRTC Incoming Call)
        chSock.on("call:incoming", (data) => {
            console.log("📞 [SOCKET] Nhận cuộc gọi đến từ:", data);
            setIncomingCall(data);
        });

        setChatSocket(chSock);

        // Cleanup dọn dẹp các kết nối
        return () => {
            notifSock.disconnect();
            chSock.disconnect();
        };

    }, [isAuthenticated]);

    // Hàm chấp nhận cuộc gọi đến
    const handleAcceptIncomingCall = () => {
        if (!incomingCall || !chatSocket) return;

        chatSocket.emit("call:accept", {
            callerId: incomingCall.callerId
        });

        setActiveCall({
            targetUser: {
                id: incomingCall.callerId,
                displayName: incomingCall.isGroup ? (incomingCall.groupName || "Cuộc gọi nhóm") : incomingCall.callerName,
                avatarUrl: incomingCall.isGroup ? incomingCall.groupAvatar : incomingCall.callerAvatar,
                isGroup: incomingCall.isGroup || false,
                groupId: incomingCall.groupId || null
            },
            callType: incomingCall.callType,
            isCaller: false
        });

        setIncomingCall(null);
    };

    // Hàm từ chối cuộc gọi đến
    const handleRejectIncomingCall = () => {
        if (!incomingCall || !chatSocket) return;

        chatSocket.emit("call:reject", {
            callerId: incomingCall.callerId,
            reason: "rejected"
        });

        setIncomingCall(null);
    };

    // Hàm khởi tạo cuộc gọi từ Client (Hỗ trợ 1-1 và Gọi Nhóm)
    const initiateCall = (targetUser, callType = "video") => {
        if (!targetUser || !chatSocket) return;

        const targetId = targetUser.id || targetUser.userId || targetUser.groupId;
        if (!targetId && (!targetUser.targetUserIds || targetUser.targetUserIds.length === 0)) {
            console.error("❌ Không thể khởi tạo cuộc gọi: targetUserId/targetUserIds không hợp lệ", targetUser);
            return;
        }

        const normalizedTarget = {
            id: targetId,
            userId: targetId,
            displayName: targetUser.displayName || "Người dùng",
            avatarUrl: targetUser.avatarUrl || null,
            isGroup: targetUser.isGroup || false,
            groupId: targetUser.groupId || null,
            targetUserIds: targetUser.targetUserIds || null
        };

        setActiveCall({
            targetUser: normalizedTarget,
            callType,
            isCaller: true
        });
    };

    return (
        <SocketContext.Provider value={{ 
            notificationSocket, 
            chatSocket, 
            unreadCount, 
            setUnreadCount, 
            toast, 
            setToast,
            onlineUsers,
            setOnlineUsers,
            incomingCall,
            setIncomingCall,
            activeCall,
            setActiveCall,
            handleAcceptIncomingCall,
            handleRejectIncomingCall,
            initiateCall
        }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
