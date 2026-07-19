import { useEffect } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";

const IncomingCallModal = ({ incomingCall, onAccept, onReject }) => {
    if (!incomingCall) return null;

    const { callerName, callerAvatar, callType } = incomingCall;

    // Ringtone simulation using web audio API synthesized beep or silent fail
    useEffect(() => {
        let audioContext = null;
        let oscillator = null;
        let intervalId = null;

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = () => {
                if (!audioContext || audioContext.state === 'closed') return;
                oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
                gain.gain.setValueAtTime(0.1, audioContext.currentTime);
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.6);
            };

            playTone();
            intervalId = setInterval(playTone, 2000);
        } catch (e) {
            // AudioContext autoplay might be blocked, silent fail
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(() => {});
            }
        };
    }, []);

    const displayAvatar = isGroup ? (groupAvatar || callerAvatar) : callerAvatar;
    const displayName = isGroup ? (groupName || "Cuộc gọi nhóm") : callerName;
    const subtitleText = isGroup 
        ? `${callerName} đang gọi ${callType === 'video' ? 'Video' : 'thoại'} nhóm...` 
        : (callType === 'video' ? 'Cuộc gọi Video đến...' : 'Cuộc gọi thoại đến...');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fadeIn p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-sm flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden">
                {/* Background pulse effect */}
                <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />

                {/* Avatar with animated rings */}
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                    <img
                        src={displayAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt={displayName}
                        className="w-24 h-24 rounded-full object-cover border-4 border-slate-700 relative z-10 shadow-lg"
                    />
                    <div className="absolute bottom-0 right-0 z-20 bg-blue-600 p-2 rounded-full text-white border-2 border-slate-900 shadow">
                        {callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{displayName}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        {subtitleText}
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center space-x-8 pt-2">
                    <button
                        onClick={onReject}
                        className="flex flex-col items-center space-y-1 group cursor-pointer"
                        title="Từ chối"
                    >
                        <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-lg transition transform group-hover:scale-110">
                            <PhoneOff className="w-6 h-6" />
                        </div>
                        <span className="text-xs text-slate-400 group-hover:text-white transition">Từ chối</span>
                    </button>

                    <button
                        onClick={onAccept}
                        className="flex flex-col items-center space-y-1 group cursor-pointer"
                        title="Nghe máy"
                    >
                        <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg transition transform group-hover:scale-110 animate-bounce">
                            <Phone className="w-6 h-6" />
                        </div>
                        <span className="text-xs text-slate-400 group-hover:text-white transition">Chấp nhận</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;
