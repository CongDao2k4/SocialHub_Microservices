import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserPlus, Mail, Lock, User } from "lucide-react";

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const result = await register(email, password, displayName);
        setIsLoading(false);

        if (result.success) {
            navigate("/"); // Tạo tài khoản xong, tự động đăng nhập chuyển về Home
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
            {/* Vòng sáng phát quang mờ ảo phía sau hộp đăng ký */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[128px] pointer-events-none"></div>

            {/* Hộp đăng ký Glassmorphism */}
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-xl shadow-slate-200/50 z-10">
                <div className="text-center mb-6 sm:mb-8">
                    {/* Logo mạng xã hội */}
                    <img src="/logo.svg" alt="SocialHub Logo" className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 object-contain" />
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tạo tài khoản</h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-xs sm:text-sm">Gia nhập SocialHub để khám phá bạn bè mới.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 text-center animate-shake font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    {/* Tên hiển thị Input */}
                    <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-slate-700 text-xs sm:text-sm font-medium block">Tên hiển thị (Họ tên)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <User className="w-5 h-5" />
                            </span>
                            <input
                                type="text"
                                required
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Nguyễn Văn A"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Email Input */}
                    <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-slate-700 text-xs sm:text-sm font-medium block">Địa chỉ Email</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <Mail className="w-5 h-5" />
                            </span>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu Input */}
                    <div className="space-y-2">
                        <label className="text-slate-700 text-sm font-medium block">Mật khẩu (Tối thiểu 8 ký tự)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <Lock className="w-5 h-5" />
                            </span>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Nút đăng ký Solid Blue */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/10 transition duration-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm"
                    >
                        {isLoading ? "Đang tạo tài khoản..." : "Đăng Ký Tài Khoản"}
                    </button>
                </form>

                <div className="mt-8 text-center text-slate-500 text-sm">
                    Đã có tài khoản rồi?{" "}
                    <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium transition underline">
                        Đăng nhập ngay
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
