# 📘 SocialHub Frontend — Tài liệu kỹ thuật chi tiết

> Ứng dụng mạng xã hội SocialHub — Frontend Client  
> Tài liệu mô tả chi tiết **cơ chế hoạt động**, **luồng chạy**, **kiến trúc**, và **tương tác API** của toàn bộ mã nguồn frontend.

---

## 📑 Mục lục

1. [Tổng quan công nghệ](#1-tổng-quan-công-nghệ)
2. [Cấu trúc thư mục dự án](#2-cấu-trúc-thư-mục-dự-án)
3. [Điểm khởi đầu ứng dụng (Entry Point)](#3-điểm-khởi-đầu-ứng-dụng-entry-point)
4. [Hệ thống Routing & Bảo vệ Route](#4-hệ-thống-routing--bảo-vệ-route)
5. [Tầng API Service — Axios Instance](#5-tầng-api-service--axios-instance)
6. [Context toàn cục (Global State)](#6-context-toàn-cục-global-state)
   - 6.1 [AuthContext — Quản lý Xác thực](#61-authcontext--quản-lý-xác-thực)
   - 6.2 [SocketContext — Quản lý WebSocket Realtime](#62-socketcontext--quản-lý-websocket-realtime)
7. [Layout chính & Sidebar](#7-layout-chính--sidebar)
8. [Chi tiết từng Trang (Pages)](#8-chi-tiết-từng-trang-pages)
   - 8.1 [Trang Đăng nhập (Login)](#81-trang-đăng-nhập-login)
   - 8.2 [Trang Đăng ký (Register)](#82-trang-đăng-ký-register)
   - 8.3 [Trang Bảng tin (Feed)](#83-trang-bảng-tin-feed)
   - 8.4 [Trang Chi tiết bài viết (PostDetail)](#84-trang-chi-tiết-bài-viết-postdetail)
   - 8.5 [Trang Bạn bè (Friends)](#85-trang-bạn-bè-friends)
   - 8.6 [Trang Thông báo (Notifications)](#86-trang-thông-báo-notifications)
   - 8.7 [Trang Tin nhắn (Messages)](#87-trang-tin-nhắn-messages)
   - 8.8 [Trang Cá nhân (Profile)](#88-trang-cá-nhân-profile)
9. [Chi tiết từng Component](#9-chi-tiết-từng-component)
   - 9.1 [CreatePost — Đăng bài viết mới](#91-createpost--đăng-bài-viết-mới)
   - 9.2 [PostCard — Hiển thị bài viết](#92-postcard--hiển-thị-bài-viết)
   - 9.3 [ShareModal — Chia sẻ bài viết](#93-sharemodal--chia-sẻ-bài-viết)
   - 9.4 [EditPostModal — Chỉnh sửa bài viết](#94-editpostmodal--chỉnh-sửa-bài-viết)
   - 9.5 [ChatWidget — Sidebar Chat & Ô Chat Nổi](#95-chatwidget--sidebar-chat--ô-chat-nổi)
   - 9.6 [ChatBox — Ô Chat Chi Tiết](#96-chatbox--ô-chat-chi-tiết)
10. [Tổng hợp toàn bộ API Endpoints](#10-tổng-hợp-toàn-bộ-api-endpoints)
11. [Cơ chế WebSocket Realtime](#11-cơ-chế-websocket-realtime)
12. [Cơ chế đồng bộ giữa các Component (Custom Events)](#12-cơ-chế-đồng-bộ-giữa-các-component-custom-events)
13. [Sơ đồ kiến trúc tổng thể](#13-sơ-đồ-kiến-trúc-tổng-thể)

---

## 1. Tổng quan công nghệ

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| **React** | 19.x | Thư viện UI chính |
| **Vite** | 8.x | Build tool & dev server |
| **React Router DOM** | 7.x | Hệ thống điều hướng (SPA routing) |
| **Axios** | 1.x | HTTP Client gọi REST API tới API Gateway |
| **Socket.IO Client** | 4.x | Kết nối WebSocket realtime (Notification & Chat) |
| **TailwindCSS** | 4.x | Framework CSS utility-first |
| **Lucide React** | 1.x | Bộ icon SVG |

---

## 2. Cấu trúc thư mục dự án

```
frontend/
├── public/                     # Tài nguyên tĩnh
├── src/
│   ├── main.jsx                # Điểm khởi đầu, mount React vào DOM
│   ├── App.jsx                 # Component gốc, cấu hình Routes & Providers
│   ├── index.css               # CSS gốc (import TailwindCSS)
│   │
│   ├── services/
│   │   └── api.js              # Axios instance + Request/Response Interceptors
│   │
│   ├── context/
│   │   ├── AuthContext.jsx     # Context quản lý phiên đăng nhập (Auth State)
│   │   └── SocketContext.jsx   # Context quản lý WebSocket (Notification + Chat)
│   │
│   ├── components/
│   │   ├── Layout.jsx          # Bố cục tổng thể (Sidebar + Outlet + ChatWidget)
│   │   ├── RouteGuard.jsx      # HOC bảo vệ route (ProtectedRoute + PublicRoute)
│   │   ├── CreatePost.jsx      # Form đăng bài viết mới (có multi-media upload)
│   │   ├── PostCard.jsx        # Card hiển thị 1 bài viết (Like, Comment, Share, Edit, Delete)
│   │   ├── ShareModal.jsx      # Modal chia sẻ bài viết
│   │   ├── EditPostModal.jsx   # Modal chỉnh sửa bài viết
│   │   ├── ChatWidget.jsx      # Sidebar chat bên phải + quản lý các ô chat nổi
│   │   └── ChatBox.jsx         # Ô chat nổi nhỏ ở góc dưới phải màn hình
│   │
│   └── pages/
│       ├── Login.jsx           # Trang đăng nhập
│       ├── Register.jsx        # Trang đăng ký
│       ├── Feed.jsx            # Trang bảng tin (Newsfeed)
│       ├── PostDetail.jsx      # Trang chi tiết 1 bài viết
│       ├── Friends.jsx         # Trang quản lý bạn bè
│       ├── Notifications.jsx   # Trang danh sách thông báo
│       ├── Messages.jsx        # Trang tin nhắn đầy đủ
│       └── Profile.jsx         # Trang cá nhân của người dùng
│
├── package.json
├── vite.config.js
├── Dockerfile
└── vercel.json
```

---

## 3. Điểm khởi đầu ứng dụng (Entry Point)

**File:** `src/main.jsx`

```
main.jsx
  └── <StrictMode>
        └── <BrowserRouter>          ← Cung cấp khả năng routing cho toàn bộ ứng dụng
              └── <App />            ← Component gốc chứa Providers + Routes
```

**Luồng chạy khi mở ứng dụng:**

1. `createRoot` mount React vào element `#root` trong `index.html`.
2. `<BrowserRouter>` bọc toàn bộ ứng dụng để kích hoạt hệ thống routing SPA.
3. `<App />` được render — là nơi chứa tất cả Provider + Routes.

---

## 4. Hệ thống Routing & Bảo vệ Route

**File:** `src/App.jsx` & `src/components/RouteGuard.jsx`

### Cây Route tổng thể

```
<AuthProvider>                          ← Context xác thực bọc toàn ứng dụng
  <SocketProvider>                      ← Context WebSocket bọc toàn ứng dụng
    <Routes>
      ├── <PublicRoute>                 ← CHỈ cho user CHƯA đăng nhập
      │     ├── /login  → <Login />
      │     └── /register → <Register />
      │
      ├── <ProtectedRoute>              ← CHỈ cho user ĐÃ đăng nhập
      │     └── <Layout>                ← Bố cục chính (Sidebar + Content + ChatWidget)
      │           ├── /           → <Feed />
      │           ├── /friends    → <Friends />
      │           ├── /notifications → <Notifications />
      │           ├── /messages   → <Messages />
      │           ├── /profile/:id → <Profile />
      │           └── /post/:id   → <PostDetail />
      │
      └── /*  → 404 Not Found
    </Routes>
  </SocketProvider>
</AuthProvider>
```

### Cơ chế RouteGuard

| Guard | Hành vi |
|---|---|
| **`ProtectedRoute`** | Nếu `loading=true` → hiển thị spinner chờ. Nếu `isAuthenticated=false` → redirect về `/login`. Nếu đã xác thực → render `<Outlet />` (các route con). |
| **`PublicRoute`** | Nếu `loading=true` → `null` (không render gì). Nếu `isAuthenticated=true` → redirect về `/` (trang chủ). Nếu chưa xác thực → render `<Outlet />`. |

**Mục đích:** Ngăn user đã đăng nhập quay lại trang Login/Register, đồng thời ngăn user chưa đăng nhập truy cập các trang nội bộ.

---

## 5. Tầng API Service — Axios Instance

**File:** `src/services/api.js`

### Cấu hình Axios Instance

```javascript
const api = axios.create({
    baseURL: VITE_API_URL || "http://localhost:8080" + "/api",
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "any-value"   // Bỏ qua cảnh báo khi dùng ngrok tunnel
    }
});
```

### Request Interceptor (Tự động đính kèm Access Token & Cấu hình Upload)

```
Mọi request HTTP gửi đi
  ├── Kiểm tra localStorage có "accessToken"?
  │     ├── CÓ → Đính kèm header: Authorization: Bearer <token>
  │     └── KHÔNG → Gửi request bình thường (không có token)
  ├── Kiểm tra loại dữ liệu gửi đi (config.data):
  │     └── Nếu là FormData hoặc url chứa /media/upload:
  │           ├── Xóa header Content-Type để trình duyệt tự thiết lập boundary
  │           └── Thiết lập timeout = 0 (vô hiệu hóa timeout) để hỗ trợ upload video lớn và transcode ngầm
  └── Gửi request tới API Gateway
```

### Response Interceptor (Tự động Refresh Token khi bị 401)

```
API Gateway trả về response
  ├── 2xx (Thành công) → Trả về response bình thường
  └── 401 (Unauthorized)
        ├── Là request auth (/login, /register, /refresh)? → KHÔNG retry, reject luôn
        ├── Đã retry rồi? (_retry flag) → KHÔNG retry, reject luôn
        └── Chưa retry
              ├── Lấy refreshToken từ localStorage
              ├── Gọi POST /api/auth/refresh { refreshToken }
              │     ├── THÀNH CÔNG
              │     │     ├── Lưu accessToken mới + refreshToken mới vào localStorage
              │     │     └── Gửi lại request ban đầu (originalRequest) với token mới
              │     └── THẤT BẠI
              │           ├── Xóa accessToken + refreshToken khỏi localStorage
              │           └── Redirect trình duyệt về /login (buộc đăng nhập lại)
```

**Mục đích:** Người dùng không bị gián đoạn khi token hết hạn — hệ thống tự động làm mới token phía sau.

---

## 6. Context toàn cục (Global State)

### 6.1 AuthContext — Quản lý Xác thực

**File:** `src/context/AuthContext.jsx`

#### State được chia sẻ

| State | Kiểu | Mô tả |
|---|---|---|
| `user` | `Object \| null` | Thông tin user đang đăng nhập (`id`, `displayName`, `email`, `avatarUrl`, ...) |
| `isAuthenticated` | `boolean` | Trạng thái xác thực |
| `loading` | `boolean` | Đang kiểm tra phiên đăng nhập (tránh nhấp nháy UI) |

#### Các hàm được cung cấp

| Hàm | Tham số | Mô tả |
|---|---|---|
| `login(email, password)` | email, password | Đăng nhập → lưu token → set user |
| `register(email, password, displayName)` | email, password, name | Đăng ký → tự động đăng nhập → lưu token |
| `logout()` | — | Gọi API logout → xóa token → reset state |

#### Luồng kiểm tra phiên khi tải trang (F5/Reload)

```
useEffect (mount) — checkAuth()
  ├── localStorage có "accessToken"?
  │     ├── KHÔNG → setLoading(false) → hiển thị trang Login
  │     └── CÓ
  │           ├── Giải mã JWT payload (atob) → lấy user ID
  │           ├── Gọi GET /api/users/{userId} để lấy thông tin đầy đủ
  │           │     ├── THÀNH CÔNG → setUser(data) + setIsAuthenticated(true)
  │           │     └── THẤT BẠI → logout() (xóa token, redirect)
  │           └── setLoading(false)
```

#### Luồng đăng nhập

```
Người dùng nhập Email + Password → submit form
  ├── POST /api/auth/login { email, password }
  │     ├── THÀNH CÔNG
  │     │     ├── Lưu accessToken + refreshToken vào localStorage
  │     │     ├── setUser(res.data.user)
  │     │     ├── setIsAuthenticated(true)
  │     │     └── navigate("/") → vào trang Bảng tin
  │     └── THẤT BẠI → Hiển thị thông báo lỗi
```

#### Luồng đăng ký

```
Người dùng nhập Họ tên + Email + Password → submit form
  ├── POST /api/auth/register { email, password, name }
  │     ├── THÀNH CÔNG
  │     │     ├── Lưu accessToken + refreshToken vào localStorage
  │     │     ├── setUser(res.data.user)
  │     │     ├── setIsAuthenticated(true)
  │     │     └── navigate("/") → tự động chuyển tới trang Bảng tin
  │     └── THẤT BẠI → Hiển thị thông báo lỗi
```

#### Luồng đăng xuất

```
Người dùng nhấn nút "Đăng xuất" trên Sidebar
  ├── POST /api/auth/logout (thông báo server vô hiệu hóa phiên)
  ├── Xóa accessToken + refreshToken khỏi localStorage
  ├── setUser(null) + setIsAuthenticated(false)
  └── navigate("/login")
```

---

### 6.2 SocketContext — Quản lý WebSocket Realtime

**File:** `src/context/SocketContext.jsx`

#### State được chia sẻ

| State | Kiểu | Mô tả |
|---|---|---|
| `notificationSocket` | `Socket \| null` | Socket.IO instance cho kênh Notification |
| `chatSocket` | `Socket \| null` | Socket.IO instance cho kênh Chat |
| `unreadCount` | `number` | Số lượng thông báo chưa đọc (hiển thị badge trên Sidebar) |
| `toast` | `Object \| null` | Dữ liệu toast notification popup đang hiện |
| `onlineUsers` | `Object` | Map `{ userId: true }` theo dõi trạng thái online |

#### Luồng khởi tạo WebSocket

```
useEffect — Khi isAuthenticated thay đổi
  ├── isAuthenticated = false (Logout)
  │     ├── Ngắt kết nối notificationSocket + chatSocket
  │     └── Reset: unreadCount=0, toast=null, onlineUsers={}
  │
  └── isAuthenticated = true (Login thành công)
        ├── Gọi REST API: GET /api/notifications/unread-count
        │     └── setUnreadCount(count)
        │
        ├── Khởi tạo NOTIFICATION SOCKET
        │     ├── URL: socketBaseURL (bỏ /api ở cuối baseURL)
        │     ├── auth: { token: accessToken }
        │     ├── path: "/notification/socket.io/"
        │     ├── transports: ["websocket"]
        │     │
        │     ├── Sự kiện "connect" → Log thành công
        │     ├── Sự kiện "notification:count" → setUnreadCount(data.unreadCount)
        │     └── Sự kiện "notification:new" (Thông báo mới)
        │           ├── Tăng unreadCount + 1
        │           ├── Dispatch CustomEvent "notification-received" (để trang Notifications cập nhật)
        │           ├── Hiển thị toast popup (tự ẩn sau 4 giây)
        │           └── Toast chứa: message, avatar, type, referenceId, referenceType
        │
        └── Khởi tạo CHAT SOCKET
              ├── URL: socketBaseURL
              ├── auth: { token: accessToken }
              ├── path: "/chat/socket.io/"
              ├── transports: ["websocket"]
              │
              ├── Sự kiện "connect" → Log thành công
              ├── Sự kiện "user:online" → Thêm userId vào onlineUsers
              └── Sự kiện "user:offline" → Xóa userId khỏi onlineUsers
```

#### Cleanup khi unmount hoặc logout

```
return () => {
    notifSock.disconnect();
    chSock.disconnect();
};
```

---

## 7. Layout chính & Sidebar

**File:** `src/components/Layout.jsx`

### Cấu trúc Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Toast Notification (góc trên phải, z-50)   │
├──────────┬──────────────────────────────────────┬───────────────────┤
│          │                                      │                   │
│  SIDEBAR │          MAIN CONTENT                │  CHAT WIDGET      │
│  (trái)  │          <Outlet />                  │  (phải)           │
│  w-64    │          (flex-1)                    │  w-64             │
│  fixed   │          ml-64, mr-64               │  fixed             │
│          │                                      │                   │
│ ┌──────┐ │                                      │ ┌───────────────┐ │
│ │Logo  │ │                                      │ │ Danh sách     │ │
│ │      │ │                                      │ │ bạn bè        │ │
│ ├──────┤ │                                      │ │ + trạng thái  │ │
│ │Bảng  │ │                                      │ │   online      │ │
│ │tin   │ │                                      │ │               │ │
│ │Bạn bè│ │                                      │ │ Click tên     │ │
│ │Tin   │ │                                      │ │ → mở ChatBox  │ │
│ │nhắn  │ │                                      │ │               │ │
│ │Thông │ │                                      │ │ Click avatar  │ │
│ │báo(n)│ │                                      │ │ → trang cá    │ │
│ ├──────┤ │                                      │ │   nhân        │ │
│ │Avatar│ │                                      │ │               │ │
│ │Tên   │ │                                      │ │ [+] Tạo nhóm  │ │
│ │Email │ │                                      │ │     chat      │ │
│ │Logout│ │                                      │ └───────────────┘ │
│ └──────┘ │                                      │                   │
└──────────┴──────────────────────────────────────┴───────────────────┘
                                                         │
                                               Các ô ChatBox nổi
                                               (tối đa 3 ô, fixed bottom-right)
```

### Toast Notification

Khi có thông báo realtime từ `SocketContext`:
- Hiển thị popup trên góc trên phải (avatar + message).
- Tự ẩn sau 4 giây.
- Click vào toast → điều hướng theo loại thông báo:

| Loại thông báo | Điều hướng |
|---|---|
| `post_liked`, `post_commented`, `post_shared` | `/post/{referenceId}` |
| `friend_request` | `/friends` |
| `friend_accepted` | `/profile/{fromUserId}` |
| `new_message` | `/messages` |
| Loại khác | `/notifications` |

### Sidebar Navigation (trái)

- **Logo SocialHub** (gradient violet → pink)
- **Bảng tin** (`/`)
- **Bạn bè** (`/friends`)
- **Tin nhắn** (`/messages`)
- **Thông báo** (`/notifications`) — có badge hiển thị `unreadCount`
- **Thông tin user** — avatar, displayName, email, nút Đăng xuất

### Trang Messages

Khi `location.pathname === "/messages"`:
- Layout thay đổi padding từ `p-8` → `p-4`
- Content wrapper thay đổi từ `max-w-4xl mx-auto` → `w-full h-full`
- Mục đích: trang Messages hiển thị toàn chiều rộng.

---

## 8. Chi tiết từng Trang (Pages)

### 8.1 Trang Đăng nhập (Login)

**File:** `src/pages/Login.jsx`

**Giao diện:** Form glassmorphism với 2 trường Email + Password, nút gradient "Đăng Nhập", link "Đăng ký ngay".

**Luồng:**
```
1. Người dùng nhập email + password
2. Submit form → gọi login(email, password) từ AuthContext
3. Nếu thành công → navigate("/")
4. Nếu thất bại → hiển thị error message
```

**API:** `POST /api/auth/login`

---

### 8.2 Trang Đăng ký (Register)

**File:** `src/pages/Register.jsx`

**Giao diện:** Form glassmorphism với 3 trường: Tên hiển thị, Email, Mật khẩu (min 8 ký tự).

**Luồng:**
```
1. Người dùng nhập displayName + email + password
2. Submit form → gọi register(email, password, displayName) từ AuthContext
3. Nếu thành công → tự động đăng nhập + navigate("/")
4. Nếu thất bại → hiển thị error message
```

**API:** `POST /api/auth/register`

---

### 8.3 Trang Bảng tin (Feed)

**File:** `src/pages/Feed.jsx`

**Giao diện:** Tiêu đề "Bảng Tin" → Form đăng bài (`CreatePost`) → Danh sách bài viết (`PostCard`).

**Luồng chạy:**
```
useEffect (mount)
  └── fetchFeed()
        └── GET /api/feed
              └── setPosts(res.data.data)

Đăng bài mới → handlePostCreated(newPost)
  └── Gắn author info từ user hiện tại
  └── Chèn bài mới lên ĐẦU danh sách

Chia sẻ bài → handlePostShared(newPost)
  └── Chèn bài chia sẻ lên ĐẦU danh sách

Xóa bài → handlePostDeleted(id)
  └── Loại bỏ bài khỏi danh sách (filter)

Cập nhật bài → handlePostUpdated(updatedPost)
  └── Thay thế bài cũ bằng bài mới trong danh sách (map)
```

**API:**
- `GET /api/feed` — Lấy bảng tin (bài của mình + bạn bè)

---

### 8.4 Trang Chi tiết bài viết (PostDetail)

**File:** `src/pages/PostDetail.jsx`

**Giao diện:** Nút "Quay lại" + PostCard đơn lẻ.

**Luồng:**
```
useEffect — Khi ID thay đổi
  └── GET /api/posts/{id}
        ├── THÀNH CÔNG → setPost(data) → render PostCard
        └── THẤT BẠI → Hiển thị "Không tìm thấy bài viết"

Xóa bài (từ PostCard) → navigate("/")
Cập nhật bài → setPost(updatedPost)
```

**API:**
- `GET /api/posts/{id}` — Lấy chi tiết 1 bài viết

---

### 8.5 Trang Bạn bè (Friends)

**File:** `src/pages/Friends.jsx`

**Giao diện:** Header + Ô tìm kiếm + Hệ thống 3 tabs + Kết quả tìm kiếm.

#### Hệ thống Tabs

| Tab | Nội dung | API khi mount |
|---|---|---|
| **Lời mời** (mặc định) | Danh sách lời mời kết bạn đã nhận | `GET /api/friends/requests?type=received` |
| **Danh sách bạn bè** | Grid bạn bè hiện tại | `GET /api/friends` |
| **Gợi ý bạn bè** | Gợi ý dựa trên bạn chung | `GET /api/friends/suggestions?limit=10` |

> **Lưu ý:** Cả 3 API đều được gọi ngay khi mount component (để hiển thị badge đếm chính xác trên các tab).

#### Luồng Tìm kiếm

```
Người dùng nhập tên/email → submit form
  ├── GET /api/users/search?q={query}
  │     └── Lọc bỏ chính mình → setSearchResults(users)
  │
  └── Cho MỖI user tìm thấy (chạy song song Promise.all):
        └── GET /api/friends/check/{userId}
              └── Trả về { status, requestId }
                    └── status: "friends" | "pending_sent" | "pending_received" | "none"
```

#### Các hành động kết bạn

| Hành động | API | Cập nhật UI |
|---|---|---|
| **Gửi lời mời** | `POST /api/friends/request { toUserId }` | Status → "pending_sent", xóa khỏi gợi ý |
| **Chấp nhận** | `PUT /api/friends/requests/{id}/accept` | Xóa khỏi requests, thêm vào friends, dispatch `friends-updated` |
| **Từ chối** | `PUT /api/friends/requests/{id}/reject` | Xóa khỏi requests, dispatch `friends-updated` |
| **Hủy kết bạn** | `DELETE /api/friends/{friendId}` | Xóa khỏi friends, status → "none", dispatch `friends-updated` |

> **`friends-updated`** là Custom Event dùng để đồng bộ danh sách bạn bè trên ChatWidget (sidebar phải).

---

### 8.6 Trang Thông báo (Notifications)

**File:** `src/pages/Notifications.jsx`

**Giao diện:** Header với nút "Đánh dấu đọc tất cả" → Danh sách thông báo (có phân biệt đọc/chưa đọc).

**Luồng tải thông báo:**
```
useEffect (mount)
  └── GET /api/notifications
        └── setNotifications(res.data.data)
```

**Luồng nhận thông báo realtime:**
```
useEffect — Lắng nghe window event "notification-received"
  └── Khi nhận CustomEvent từ SocketContext
        └── Chèn thông báo mới lên ĐẦU danh sách (tránh trùng ID)
```

**Luồng click vào thông báo:**
```
handleMarkAsRead(notification)
  ├── Đã đọc rồi? → Chuyển hướng luôn
  └── Chưa đọc?
        ├── PUT /api/notifications/{id}/read
        ├── Cập nhật isRead=true trong state cục bộ
        ├── Giảm unreadCount trên Sidebar
        └── Chuyển hướng theo loại thông báo (cùng bảng với Toast)
```

**Đánh dấu đọc tất cả:**
```
PUT /api/notifications/read-all
  ├── Tất cả thông báo → isRead: true
  └── setUnreadCount(0)
```

**Icon theo loại thông báo:**

| Loại | Icon | Màu |
|---|---|---|
| `post_liked` | ❤️ Heart (filled) | Rose |
| `post_commented` | 💬 MessageSquare | Violet |
| `post_shared` | 🔁 Share2 | Sky |
| `friend_request` | 👤+ UserPlus | Amber |
| `friend_accepted` | 👤✓ UserCheck | Emerald |
| Mặc định | 🔔 Bell | Slate |

---

### 8.7 Trang Tin nhắn (Messages)

**File:** `src/pages/Messages.jsx`

**Giao diện:** Layout 2 cột — Cột trái: danh sách hội thoại (w-80) | Cột phải: nội dung chat.

#### Cột trái — Danh sách hội thoại

```
useEffect (mount)
  └── GET /api/conversations
        └── setConversations(data)

Mỗi item hiển thị:
  ├── Avatar (có chấm online nếu là 1-1)
  ├── Tên (tên nhóm hoặc tên đối phương)
  ├── Tin nhắn cuối cùng (preview)
  └── Badge unreadCount (nếu > 0)

Click vào 1 hội thoại → setSelectedConv(conv)
```

#### Cột phải — Nội dung chat

```
useEffect — Khi selectedConv thay đổi
  └── GET /api/conversations/{id}/messages
        └── setMessages(data)
```

#### Gửi tin nhắn (REST API)

```
handleSendMessage()
  ├── Có file đính kèm?
  │     └── Upload song song tất cả file
  │           └── POST /api/media/upload (FormData) → lấy mediaId
  │
  ├── Có mediaIds?
  │     └── Gửi từng media riêng lẻ:
  │           POST /api/conversations/{id}/messages { content, type:"image", mediaId }
  │           (tin cuối cùng kèm text nếu có)
  │
  └── Chỉ có text?
        └── POST /api/conversations/{id}/messages { content, type:"text" }

Sau khi gửi:
  ├── Refetch messages (GET /api/conversations/{id}/messages)
  └── Refetch conversations (cập nhật lastMessage)
```

#### Nhận tin nhắn realtime

```
chatSocket.on("message:new", (msg) => {
    if (msg.conversationId === currentConv.id) {
        setMessages(prev => [...prev, msg]);   // Chèn tin nhắn mới
    }
    fetchConversations();   // Cập nhật lastMessage + unread
});
```

#### Tạo nhóm chat

```
handleCreateGroup()
  ├── Mở modal → GET /api/friends (lấy danh sách bạn bè để chọn)
  ├── Nhập tên nhóm + chọn ít nhất 1 thành viên
  └── POST /api/groups { name, memberIds }
        └── Thành công → refetch conversations
```

#### Component ChatMedia (lồng trong Messages)

Component con để hiển thị ảnh/video đính kèm trong tin nhắn:
```
ChatMedia({ mediaId })
  └── GET /api/media/file/{mediaId} (responseType: "blob")
        ├── Là video? → <video> với controls
        └── Là ảnh? → <img> (click mở tab mới)
```

**API sử dụng:**
- `GET /api/conversations` — Danh sách hội thoại
- `GET /api/conversations/{id}/messages` — Lịch sử tin nhắn
- `POST /api/conversations/{id}/messages` — Gửi tin nhắn
- `POST /api/media/upload` — Upload media
- `GET /api/media/file/{mediaId}` — Tải file media (blob)
- `GET /api/friends` — Lấy bạn bè để tạo nhóm
- `POST /api/groups` — Tạo nhóm chat

---

### 8.8 Trang Cá nhân (Profile)

**File:** `src/pages/Profile.jsx`

**Giao diện:** Card thông tin cá nhân (avatar, tên, email, ngày tham gia) + Nút hành động kết bạn/chat + Danh sách bài đăng.

**Luồng tải dữ liệu:**
```
useEffect — Khi ID hoặc loggedInUser thay đổi
  ├── GET /api/users/{id} → setProfileUser(data.user)
  ├── GET /api/posts/user/{id} → setUserPosts(data.data)
  └── Nếu KHÔNG phải trang cá nhân của mình:
        └── GET /api/friends/check/{id} → setRelation({ status, requestId })
```

#### Các nút hành động (chỉ hiện khi xem trang người khác)

| Trạng thái (`relation.status`) | Nút hiển thị | Hành động |
|---|---|---|
| `none` | "Thêm bạn bè" | `POST /api/friends/request` |
| `pending_sent` | "Đã gửi yêu cầu" (disabled) | — |
| `pending_received` | "Đồng ý" + "Từ chối" | `PUT /api/friends/requests/{id}/accept` hoặc `reject` |
| `friends` | "Hủy kết bạn" | `DELETE /api/friends/{id}` |

#### Nút "Nhắn tin"

```
handleStartChat()
  └── Dispatch CustomEvent "open-chat" { id, displayName, avatarUrl }
        └── ChatWidget lắng nghe → tạo/mở conversation → hiển thị ChatBox nổi
```

**API:**
- `GET /api/users/{id}` — Thông tin user
- `GET /api/posts/user/{id}` — Bài đăng của user
- `GET /api/friends/check/{id}` — Kiểm tra quan hệ bạn bè
- `POST /api/friends/request` — Gửi lời mời kết bạn
- `PUT /api/friends/requests/{id}/accept` — Chấp nhận
- `PUT /api/friends/requests/{id}/reject` — Từ chối
- `DELETE /api/friends/{id}` — Hủy kết bạn

---

## 9. Chi tiết từng Component

### 9.1 CreatePost — Đăng bài viết mới

**File:** `src/components/CreatePost.jsx`

**Props:** `onPostCreated(newPost)` — callback khi đăng bài thành công.

**Tính năng:**
- Nhập nội dung văn bản (textarea)
- Chọn nhiều file ảnh/video cùng lúc (multi-file upload)
- Xem trước (preview) các file đã chọn dạng grid
- Xóa từng file khỏi danh sách xem trước

**Luồng đăng bài:**
```
handleSubmit()
  ├── Bước A: Upload song song tất cả file
  │     └── Promise.all: POST /api/media/upload (FormData) cho mỗi file
  │           └── Trả về mảng mediaIds
  │
  └── Bước B: Tạo bài viết
        └── POST /api/posts { content, mediaIds, visibility:"friends" }
              └── Thành công → gọi onPostCreated(newPost)
```

---

### 9.2 PostCard — Hiển thị bài viết

**File:** `src/components/PostCard.jsx` — **Component lớn nhất và phức tạp nhất** (~654 dòng).

**Props:**

| Prop | Mô tả |
|---|---|
| `post` | Dữ liệu bài viết |
| `currentUserId` | ID user đang đăng nhập |
| `onPostShared` | Callback khi chia sẻ thành công |
| `onPostDeleted` | Callback khi xóa bài thành công |
| `onPostUpdated` | Callback khi chỉnh sửa bài thành công |

#### Cấu trúc hiển thị

```
┌─────────────────────────────────────────┐
│ [Avatar] Tên tác giả     [Sửa] [Xóa]  │ ← Header (link tới profile)
│                                         │
│ Nội dung bài viết (text)                │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Ảnh/Video Grid (1 hoặc 2 cột)      │ │ ← Multi-media
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ Bài được chia sẻ (nested card) ────┐ │
│ │ [Avatar] Tên tác giả gốc           │ │ ← Nếu is_shared=true
│ │ Nội dung bài gốc                   │ │
│ │ Ảnh bài gốc                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ❤️ n Thích  💬 n Bình luận  🔁 n Chia sẻ│ ← Footer tương tác
│                                         │
│ ┌─ Bảng bình luận (accordion) ────────┐ │
│ │ [Reply banner nếu đang phản hồi]   │ │
│ │ [Input bình luận] [Gửi]            │ │
│ │                                     │ │
│ │ ● Bình luận gốc (parent)           │ │
│ │   ├─ [Phản hồi]                    │ │
│ │   ├── ↳ Reply 1 (@mention)         │ │
│ │   └── ↳ Reply 2 (@mention)         │ │
│ │ ● Bình luận gốc khác              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Tải Media đính kèm bài viết

```
useEffect — Khi post.media_ids thay đổi
  └── Nếu có media_ids[]
        └── Promise.all: GET /api/media/file/{mediaId} (responseType:"blob")
              └── URL.createObjectURL(blob) → { id, url, isVideo }
              └── setMediaItems(results)
  
  Cleanup: URL.revokeObjectURL() cho tất cả blob URLs
```

#### Tải bài gốc (bài chia sẻ lồng nhau)

```
useEffect — Khi is_shared + original_post_id thay đổi
  └── Nếu is_shared=true
        ├── GET /api/posts/{original_post_id} → setOriginalPost(data)
        └── Nếu bài gốc có media:
              └── GET /api/media/{mediaId}/url → setOriginalImageUrl(url)
```

#### Tương tác Like

```
handleLike()
  └── POST /api/posts/{id}/like (toggle)
        ├── Đảo trạng thái isLiked
        └── Tăng/giảm likeCount
```

#### Hệ thống Bình luận (Threaded Comments)

**Tải bình luận:**
```
showComments = true
  └── GET /api/posts/{id}/comments
        └── setComments(data)
```

**Cấu trúc thread bình luận:**

PostCard sử dụng hệ thống **phân giải nội dung bình luận** (parseComment) để phân biệt bình luận gốc và phản hồi:

| Định dạng nội dung | Ý nghĩa |
|---|---|
| `[reply:parentId:@Tên] nội dung` | Phản hồi có parentId + tag tên |
| `[reply:parentId] nội dung` | Phản hồi chỉ có parentId |
| `[reply] nội dung` | Phản hồi (định dạng cũ, không có parentId) |
| `[reply:@Tên] nội dung` | Phản hồi (định dạng cũ, có tag tên) |
| `@Tên: nội dung` | Phản hồi (tương thích ngược) |
| Không có prefix đặc biệt | Bình luận gốc (parent) |

`getStructuredComments()` phân nhóm bình luận thành:
- **parents[]** — mảng bình luận gốc
- **repliesByParent{}** — map `parentId → [replies]`

**Gửi bình luận:**
```
handleAddComment()
  ├── Nếu đang phản hồi (replyingTo !== null):
  │     ├── Phản hồi người khác → "[reply:{parentId}:@{tên}] {nội dung}"
  │     └── Phản hồi chính mình → "[reply:{parentId}] {nội dung}"
  └── POST /api/posts/{id}/comments { content: finalContent }
        └── Thêm comment mới vào cuối + commentCount++
```

**Xóa bình luận:**
```
DELETE /api/posts/{postId}/comments/{commentId}
  └── Quyền xóa: tác giả bình luận HOẶC tác giả bài đăng
```

#### Xóa bài viết

```
handleDeletePost()
  └── Xác nhận (confirm) → DELETE /api/posts/{id}
        └── Gọi onPostDeleted(id)
```

#### Sửa bài viết

```
Nhấn nút Edit → mở EditPostModal
  └── Khi EditPostModal trả về updatedPost
        └── Merge lại với metadata hiện tại (author, counts...)
        └── Gọi onPostUpdated(mergedPost)
```

---

### 9.3 ShareModal — Chia sẻ bài viết

**File:** `src/components/ShareModal.jsx`

**Giao diện:** Modal fullscreen backdrop + textarea "Lời dẫn" + Preview bài gốc nhúng.

**Luồng:**
```
handleSubmit()
  └── POST /api/posts/{id}/share { content: shareText }
        └── Thành công → onShareSuccess(newPost) + onClose()
```

---

### 9.4 EditPostModal — Chỉnh sửa bài viết

**File:** `src/components/EditPostModal.jsx`

**Giao diện:** Modal chỉnh sửa với textarea nội dung + quản lý hình ảnh (giữ/xóa ảnh cũ, thêm ảnh mới).

**Luồng:**
```
handleSubmit()
  ├── Trường hợp A: Có ảnh MỚI chọn
  │     └── POST /api/media/upload (FormData) → lấy mediaId mới
  │
  ├── Trường hợp B: GIỮ ảnh cũ
  │     └── finalMediaIds = post.media_ids (không đổi)
  │
  ├── Trường hợp C: XÓA ảnh cũ, không chọn ảnh mới
  │     └── finalMediaIds = [] (mảng rỗng)
  │
  └── PUT /api/posts/{id} { content, mediaIds: finalMediaIds }
        └── Thành công → onPostUpdated(updatedPost) + onClose()
```

---

### 9.5 ChatWidget — Sidebar Chat & Ô Chat Nổi

**File:** `src/components/ChatWidget.jsx`

**Vai trò kép:**
1. **Sidebar phải** (fixed, w-64) — Hiển thị danh sách bạn bè với trạng thái online/offline.
2. **Quản lý ô chat nổi** — Tối đa 3 ChatBox nổi ở góc dưới phải.

**Luồng tải danh sách bạn bè:**
```
useEffect (mount + lắng nghe "friends-updated")
  └── GET /api/friends → setFriends(data)
```

**Mở ô chat:**
```
handleOpenChat(friend)
  └── POST /api/conversations { participantId: friend.id }
        └── Trả về conversation (tạo mới hoặc lấy sẵn có)
        └── Nếu chưa mở → thêm vào openChats[]
              └── Nếu đã đạt 3 ô → đóng ô lâu nhất (shift)
```

**Lắng nghe sự kiện mở chat từ trang khác:**
```
window.addEventListener("open-chat", handleOpenChatEvent)
  └── Nhận CustomEvent → gọi handleOpenChat(friend)
  └── Ví dụ: Trang Profile dispatch "open-chat" khi nhấn nút "Nhắn tin"
```

**Tự động bật popup khi có tin nhắn đến:**
```
chatSocket.on("message:received", (message) => {
    if (ô chat chưa mở cho conversationId này) {
        GET /api/conversations/{conversationId}
          └── Mở ChatBox mới
    }
});
```

**Tạo nhóm chat:**
```
handleCreateGroupSubmit()
  └── POST /api/groups { name, memberIds }
        └── Thành công → lấy conversationId
              └── GET /api/conversations/{conversationId}
              └── Mở ChatBox cho nhóm mới
```

---

### 9.6 ChatBox — Ô Chat Chi Tiết

**File:** `src/components/ChatBox.jsx`

**Giao diện:** Popup nhỏ (w-80, h-400px) — Header + Vùng tin nhắn + Input gửi tin.

#### Phân biệt chat 1-1 vs Nhóm

| Thuộc tính | Chat 1-1 | Chat Nhóm |
|---|---|---|
| Tiêu đề | Tên đối phương | Tên nhóm |
| Avatar | Avatar đối phương | Avatar nhóm (identicon) |
| Subtitle | "Trực tuyến" / "Ngoại tuyến" | "N thành viên" |
| Hiển thị tên người gửi | Không | Có (trên mỗi tin nhắn) |

#### Tải lịch sử tin nhắn

```
useEffect — Khi conversationId thay đổi
  └── GET /api/conversations/{id}/messages?limit=40
        └── Đảo ngược mảng (.reverse()) để hiển thị từ cũ → mới
        └── setMessages(data)
```

#### Join room WebSocket

```
useEffect — Khi conversationId hoặc chatSocket thay đổi
  ├── chatSocket.emit("conversation:join", { conversationId })
  └── chatSocket.on("connect", joinRoom)  ← Auto re-join khi reconnect
```

#### Nhận tin nhắn + typing indicator realtime

```
chatSocket.on("message:received", (message) => {
    if (message.conversationId === currentConversationId) {
        setMessages(prev => [...prev, message]);
        chatSocket.emit("message:read", { conversationId, messageId });
    }
});

chatSocket.on("typing:indicator", (data) => {
    if (data.conversationId === currentConversationId && data.userId !== me) {
        setIsOtherUserTyping(data.isTyping);
    }
});
```

#### Gửi tin nhắn (qua WebSocket)

> **Chú ý:** ChatBox gửi tin nhắn qua **Socket.IO emit**, trong khi Messages page gửi qua **REST API POST**.

```
handleSendMessage()
  ├── Có hình ảnh đính kèm?
  │     └── POST /api/media/upload (FormData) → lấy mediaId
  │
  └── chatSocket.emit("message:send", {
        conversationId,
        content: inputText,
        type: mediaId ? "image" : "text",
        mediaId
      })

Dọn dẹp trạng thái typing:
  ├── chatSocket.emit("typing:stop", { conversationId })
  └── Reset input + remove image preview
```

#### Chỉ số "Đang gõ..." (Typing Indicator)

```
handleInputChange(e)
  ├── Nếu chưa đang gõ:
  │     ├── setIsTyping(true)
  │     └── chatSocket.emit("typing:start", { conversationId })
  │
  └── Tạo debounce timeout (1.5 giây):
        └── Sau 1.5s không nhập → setIsTyping(false) + emit "typing:stop"
```

#### Component ChatImage (lồng trong ChatBox)

Tải và hiển thị ảnh đính kèm trong tin nhắn:
```
ChatImage({ mediaId })
  ├── GET /api/media/{mediaId}/url → lấy URL tương đối
  ├── GET fullUrl (responseType: "blob") → tải blob
  └── URL.createObjectURL(blob) → <img>
```

### 9.7 HlsVideoPlayer — Phát video HLS & Tối ưu hóa

**File:** `src/components/HlsVideoPlayer.jsx`

**Vai trò:** Phát các file video định dạng HLS (`.m3u8`) hoặc tự động fallback sang định dạng MP4 nếu HLS chưa sẵn sàng.

**Cơ chế tối ưu hóa hiệu năng (Lazy Loading & Socket Cleanup):**
1. **Lazy Loading theo trạng thái active**: Đối với các video trong danh sách Reels, đầu chơi (HlsVideoPlayer) chỉ bắt đầu tải playlist và nạp phân đoạn `.ts` khi Reel đó thực sự đang active (`isActive === true`). Điều này ngăn chặn việc trình duyệt tải song song hàng chục phân đoạn video ở chế độ nền, loại bỏ hiện tượng nghẽn mạng.
2. **Giải phóng Socket & RAM tức thì**: Khi cuộn Reel qua trang khác hoặc khi player unmount, component sẽ thực hiện dọn dẹp:
   - Hủy thực thể Hls (`hls.destroy()`).
   - Dừng phát video (`video.pause()`).
   - Xóa thuộc tính `src` (`video.removeAttribute('src')`).
   - Buộc trình duyệt giải phóng bộ nhớ đệm và các kết nối mạng đang mở (`video.load()`).
3. **Stream MP4 trực tiếp**: Nếu HLS chưa sẵn sàng (trả về 404), player tự động phát bằng file MP4 gốc. Đối với môi trường localhost/không có ngrok, video MP4 sẽ được stream trực tiếp qua HTTP range request thay vì phải tải toàn bộ file thành bộ nhớ đệm Blob, giúp bắt đầu phát chỉ trong vài mili-giây.

---

## 10. Tổng hợp toàn bộ API Endpoints

### 🔐 Auth Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `POST` | `/api/auth/login` | Đăng nhập | AuthContext |
| `POST` | `/api/auth/register` | Đăng ký | AuthContext |
| `POST` | `/api/auth/logout` | Đăng xuất | AuthContext |
| `POST` | `/api/auth/refresh` | Làm mới token | api.js interceptor |

### 👤 User Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `GET` | `/api/users/{id}` | Lấy thông tin user | AuthContext, Profile |
| `GET` | `/api/users/search?q={query}` | Tìm kiếm user | Friends |

### 👥 Friend Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `GET` | `/api/friends` | Danh sách bạn bè | Friends, Messages, ChatWidget |
| `GET` | `/api/friends/requests?type=received` | Lời mời kết bạn đã nhận | Friends |
| `GET` | `/api/friends/suggestions?limit=10` | Gợi ý bạn bè | Friends |
| `GET` | `/api/friends/check/{userId}` | Kiểm tra trạng thái kết bạn | Friends, Profile |
| `POST` | `/api/friends/request` | Gửi lời mời kết bạn | Friends, Profile |
| `PUT` | `/api/friends/requests/{id}/accept` | Chấp nhận kết bạn | Friends, Profile |
| `PUT` | `/api/friends/requests/{id}/reject` | Từ chối kết bạn | Friends, Profile |
| `DELETE` | `/api/friends/{friendId}` | Hủy kết bạn | Friends, Profile |

### 📝 Post Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `GET` | `/api/feed` | Lấy bảng tin | Feed |
| `GET` | `/api/posts/{id}` | Chi tiết bài viết | PostDetail, PostCard (bài gốc) |
| `GET` | `/api/posts/user/{id}` | Bài viết theo user | Profile |
| `POST` | `/api/posts` | Đăng bài mới | CreatePost |
| `PUT` | `/api/posts/{id}` | Cập nhật bài viết | EditPostModal |
| `DELETE` | `/api/posts/{id}` | Xóa bài viết | PostCard |
| `POST` | `/api/posts/{id}/like` | Thích/bỏ thích | PostCard |
| `GET` | `/api/posts/{id}/comments` | Lấy bình luận | PostCard |
| `POST` | `/api/posts/{id}/comments` | Thêm bình luận | PostCard |
| `DELETE` | `/api/posts/{id}/comments/{commentId}` | Xóa bình luận | PostCard |
| `POST` | `/api/posts/{id}/share` | Chia sẻ bài viết | ShareModal |

### 🖼️ Media Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `POST` | `/api/media/upload` | Upload file ảnh/video | CreatePost, EditPostModal, Messages, ChatBox |
| `GET` | `/api/media/file/{mediaId}` | Tải file (blob) | PostCard, Messages (ChatMedia) |
| `GET` | `/api/media/{mediaId}/url` | Lấy URL file | PostCard (bài gốc chia sẻ), ChatBox (ChatImage) |

### 💬 Chat Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `GET` | `/api/conversations` | Danh sách hội thoại | Messages |
| `GET` | `/api/conversations/{id}` | Chi tiết 1 hội thoại | ChatWidget |
| `POST` | `/api/conversations` | Tạo/lấy conversation 1-1 | ChatWidget |
| `GET` | `/api/conversations/{id}/messages` | Lịch sử tin nhắn | Messages, ChatBox |
| `POST` | `/api/conversations/{id}/messages` | Gửi tin nhắn (REST) | Messages |
| `POST` | `/api/groups` | Tạo nhóm chat | Messages, ChatWidget |

### 🔔 Notification Service

| Method | Endpoint | Mô tả | Nơi gọi |
|---|---|---|---|
| `GET` | `/api/notifications` | Danh sách thông báo | Notifications |
| `GET` | `/api/notifications/unread-count` | Số lượng chưa đọc | SocketContext |
| `PUT` | `/api/notifications/{id}/read` | Đánh dấu đã đọc | Notifications |
| `PUT` | `/api/notifications/read-all` | Đánh dấu đọc tất cả | Notifications |

---

## 11. Cơ chế WebSocket Realtime

### Tổng quan 2 kênh WebSocket

```
┌──────────────────────────────────────────────────────────┐
│                     API GATEWAY                           │
│                                                          │
│  ┌─────────────────────┐    ┌─────────────────────────┐  │
│  │ Notification Socket │    │      Chat Socket        │  │
│  │ path: /notification │    │  path: /chat/socket.io/ │  │
│  │       /socket.io/   │    │                         │  │
│  │                     │    │                         │  │
│  │ Events nhận:        │    │ Events nhận:            │  │
│  │ • notification:new  │    │ • message:received      │  │
│  │ • notification:count│    │ • message:new           │  │
│  │                     │    │ • user:online           │  │
│  │                     │    │ • user:offline          │  │
│  │                     │    │ • typing:indicator      │  │
│  │                     │    │                         │  │
│  │                     │    │ Events gửi:             │  │
│  │                     │    │ • message:send          │  │
│  │                     │    │ • message:read          │  │
│  │                     │    │ • conversation:join     │  │
│  │                     │    │ • typing:start          │  │
│  │                     │    │ • typing:stop           │  │
│  └─────────────────────┘    └─────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Chi tiết từng sự kiện

#### Notification Socket

| Sự kiện | Hướng | Mô tả | Xử lý |
|---|---|---|---|
| `notification:new` | Server → Client | Thông báo mới | Tăng unreadCount, hiện toast, dispatch event |
| `notification:count` | Server → Client | Đồng bộ số chưa đọc | setUnreadCount |

#### Chat Socket

| Sự kiện | Hướng | Mô tả | Xử lý |
|---|---|---|---|
| `user:online` | Server → Client | User online | Thêm vào onlineUsers map |
| `user:offline` | Server → Client | User offline | Xóa khỏi onlineUsers map |
| `message:received` | Server → Client | Tin nhắn đến (ChatBox) | Thêm vào messages, emit read |
| `message:new` | Server → Client | Tin nhắn mới (Messages page) | Thêm vào messages nếu đang xem, refetch conversations |
| `typing:indicator` | Server → Client | Đối phương đang gõ | Hiển thị animation 3 chấm |
| `message:send` | Client → Server | Gửi tin nhắn | ChatBox emit khi gửi |
| `message:read` | Client → Server | Đánh dấu đã đọc | ChatBox emit khi nhận tin |
| `conversation:join` | Client → Server | Join room hội thoại | ChatBox emit khi mở |
| `typing:start` | Client → Server | Bắt đầu gõ | ChatBox emit khi bắt đầu nhập |
| `typing:stop` | Client → Server | Ngừng gõ | ChatBox emit sau 1.5s không nhập |

### Xác thực WebSocket

Cả 2 socket đều gửi `auth: { token: accessToken }` khi kết nối. Server xác thực JWT token trước khi cho phép tham gia.

---

## 12. Cơ chế đồng bộ giữa các Component (Custom Events)

Frontend sử dụng **`window.dispatchEvent`** với **`CustomEvent`** để đồng bộ state giữa các component không có quan hệ cha-con trực tiếp.

| Event | Dispatch từ | Lắng nghe tại | Mục đích |
|---|---|---|---|
| `friends-updated` | Friends, Profile | ChatWidget | Reload danh sách bạn bè trên sidebar phải khi có thay đổi |
| `open-chat` | Profile | ChatWidget | Mở ô chat nổi cho 1 người dùng cụ thể |
| `notification-received` | SocketContext | Notifications | Chèn thông báo mới vào danh sách khi trang Notifications đang mở |

**Luồng ví dụ — Chấp nhận kết bạn:**
```
Friends.handleAccept()
  ├── PUT /api/friends/requests/{id}/accept
  ├── Cập nhật state cục bộ (xóa từ requests, thêm vào friends)
  └── window.dispatchEvent(new Event("friends-updated"))
        └── ChatWidget.useEffect lắng nghe
              └── Gọi lại GET /api/friends → cập nhật sidebar phải
```

**Luồng ví dụ — Mở chat từ Profile:**
```
Profile.handleStartChat()
  └── window.dispatchEvent(new CustomEvent("open-chat", {
        detail: { id, displayName, avatarUrl }
      }))
        └── ChatWidget.handleOpenChatEvent()
              └── POST /api/conversations { participantId }
              └── Mở ChatBox nổi
```

---

## 13. Sơ đồ kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                        │
│                                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────────────┐   │
│  │ AuthContext  │   │ SocketContext │   │        Layout              │   │
│  │             │   │              │   │  ┌─────┐ ┌──────┐ ┌──────┐│   │
│  │ • user      │   │ • notifSocket│   │  │Side │ │Main  │ │Chat  ││   │
│  │ • isAuth    │   │ • chatSocket │   │  │bar  │ │Content│ │Widget││   │
│  │ • login()   │   │ • unreadCount│   │  │(nav)│ │(pages)│ │(right)│   │
│  │ • register()│   │ • onlineUsers│   │  └─────┘ └──────┘ └──────┘│   │
│  │ • logout()  │   │ • toast      │   │                            │   │
│  └──────┬──────┘   └──────┬───────┘   └────────────┬───────────────┘   │
│         │                 │                        │                    │
│  ┌──────┴─────────────────┴────────────────────────┴──────────────┐    │
│  │                     Axios API Instance (api.js)                 │    │
│  │  ┌──────────────────────┐  ┌────────────────────────────────┐  │    │
│  │  │ Request Interceptor  │  │ Response Interceptor           │  │    │
│  │  │ (đính kèm JWT token) │  │ (auto refresh token khi 401)  │  │    │
│  │  └──────────────────────┘  └────────────────────────────────┘  │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
│                               │                                        │
│         HTTP REST             │             WebSocket                   │
│         (Axios)               │             (Socket.IO)                 │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    API GATEWAY        │
                    │  (http://localhost:8080)│
                    │                       │
                    │  /api/auth/*   → Auth │
                    │  /api/users/*  → User │
                    │  /api/friends/* → Friend│
                    │  /api/posts/*  → Post │
                    │  /api/feed     → Post │
                    │  /api/media/*  → Media│
                    │  /api/conversations/* → Chat │
                    │  /api/groups   → Chat │
                    │  /api/notifications/* → Notification │
                    │                       │
                    │  /notification/socket.io/ → Notification WS│
                    │  /chat/socket.io/         → Chat WS       │
                    └───────────────────────┘
                                │
          ┌─────────┬───────────┼──────────┬──────────┬──────────┐
          ▼         ▼           ▼          ▼          ▼          ▼
    ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │  User   │ │ Friend │ │  Post  │ │ Media  │ │  Chat  │ │Notific.│
    │ Service │ │ Service│ │ Service│ │ Service│ │ Service│ │Service │
    └─────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

---

## 📋 Ghi chú bổ sung

### Quản lý Media (Blob URL Pattern)

Frontend không sử dụng URL ảnh trực tiếp mà tải ảnh qua **Axios (có đính kèm JWT token)** dưới dạng **blob**, sau đó tạo **Object URL** (`URL.createObjectURL`) để hiển thị. Mục đích:
- Bảo mật: Media yêu cầu xác thực JWT.
- Tương thích ngrok tunnel (cần header `ngrok-skip-browser-warning`).
- Luôn gọi `URL.revokeObjectURL()` khi component unmount để tránh rò rỉ bộ nhớ (memory leak).

### Hai cách gửi tin nhắn

| Vị trí | Phương thức | Lý do |
|---|---|---|
| **ChatBox** (ô chat nổi) | `chatSocket.emit("message:send")` | Realtime, tức thì, không cần refetch |
| **Messages** (trang full) | `POST /api/conversations/{id}/messages` | REST API truyền thống, sau đó refetch |

### Trạng thái Online/Offline

- `SocketContext` duy trì map `onlineUsers: { userId: true/false }`.
- `ChatWidget` (sidebar phải) hiển thị **chấm xanh** (online) hoặc **chấm xám** (offline) cạnh avatar bạn bè.
- `Messages` (trang tin nhắn) hiển thị chấm online trên danh sách hội thoại.
- `ChatBox` hiển thị "Trực tuyến" / "Ngoại tuyến" trên header ô chat.

### Tương thích ngược bình luận

Hệ thống bình luận hỗ trợ 5 định dạng phản hồi khác nhau (từ cũ đến mới) để đảm bảo dữ liệu cũ vẫn hiển thị đúng khi nâng cấp format.

---

> **Tổng kết:** Frontend SocialHub được xây dựng theo kiến trúc **SPA (Single Page Application)** với React, sử dụng **Context API** cho quản lý state toàn cục, **Axios interceptors** cho quản lý token tự động, và **Socket.IO** cho giao tiếp realtime 2 chiều. Tất cả API đều đi qua **API Gateway** tại cổng 8080, gateway phân phối tới 6 microservices phía sau.
