import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = () => {
    const { isAuthenticated, loading } = useAuth();

    // 1. Hiển thị màn hình tải khi đang check token ở F5
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 mt-4 text-sm">Đang tải phiên làm việc...</p>
            </div>
        );
    }

    // 2. Nếu chưa đăng nhập, chuyển hướng về trang Login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // 3. Nếu đã đăng nhập, cho phép truy cập (Render các Route con)
    return <Outlet />;
};

export const PublicRoute = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return null;
    }

    // Nếu đã đăng nhập mà cố tình vào /login hoặc /register -> đá ngược về trang chủ /
    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};
