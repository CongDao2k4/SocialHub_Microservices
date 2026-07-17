import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from "lucide-react";

// Cấu hình ICE Servers cho WebRTC.
// TRÊN PRODUCTION: Để vượt qua tường lửa đối xứng (Symmetric NAT) của 3G/4G/5G hoặc wifi công ty,
// bạn bắt buộc phải cấu hình thêm ít nhất một TURN Server (ví dụ: Coturn, Twilio, Xirsys).
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Cấu hình mẫu TURN Server (bỏ comment và điền thông tin khi deploy thực tế):
        /*
        {
            urls: "turn:your-turn-server.com:3478",
            username: "your-username",
            credential: "your-password"
        }
        */
    ]
};

const CallWindow = ({ activeCall, chatSocket, currentUserId, onClose }) => {
    const { targetUser, callType, isCaller, offerSdp } = activeCall;

    const [callStatus, setCallStatus] = useState(isCaller ? "calling" : "connecting"); // 'calling' | 'connecting' | 'connected' | 'ended'
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [duration, setDuration] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const pendingCandidatesRef = useRef([]);
    const pendingOfferRef = useRef(null);
    const isMediaReadyRef = useRef(false);

    const targetTargetId = targetUser.id || targetUser.userId;

    // Tối ưu hóa băng thông & chất lượng mic với Opus Codec (128kbps High Fidelity, Inband FEC)
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

    // Helper xử lý SDP Offer (dùng chung cho cả khi đến sớm hoặc đến đúng lúc)
    const processOffer = async (pc, sdp) => {
        try {
            console.log("📥 [WEBRTC] Xử lý SDP Offer từ đối phương:", targetTargetId);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const rawAnswer = await pc.createAnswer();
            const answer = tuneOpusAudioSDP(rawAnswer);
            await pc.setLocalDescription(answer);

            chatSocket.emit("webrtc:answer", {
                targetUserId: targetTargetId,
                sdp: answer
            });

            while (pendingCandidatesRef.current.length > 0) {
                const candidate = pendingCandidatesRef.current.shift();
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (err) {
            console.error("❌ Lỗi xử lý SDP Offer:", err);
        }
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

    // Format mm:ss
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
                // 1. Khởi tạo RTCPeerConnection
                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerConnectionRef.current = pc;

                // 2. Lắng nghe luồng remote từ đối phương
                pc.ontrack = (event) => {
                    console.log("⚡ [WEBRTC] Nhận luồng remote media thành công:", event.streams[0]);
                    const remoteStream = event.streams[0];
                    if (remoteStream) {
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = remoteStream;
                            remoteVideoRef.current.muted = false;
                            remoteVideoRef.current.volume = 1.0;
                            remoteVideoRef.current.play().catch(() => {});
                        }
                        if (remoteAudioRef.current) {
                            remoteAudioRef.current.srcObject = remoteStream;
                            remoteAudioRef.current.muted = false;
                            remoteAudioRef.current.volume = 1.0;
                            remoteAudioRef.current.play().catch(() => {});
                        }
                    }
                    setCallStatus("connected");
                };

                // 3. Lắng nghe ICE Candidates sinh ra local -> gửi sang đối phương
                pc.onicecandidate = (event) => {
                    if (event.candidate && chatSocket && targetTargetId) {
                        chatSocket.emit("webrtc:ice-candidate", {
                            targetUserId: targetTargetId,
                            candidate: event.candidate
                        });
                    }
                };

                // 4. Theo dõi thay đổi trạng thái kết nối ICE
                pc.oniceconnectionstatechange = () => {
                    console.log("📡 WebRTC ICE Connection State:", pc.iceConnectionState);
                    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        setCallStatus("connected");
                    } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
                        console.warn("⚠️ Kết nối WebRTC gián đoạn");
                    }
                };

                // 5. Lấy luồng Media từ Camera/Micro (Chuẩn HD Audio Studio 48kHz)
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 48000,
                        channelCount: 1
                    },
                    video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (!isSubscribed) return;

                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Thêm các track local vào PeerConnection
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });

                // Đánh dấu media cục bộ đã chuẩn bị xong
                isMediaReadyRef.current = true;

                // NẾU LÀ NGƯỜI GỌI (Caller): Bắt đầu phát cuộc gọi sang Server
                if (isCaller) {
                    chatSocket.emit("call:initiate", {
                        targetUserId: targetTargetId,
                        callType
                    });
                } else if (offerSdp || pendingOfferRef.current) {
                    // Nếu là Callee và đã nhận Offer trước đó
                    const offerToProcess = offerSdp || pendingOfferRef.current;
                    pendingOfferRef.current = null;
                    await processOffer(pc, offerToProcess);
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
            cleanupWebRTC();
        };
    }, []);

    // Đăng ký các sự kiện WebRTC qua Socket
    useEffect(() => {
        if (!chatSocket || !targetTargetId) return;

        // 1. Khi người nhận chấp nhận cuộc gọi (Dành cho Caller)
        const handleCallAccepted = async () => {
            console.log("📞 [WEBRTC] Đối phương đã chấp nhận cuộc gọi. Đang tạo SDP Offer...");
            const pc = peerConnectionRef.current;
            if (!pc) return;

            try {
                const rawOffer = await pc.createOffer();
                const offer = tuneOpusAudioSDP(rawOffer);
                await pc.setLocalDescription(offer);

                chatSocket.emit("webrtc:offer", {
                    targetUserId: targetTargetId,
                    sdp: offer
                });
            } catch (err) {
                console.error("❌ Lỗi tạo SDP Offer:", err);
            }
        };

        // 2. Nhận SDP Offer (Dành cho Callee nếu chưa xử lý)
        const handleIncomingOffer = async ({ senderId, sdp }) => {
            if (senderId !== targetTargetId) return;
            console.log("📥 [WEBRTC] Nhận tin nhắn webrtc:offer từ đối phương:", senderId);
            const pc = peerConnectionRef.current;
            if (!pc || !isMediaReadyRef.current) {
                console.log("⏳ [WEBRTC] PeerConnection/Media chưa sẵn sàng, lưu SDP Offer vào bộ đệm pending");
                pendingOfferRef.current = sdp;
                return;
            }

            await processOffer(pc, sdp);
        };

        // 3. Nhận SDP Answer từ Callee (Dành cho Caller)
        const handleIncomingAnswer = async ({ senderId, sdp }) => {
            if (senderId !== targetTargetId) return;
            const pc = peerConnectionRef.current;
            if (!pc) return;

            try {
                console.log("📥 [WEBRTC] Nhận SDP Answer từ đối phương:", senderId);
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                console.log("✅ Đã hoàn tất bắt tay SDP Answer!");

                while (pendingCandidatesRef.current.length > 0) {
                    const candidate = pendingCandidatesRef.current.shift();
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (err) {
                console.error("❌ Lỗi đặt Remote Description:", err);
            }
        };

        // 4. Nhận ICE Candidate
        const handleIncomingIceCandidate = async ({ senderId, candidate }) => {
            if (senderId !== targetTargetId) return;
            const pc = peerConnectionRef.current;

            try {
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    pendingCandidatesRef.current.push(candidate);
                }
            } catch (err) {
                console.error("❌ Lỗi thêm ICE Candidate:", err);
            }
        };

        // 5. Khi cuộc gọi bị từ chối hoặc người dùng ngắt máy
        const handleCallRejected = ({ reason }) => {
            alert(reason === 'offline' ? 'Người dùng đang ngoại tuyến.' : 'Cuộc gọi bị từ chối.');
            cleanupWebRTC();
            onClose();
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

        return () => {
            chatSocket.off("call:accepted", handleCallAccepted);
            chatSocket.off("webrtc:offer", handleIncomingOffer);
            chatSocket.off("webrtc:answer", handleIncomingAnswer);
            chatSocket.off("webrtc:ice-candidate", handleIncomingIceCandidate);
            chatSocket.off("call:rejected", handleCallRejected);
            chatSocket.off("call:ended", handleCallEnded);
        };
    }, [chatSocket, targetTargetId]);

    // Dọn dẹp luồng Media & PeerConnection
    const cleanupWebRTC = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
    };

    // Bấm nút Kết thúc cuộc gọi
    const handleEndCall = () => {
        if (chatSocket && targetTargetId) {
            chatSocket.emit("call:end", { targetUserId: targetTargetId });
        }
        cleanupWebRTC();
        onClose();
    };

    // Toggle Mute Micro
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    // Toggle Turn Off Camera
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
            className={`fixed z-50 transition-all duration-300 ${
                isMinimized
                    ? "bottom-4 right-4 w-72 h-44 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900"
                    : "inset-0 bg-slate-950/95 flex items-center justify-center p-4"
            }`}
        >
            <div className={`relative w-full h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl ${isMinimized ? '' : 'max-w-4xl max-h-[85vh]'}`}>
                
                {/* Header thanh công cụ (Tên đối phương + Thời lượng) */}
                <div className="absolute top-0 inset-x-0 p-4 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center space-x-3">
                        <img
                            src={targetUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt={targetUser.displayName}
                            className="w-10 h-10 rounded-full border border-slate-600 object-cover"
                        />
                        <div>
                            <h4 className="text-white font-bold text-sm">{targetUser.displayName}</h4>
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

                {/* Vùng xem Remote Video & Audio (Main Viewport) */}
                <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
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

                    {/* Placeholder khi chưa thấy Video remote hoặc là Cuộc gọi thoại */}
                    {(callStatus !== "connected" || callType === "audio") && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 space-y-4">
                            <img
                                src={targetUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                alt={targetUser.displayName}
                                className="w-28 h-28 rounded-full border-4 border-slate-700 object-cover animate-pulse"
                            />
                            <p className="text-slate-300 text-sm font-medium">
                                {callStatus === "calling" ? "Đang chờ đối phương nhấc máy..." : "Đã kết nối cuộc gọi thoại"}
                            </p>
                        </div>
                    )}

                    {/* Vùng xem Local Video (Picture in Picture ở góc nhỏ) */}
                    {callType === "video" && (
                        <div className="absolute bottom-4 right-4 w-36 h-48 bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-10">
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
                </div>

                {/* Footer Thanh Điều Khiển Cuộc Gọi (Controls Bar) */}
                {!isMinimized && (
                    <div className="p-6 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center space-x-6 z-20">
                        {/* Micro Toggle */}
                        <button
                            onClick={toggleMute}
                            className={`p-4 rounded-full border transition cursor-pointer ${
                                isMuted ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-600 text-white"
                            }`}
                            title={isMuted ? "Bật Micro" : "Tắt Micro"}
                        >
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>

                        {/* End Call Button */}
                        <button
                            onClick={handleEndCall}
                            className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 shadow-lg cursor-pointer transition transform hover:scale-105"
                            title="Kết thúc cuộc gọi"
                        >
                            <PhoneOff className="w-7 h-7" />
                        </button>

                        {/* Camera Toggle (chỉ hiện nếu là Video Call) */}
                        {callType === "video" && (
                            <button
                                onClick={toggleVideo}
                                className={`p-4 rounded-full border transition cursor-pointer ${
                                    isVideoOff ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-600 text-white"
                                }`}
                                title={isVideoOff ? "Bật Camera" : "Tắt Camera"}
                            >
                                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallWindow;
