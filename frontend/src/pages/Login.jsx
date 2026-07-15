import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, Mail, Lock } from "lucide-react"; // Cần icon cho trực quan

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const result = await login(email, password);
        setIsLoading(false);

        if (result.success) {
            navigate("/"); // Đăng nhập xong, chuyển về Bảng tin
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
            {/* Vòng sáng phát quang mờ ảo phía sau hộp đăng nhập */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[128px] pointer-events-none"></div>

            {/* Hộp đăng nhập Glassmorphism */}
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/50 z-10">
                <div className="text-center mb-8">
                    {/* Logo mạng xã hội */}
                    <img src="/logo.svg" alt="SocialHub Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">SocialHub</h2>
                    <p className="text-slate-500 mt-2 text-sm">Chào mừng bạn quay lại! Đăng nhập để kết nối.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 text-center animate-shake font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Input */}
                    <div className="space-y-2">
                        <label className="text-slate-700 text-sm font-medium block">Địa chỉ Email</label>
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu Input */}
                    <div className="space-y-2">
                        <label className="text-slate-700 text-sm font-medium block">Mật khẩu</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <Lock className="w-5 h-5" />
                            </span>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Nút đăng nhập Solid Blue */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/10 transition duration-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm"
                    >
                        {isLoading ? "Đang xử lý..." : "Đăng Nhập"}
                    </button>
                </form>

                <div className="mt-8 text-center text-slate-500 text-sm">
                    Chưa có tài khoản?{" "}
                    <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium transition underline">
                        Đăng ký ngay
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
