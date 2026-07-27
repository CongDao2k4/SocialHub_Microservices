import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ProtectedRoute, PublicRoute } from "./components/RouteGuard";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";

import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import PostDetail from "./pages/PostDetail";
import Reels from "./pages/Reels";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          {/* Nhóm Route Công khai: Chưa đăng nhập mới vào được (Được bảo vệ bởi PublicRoute) */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Nhóm Route được Bảo vệ: Đăng nhập mới xem được (Được bảo vệ bởi ProtectedRoute và bọc trong Layout) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Feed />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/post/:id" element={<PostDetail />} />
              <Route path="/reels" element={<Reels />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:id" element={<GroupDetail />} />
            </Route>
          </Route>

          {/* Tránh lỗi gõ linh tinh: Chuyển hướng các đường dẫn không hợp lệ về Trang chủ */}
          <Route path="*" element={<div className="text-white text-center mt-20">404 Not Found</div>} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
export default App;
