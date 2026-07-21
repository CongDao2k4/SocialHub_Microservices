import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2, Users } from "lucide-react";
import api from "../services/api";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:global.stun.twilio.com:3478" }
    ]
};

// Sub-component hiển thị từng ô tham gia cuộc gọi nhóm kiểu Google Meet / Zoom
const GroupParticipantTile = ({ participant, callType }) => {
    const videoRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        if (participant.stream) {
            if (videoRef.current) {
                videoRef.current.srcObject = participant.stream;
            }
            if (audioRef.current) {
                audioRef.current.srcObject = participant.stream;
                audioRef.current.play().catch(err => {
                    console.warn("⚠️ Trình duyệt hoãn autoplay âm thanh nhóm:", err.message);
                });
            }
        }
    }, [participant.stream]);

    return (
        <div className="relative bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg aspect-video">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            {/* Thẻ audio ngầm phát tiếng kể cả khi tắt camera */}
            <audio ref={audioRef} autoPlay playsInline className="hidden" />

            {(!participant.stream || callType === 'audio') && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center space-y-2">
                    <img
                        src={participant.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt={participant.displayName}
                        className="w-16 h-16 rounded-full border-2 border-slate-600 object-cover"
                    />
                    <span className="text-white text-xs font-semibold">{participant.displayName}</span>
                </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-lg text-[11px] text-white font-medium flex items-center space-x-1.5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[120px]">{participant.displayName}</span>
            </div>
        </div>
    );
};

const CallWindow = ({ activeCall, chatSocket, currentUserId, onClose }) => {
    if (!activeCall) return null;

    const { targetUser = {}, callType = 'video', isCaller = false } = activeCall;
    const isGroup = targetUser?.isGroup || false;
    const groupId = targetUser?.groupId || targetUser?.id;

    const [callStatus, setCallStatus] = useState(isCaller ? "calling" : "connecting");
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [duration, setDuration] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Dành cho Cuộc gọi nhóm: Danh sách các thành viên đang tham gia cuộc gọi
    const [groupParticipants, setGroupParticipants] = useState([]);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const groupPeersRef = useRef({});
    const localStreamRef = useRef(null);
    const pendingCandidatesRef = useRef([]);
    const pendingOfferRef = useRef(null);
    const isMediaReadyRef = useRef(false);

    const targetTargetId = targetUser?.id || targetUser?.userId || targetUser?.groupId || '';

    // Tối ưu hóa băng thông & chất lượng mic với Opus Codec
    const tuneOpusAudioSDP = (sdpObj) => {
        if (!sdpObj || !sdpObj.sdp) return sdpObj;
        let sdpStr = sdpObj.sdp;
        if (sdpStr.includes("a=fmtp:111")) {
            sdpStr = sdpStr.replace(
                "a=fmtp:111 ",
                "a=fmtp:111 maxaveragebitrate=128000;usedtx=0;useinbandfec=1;"
            );
        }
        return {
            type: sdpObj.type,
            sdp: sdpStr
        };
    };

    // Helper xử lý SDP Offer 1-1 (bao gồm cả khi Offer đến trước khi media sẵn sàng)
    const process1on1Offer = async (pc, sdp, targetId) => {
        try {
            console.log("📥 [WEBRTC 1-1] Xử lý SDP Offer từ đối phương:", targetId);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const rawAnswer = await pc.createAnswer();
            const answer = tuneOpusAudioSDP(rawAnswer);
            await pc.setLocalDescription(answer);

            chatSocket.emit("webrtc:answer", {
                targetUserId: targetId,
                sdp: answer
            });

            // Xử lý các ICE Candidate đến sớm nằm trong bộ đệm
            while (pendingCandidatesRef.current.length > 0) {
                const candidate = pendingCandidatesRef.current.shift();
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn("⚠️ Lỗi thêm pending ICE candidate 1-1:", e.message);
                }
            }
        } catch (err) {
            console.error("❌ Lỗi xử lý SDP Offer 1-1:", err);
        }
    };

    // Helper tạo PeerConnection cho một thành viên trong nhóm
    const createPeerConnectionForGroupMember = async (peerUserId, peerDisplayName, peerAvatarUrl, iceConfig) => {
        if (groupPeersRef.current[peerUserId]?.pc) {
            return groupPeersRef.current[peerUserId].pc;
        }

        const pc = new RTCPeerConnection(iceConfig);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        pc.ontrack = (event) => {
            console.log(`⚡ [GROUP WEBRTC] Nhận stream từ ${peerDisplayName} (${peerUserId})`);
            const stream = event.streams[0];
            groupPeersRef.current[peerUserId] = {
                ...groupPeersRef.current[peerUserId],
                stream
            };

            setGroupParticipants(prev => {
                const existingIndex = prev.findIndex(p => p.userId === peerUserId);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...updated[existingIndex], stream };
                    return updated;
                }
                return [...prev, { userId: peerUserId, displayName: peerDisplayName, avatarUrl: peerAvatarUrl, stream }];
            });
            setCallStatus("connected");
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && chatSocket) {
                chatSocket.emit("webrtc:ice-candidate", {
                    targetUserId: peerUserId,
                    candidate: event.candidate
                });
            }
        };

        groupPeersRef.current[peerUserId] = {
            pc,
            displayName: peerDisplayName,
            avatarUrl: peerAvatarUrl,
            stream: null,
            pendingCandidates: []
        };

        return pc;
    };

    // Timer đếm thời lượng cuộc gọi khi đã kết nối thành công
    useEffect(() => {
        let timer = null;
        if (callStatus === "connected") {
            timer = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [callStatus]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Khởi tạo WebRTC Connection và Media Stream
    useEffect(() => {
        let isSubscribed = true;

        const setupWebRTC = async () => {
            try {
                let serversConfig = ICE_SERVERS;
                try {
                    const res = await api.get("/conversations/ice-servers");
                    if (res.data && res.data.success && res.data.data.iceServers) {
                        serversConfig = { iceServers: res.data.data.iceServers };
                    }
                } catch (apiErr) {
                    console.warn("⚠️ Fallback ICE Servers:", apiErr);
                }

                // 1. Xin quyền Camera / Micro (Tối ưu độ phân giải 480p cho gọi nhóm để tiết kiệm băng thông và CPU)
                const constraints = {
                    audio: true,
                    video: callType === "video" 
                        ? (isGroup 
                            ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }
                            : { width: { ideal: 1280 }, height: { ideal: 720 } })
                        : false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (!isSubscribed) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                isMediaReadyRef.current = true;

                // TRƯỜNG HỢP A: CUỘC GỌI NHÓM (Zoom / Google Meet Style)
                if (isGroup) {
                    // Đảm bảo tất cả các peer connection nhóm đã được gán localStream tracks
                    Object.values(groupPeersRef.current).forEach(peerObj => {
                        if (peerObj && peerObj.pc) {
                            const senders = peerObj.pc.getSenders();
                            stream.getTracks().forEach(track => {
                                const hasTrack = senders.some(s => s.track && s.track.kind === track.kind);
                                if (!hasTrack) {
                                    peerObj.pc.addTrack(track, stream);
                                }
                            });
                        }
                    });

                    chatSocket.emit("group-call:join", { groupId });

                    if (isCaller && targetUser?.targetUserIds) {
                        chatSocket.emit("call:initiate", {
                            groupId,
                            targetUserIds: targetUser.targetUserIds,
                            groupName: targetUser.displayName,
                            groupAvatar: targetUser.avatarUrl,
                            callType
                        });
                    }
                } else {
                    // TRƯỜNG HỢP B: CUỘC GỌI 1-1 (1-on-1 Call)
                    const pc = new RTCPeerConnection(serversConfig);
                    peerConnectionRef.current = pc;

                    stream.getTracks().forEach(track => pc.addTrack(track, stream));

                    pc.ontrack = (event) => {
                        console.log("⚡ [WEBRTC 1-1] Nhận luồng remote media thành công:", event.streams[0]);
                        const remoteStream = event.streams[0];
                        if (remoteStream) {
                            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                            if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
                        }
                        setCallStatus("connected");
                    };

                    pc.onicecandidate = (event) => {
                        if (event.candidate && chatSocket && targetTargetId) {
                            chatSocket.emit("webrtc:ice-candidate", {
                                targetUserId: targetTargetId,
                                candidate: event.candidate
                            });
                        }
                    };

                    if (isCaller) {
                        chatSocket.emit("call:initiate", {
                            targetUserId: targetTargetId,
                            callType
                        });
                    } else if (pendingOfferRef.current) {
                        // Nếu là Callee và đã nhận Offer nằm trong bộ đệm khi media đang khởi tạo
                        const offerToProcess = pendingOfferRef.current;
                        pendingOfferRef.current = null;
                        await process1on1Offer(pc, offerToProcess, targetTargetId);
                    }
                }

            } catch (err) {
                console.error("❌ Lỗi khởi tạo WebRTC:", err);
                alert("Không thể truy cập Micro hoặc Camera của bạn!");
                handleEndCall();
            }
        };

        setupWebRTC();

        return () => {
            isSubscribed = false;
            isMediaReadyRef.current = false;
        };
    }, []);

    // Xử lý các Socket Event về WebRTC & Group Call Rooms
    useEffect(() => {
        if (!chatSocket) return;

        // --- XỬ LÝ SỰ KIỆN GỌI NHÓM (GROUP MEET ROOM) ---
        const handleGroupJoinedRoom = async ({ existingParticipants }) => {
            console.log("👥 [GROUP MEET] Tham gia phòng họp nhóm thành công. Các thành viên hiện có:", existingParticipants);
            setCallStatus("connected");

            let serversConfig = ICE_SERVERS;
            try {
                const res = await api.get("/conversations/ice-servers");
                if (res.data?.data?.iceServers) serversConfig = { iceServers: res.data.data.iceServers };
            } catch (e) {}

            for (const peer of existingParticipants) {
                const pc = await createPeerConnectionForGroupMember(peer.userId, peer.displayName, peer.avatarUrl, serversConfig);
                
                if (localStreamRef.current) {
                    const senders = pc.getSenders();
                    localStreamRef.current.getTracks().forEach(track => {
                        const hasTrack = senders.some(s => s.track && s.track.kind === track.kind);
                        if (!hasTrack) {
                            pc.addTrack(track, localStreamRef.current);
                        }
                    });
                }

                const rawOffer = await pc.createOffer();
                const offer = tuneOpusAudioSDP(rawOffer);
                await pc.setLocalDescription(offer);

                chatSocket.emit("webrtc:offer", {
                    targetUserId: peer.userId,
                    sdp: offer
                });
            }
        };

        const handleGroupUserJoined = async ({ userId, displayName, avatarUrl }) => {
            console.log(`👥 [GROUP MEET] Thành viên mới gia nhập cuộc gọi: ${displayName} (${userId})`);
            setCallStatus("connected");
            setGroupParticipants(prev => {
                if (prev.some(p => p.userId === userId)) return prev;
                return [...prev, { userId, displayName, avatarUrl, stream: null }];
            });

            // Khởi tạo sẵn PeerConnection cho thành viên mới (chờ nhận Offer từ người mới gia nhập)
            let serversConfig = ICE_SERVERS;
            try {
                const res = await api.get("/conversations/ice-servers");
                if (res.data?.data?.iceServers) serversConfig = { iceServers: res.data.data.iceServers };
            } catch (e) {}

            await createPeerConnectionForGroupMember(userId, displayName, avatarUrl, serversConfig);
        };

        const handleGroupUserLeft = ({ userId }) => {
            console.log(`👥 [GROUP MEET] Thành viên đã rời cuộc gọi: ${userId}`);
            if (groupPeersRef.current[userId]) {
                groupPeersRef.current[userId].pc.close();
                delete groupPeersRef.current[userId];
            }
            setGroupParticipants(prev => prev.filter(p => p.userId !== userId));
        };

        // --- XỬ LÝ SỰ KIỆN WEBRTC P2P (DÙNG CHUNG / 1-1) ---
        const handleCallAccepted = async () => {
            console.log("✅ [CALL 1-1] Đối phương đã nghe máy, đang tạo SDP Offer...");
            setCallStatus("connected");
            if (!isGroup && peerConnectionRef.current) {
                const rawOffer = await peerConnectionRef.current.createOffer();
                const offer = tuneOpusAudioSDP(rawOffer);
                await peerConnectionRef.current.setLocalDescription(offer);
                chatSocket.emit("webrtc:offer", {
                    targetUserId: targetTargetId,
                    sdp: offer
                });
            }
        };

        const handleIncomingOffer = async ({ senderId, sdp }) => {
            let serversConfig = ICE_SERVERS;
            try {
                const res = await api.get("/conversations/ice-servers");
                if (res.data?.data?.iceServers) serversConfig = { iceServers: res.data.data.iceServers };
            } catch (e) {}

            if (isGroup) {
                const pc = await createPeerConnectionForGroupMember(senderId, "Thành viên nhóm", null, serversConfig);
                
                if (localStreamRef.current) {
                    const senders = pc.getSenders();
                    localStreamRef.current.getTracks().forEach(track => {
                        const hasTrack = senders.some(s => s.track && s.track.kind === track.kind);
                        if (!hasTrack) {
                            pc.addTrack(track, localStreamRef.current);
                        }
                    });
                }

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const rawAnswer = await pc.createAnswer();
                const answer = tuneOpusAudioSDP(rawAnswer);
                await pc.setLocalDescription(answer);

                chatSocket.emit("webrtc:answer", {
                    targetUserId: senderId,
                    sdp: answer
                });
            } else {
                if (String(senderId) !== String(targetTargetId)) return;
                const pc = peerConnectionRef.current;
                if (!pc || !isMediaReadyRef.current) {
                    console.log("⏳ [WEBRTC 1-1] PeerConnection/Media chưa sẵn sàng, lưu SDP Offer vào bộ đệm pending");
                    pendingOfferRef.current = sdp;
                    return;
                }

                await process1on1Offer(pc, sdp, senderId);
            }
        };

        const handleIncomingAnswer = async ({ senderId, sdp }) => {
            if (isGroup) {
                const peerObj = groupPeersRef.current[senderId];
                if (peerObj && peerObj.pc) {
                    await peerObj.pc.setRemoteDescription(new RTCSessionDescription(sdp));
                    
                    // Flush pending candidates cho group peer
                    if (peerObj.pendingCandidates && peerObj.pendingCandidates.length > 0) {
                        while (peerObj.pendingCandidates.length > 0) {
                            const candidate = peerObj.pendingCandidates.shift();
                            try {
                                await peerObj.pc.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (e) {
                                console.warn("⚠️ Lỗi thêm pending candidate nhóm:", e.message);
                            }
                        }
                    }
                }
            } else {
                if (String(senderId) !== String(targetTargetId)) return;
                const pc = peerConnectionRef.current;
                if (pc) {
                    console.log("📥 [WEBRTC 1-1] Nhận SDP Answer từ đối phương:", senderId);
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                    // Flush các candidate đến trước trong bộ đệm
                    while (pendingCandidatesRef.current.length > 0) {
                        const candidate = pendingCandidatesRef.current.shift();
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {}
                    }
                }
            }
        };

        const handleIncomingIceCandidate = async ({ senderId, candidate }) => {
            if (isGroup) {
                const peerObj = groupPeersRef.current[senderId];
                if (peerObj && peerObj.pc && peerObj.pc.remoteDescription && peerObj.pc.remoteDescription.type) {
                    try {
                        await peerObj.pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn("⚠️ Lỗi thêm ICE candidate nhóm:", err.message);
                    }
                } else if (peerObj) {
                    if (!peerObj.pendingCandidates) peerObj.pendingCandidates = [];
                    peerObj.pendingCandidates.push(candidate);
                }
            } else {
                if (String(senderId) !== String(targetTargetId)) return;
                const pc = peerConnectionRef.current;
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn("⚠️ Lỗi thêm ICE candidate:", err.message);
                    }
                } else {
                    console.log("⏳ [WEBRTC 1-1] Lưu ICE candidate vào bộ đệm pending");
                    pendingCandidatesRef.current.push(candidate);
                }
            }
        };

        const handleCallRejected = ({ reason }) => {
            if (!isGroup) {
                alert(reason === 'offline' ? 'Người dùng đang ngoại tuyến.' : 'Cuộc gọi bị từ chối.');
                cleanupWebRTC();
                onClose();
            }
        };

        const handleCallEnded = () => {
            cleanupWebRTC();
            onClose();
        };

        chatSocket.on("call:accepted", handleCallAccepted);
        chatSocket.on("webrtc:offer", handleIncomingOffer);
        chatSocket.on("webrtc:answer", handleIncomingAnswer);
        chatSocket.on("webrtc:ice-candidate", handleIncomingIceCandidate);
        chatSocket.on("call:rejected", handleCallRejected);
        chatSocket.on("call:ended", handleCallEnded);

        // Subscriptions cho Group Meet
        chatSocket.on("group-call:joined-room", handleGroupJoinedRoom);
        chatSocket.on("group-call:user-joined", handleGroupUserJoined);
        chatSocket.on("group-call:user-left", handleGroupUserLeft);

        return () => {
            chatSocket.off("call:accepted", handleCallAccepted);
            chatSocket.off("webrtc:offer", handleIncomingOffer);
            chatSocket.off("webrtc:answer", handleIncomingAnswer);
            chatSocket.off("webrtc:ice-candidate", handleIncomingIceCandidate);
            chatSocket.off("call:rejected", handleCallRejected);
            chatSocket.off("call:ended", handleCallEnded);

            chatSocket.off("group-call:joined-room", handleGroupJoinedRoom);
            chatSocket.off("group-call:user-joined", handleGroupUserJoined);
            chatSocket.off("group-call:user-left", handleGroupUserLeft);
        };
    }, [chatSocket, targetTargetId, isGroup, groupId]);

    // Dọn dẹp tất cả tài nguyên WebRTC khi tắt cuộc gọi
    const cleanupWebRTC = () => {
        if (isGroup && chatSocket && groupId) {
            chatSocket.emit("group-call:leave", { groupId });
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        Object.values(groupPeersRef.current).forEach(peerObj => {
            if (peerObj.pc) peerObj.pc.close();
        });
        groupPeersRef.current = {};
    };

    // Người dùng ngắt máy
    const handleEndCall = () => {
        if (!isGroup && chatSocket && targetTargetId) {
            chatSocket.emit("call:end", { targetUserId: targetTargetId });
        }
        cleanupWebRTC();
        onClose();
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    return (
        <div
            className={`fixed z-50 transition-all duration-300 ${isMinimized
                ? "bottom-4 right-4 w-72 h-44 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900"
                : "inset-0 bg-slate-950/95 flex items-center justify-center p-4"
                }`}
        >
            <div className={`relative w-full h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl ${isMinimized ? '' : 'max-w-5xl max-h-[90vh]'}`}>

                {/* Header thanh công cụ */}
                <div className="absolute top-0 inset-x-0 p-4 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center space-x-3">
                        <img
                            src={targetUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt={targetUser?.displayName || "Người dùng"}
                            className="w-10 h-10 rounded-full border border-slate-600 object-cover"
                        />
                        <div>
                            <h4 className="text-white font-bold text-sm flex items-center space-x-2">
                                <span>{targetUser?.displayName || "Cuộc gọi nhóm"}</span>
                                {isGroup && (
                                    <span className="bg-blue-600/30 border border-blue-500/40 text-blue-400 text-[10px] px-2 py-0.5 rounded-full flex items-center space-x-1">
                                        <Users className="w-3 h-3" />
                                        <span>{groupParticipants.length + 1} người</span>
                                    </span>
                                )}
                            </h4>
                            <p className="text-xs text-slate-300 font-mono">
                                {callStatus === "connected" ? formatDuration(duration) : callStatus === "calling" ? "Đang đổ chuông..." : "Đang kết nối..."}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur transition cursor-pointer"
                    >
                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </button>
                </div>

                {/* Vùng xem Stream Video/Audio */}
                <div className="relative flex-1 bg-slate-950 p-4 pt-16 flex items-center justify-center overflow-hidden">

                    {/* HIỂN THỊ GIAO DIỆN HỌP NHÓM (GOOGLE MEET / ZOOM STYLE GRID) */}
                    {isGroup ? (
                        <div className="w-full h-full grid gap-3 p-2 overflow-y-auto auto-rows-fr grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            {/* Ô camera cá nhân (Local User) */}
                            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg aspect-video">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover mirror"
                                />
                                {(isVideoOff || callType === 'audio') && (
                                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center space-y-2">
                                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                                            Tôi
                                        </div>
                                    </div>
                                )}
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-lg text-[11px] text-white font-medium border border-white/10">
                                    Bạn (Tôi)
                                </div>
                            </div>

                            {/* Ô hiển thị của từng thành viên đã tham gia cuộc gọi nhóm */}
                            {groupParticipants.map(participant => (
                                <GroupParticipantTile
                                    key={participant.userId}
                                    participant={participant}
                                    callType={callType}
                                />
                            ))}
                        </div>
                    ) : (
                        /* HIỂN THỊ GIAO DIỆN GỌI 1-1 */
                        <>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            <audio
                                ref={remoteAudioRef}
                                autoPlay
                                playsInline
                                className="hidden"
                            />

                            {(callStatus !== "connected" || callType === "audio") && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 space-y-4">
                                    <img
                                        src={targetUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        alt={targetUser?.displayName || "Người dùng"}
                                        className="w-28 h-28 rounded-full border-4 border-slate-700 object-cover animate-pulse"
                                    />
                                    <p className="text-slate-300 text-sm font-medium">
                                        {callStatus === "calling" ? "Đang chờ đối phương nhấc máy..." : "Đã kết nối cuộc gọi thoại"}
                                    </p>
                                </div>
                            )}

                            {callType === "video" && (
                                <div className="absolute bottom-20 right-3 sm:bottom-4 sm:right-4 w-24 h-36 sm:w-36 sm:h-48 bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-10">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover mirror"
                                    />
                                    {isVideoOff && (
                                        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
                                            Cam Off
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Thanh Điều Khiển Cuộc Gọi */}
                {!isMinimized && (
                    <div className="p-4 sm:p-6 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center space-x-4 sm:space-x-6 z-20">
                        <button
                            onClick={toggleMute}
                            className={`p-3.5 sm:p-4 rounded-full border transition cursor-pointer active:scale-95 ${isMuted ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-600 text-white"
                                }`}
                            title={isMuted ? "Bật Micro" : "Tắt Micro"}
                        >
                            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </button>

                        <button
                            onClick={handleEndCall}
                            className="p-3.5 sm:p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 shadow-lg cursor-pointer transition transform active:scale-95 hover:scale-105"
                            title="Kết thúc cuộc gọi"
                        >
                            <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>

                        {callType === "video" && (
                            <button
                                onClick={toggleVideo}
                                className={`p-3.5 sm:p-4 rounded-full border transition cursor-pointer active:scale-95 ${isVideoOff ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-600 text-white"
                                    }`}
                                title={isVideoOff ? "Bật Camera" : "Tắt Camera"}
                            >
                                {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallWindow;
