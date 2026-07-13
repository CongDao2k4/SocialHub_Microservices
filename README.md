# SocialHub Microservices Platform

Chào mừng bạn đến với **SocialHub**, hệ thống mạng xã hội phát triển theo kiến trúc Microservices phân tán. 

Hệ thống được thiết kế để tối ưu hóa tài nguyên: các **cơ sở dữ liệu và dịch vụ trung gian chạy trong Docker**, trong khi **các microservices ứng dụng chạy trực tiếp trên máy host (Node.js)** để giảm tải sử dụng RAM.

---

## 🗺️ Bản Đồ Cổng Kết Nối & Tài Nguyên (Infrastructure Allocations)

Hệ thống phân chia cổng rõ ràng giữa môi trường Docker và môi trường Host:

### 1. Cơ sở hạ tầng trung gian (Docker Containers)
Các dịch vụ nền được kích hoạt qua Docker Compose và mở cổng trực tiếp ra máy host:

| Dịch vụ | Cổng trên Host | Cổng trong Container | Mục đích sử dụng |
|---|---|---|---|
| **PostgreSQL** | `5432` | `5432` | DB cho `user-service`, `friend-service`, `post-service` |
| **MongoDB** | `27018` | `27017` | DB lưu trữ dữ liệu của `media-service`, `notification-service`, và `chat-service` |
| **Redis** | `6379` | `6379` | Cache dữ liệu, lưu trữ trạng thái online (presence) & Blacklist Token JWT |
| **MinIO** | `9005` (API) / `9001` (Console) | `9000` / `9001` | S3-compatible lưu trữ ảnh và video đa phương tiện |
| **RabbitMQ** | `5672` (AMQP) / `15672` (Console) | `5672` / `15672` | Message Broker trung chuyển các sự kiện thông báo bất đồng bộ |

### 2. Các Microservices Ứng Dụng (Chạy local trên Host)

| Tên Dịch Vụ              | Cổng trên Host | URL Downstream | Trách nhiệm chính |
|--------------------------|---|---|---|
| **API Gateway**          | `8080` | `http://localhost:8080` | Cổng vào duy nhất, Routing, Auth JWT, Rate Limit, WS Proxy, Swagger API Docs |
| **user-service**         | `5001` | `http://localhost:5001` | Quản lý Tài khoản, Đăng nhập, Profile, Search User, Batch API |
| **friend-service**       | `5002` | `http://localhost:5002` | Quản lý kết bạn, Lời mời kết bạn, mutual friends, suggestions |
| **post-service**         | `5003` | `http://localhost:5003` | Quản lý bài viết, Newsfeed, Likes, Bình luận, Chia sẻ (Prisma ORM) |
| **chat-service**         | `5004` | `http://localhost:5004` | Quản lý tin nhắn 1-1, nhóm chat, lịch sử chat (MongoDB), online presence |
| **media-service**        | `5005` | `http://localhost:5005` | Upload file ảnh/video lên MinIO, tạo presigned URL có hạn |
| **notification-service** | `5006` | `http://localhost:5006` | Bridge sự kiện Redis Pub/Sub sang RabbitMQ, đẩy Realtime via Sockets |

---

## 📖 Centralized Swagger UI — Kiểm Thử REST API Tập Trung

Chúng tôi đã tích hợp công cụ Swagger UI tập trung trực tiếp ngay trên API Gateway. Bạn không cần phải chạy từng trang tài liệu riêng lẻ nữa.

- **Địa chỉ truy cập**: [http://localhost:8080/api-docs](http://localhost:8080/api-docs)
- **Cách sử dụng**: Ở góc trên cùng bên phải giao diện Swagger UI, bạn sẽ thấy một dropdown list cho phép bạn dễ dàng chuyển đổi qua lại giữa các tài liệu đặc tả của các dịch vụ:
  - **User & Auth Service**
  - **Friend Service**
  - **Post Service**
  - **Media Service**
  - **Notification Service**
  - **Chat Service**
- *Lưu ý*: Mọi API gọi từ Swagger UI sẽ tự động đi qua API Gateway cổng `8080`. Bạn có thể gán Access Token nhận được sau khi login vào phần **Authorize** (Bearer Token) ở đầu trang để kiểm thử các API được bảo vệ.

---

## 🔌 Giao Thức Kết Nối Realtime WebSockets (Socket.IO)

Để tránh xung đột nâng cấp kết nối (Upgrade Collisions) giữa dịch vụ Thông báo và dịch vụ Chat thông qua API Gateway, các đường dẫn WebSocket được chia tách như sau:

### 1. Sockets Thông Báo (`notification-service`)
- **Gateway Address**: `ws://localhost:8080`
- **Path option**: `/notification/socket.io/`
- **Handshake Auth**: `{ token: "Bearer <JWT-Access-Token>" }`
- **Sự kiện lắng nghe**:
  - `notification:new`: Nhận thông báo đẩy thời gian thực (like, comment, kết bạn, tin nhắn mới, thêm nhóm).
  - `notification:count`: Nhận cập nhật số lượng thông báo chưa đọc.

### 2. Sockets Nhắn Tin (`chat-service`)
- **Gateway Address**: `ws://localhost:8080`
- **Path option**: `/chat/socket.io/`
- **Handshake Auth**: `{ token: "Bearer <JWT-Access-Token>" }`
- **Sự kiện truyền nhận**:
  - `message:send` / `message:received`: Gửi/Nhận tin nhắn (1-1 hoặc Group).
  - `message:read` / `message:read:ack`: Đọc tin nhắn và xác nhận đã đọc.
  - `typing:start` / `typing:stop` / `typing:indicator`: Trạng thái đang soạn tin.
  - `user:online` / `user:offline`: Trạng thái hoạt động của bạn bè.

---

## 🚀 Hướng Dẫn Chạy Hệ Thống

### Bước 1: Khởi động cơ sở hạ tầng (Docker)
Từ thư mục root của dự án, khởi động cơ sở dữ liệu và queue:
```bash
docker compose up -d
```

### Bước 2: Khởi động các Microservices cục bộ
Mở các cửa sổ terminal riêng biệt trên máy của bạn và chạy các lệnh sau:

```bash
# 1. Khởi chạy user-service
cd services/user-service && npm install && npm run dev

# 2. Khởi chạy friend-service
cd services/friend-service && npm install && npm run dev

# 3. Khởi chạy post-service
cd services/post-service && npm install && npm run dev

# 4. Khởi chạy chat-service
cd services/chat-service && npm install && npm run dev

# 5. Khởi chạy media-service
cd services/media-service && npm install && npm run dev

# 6. Khởi chạy notification-service
cd services/notification-service && npm install && npm run dev

# 8. Khởi chạy API Gateway
cd gateway && npm install && npm run dev

# 9. Khởi chạy Giao Diện Frontend
cd frontend && npm install && npm run dev
```

---

## 🧪 Kịch Bản Chạy Kiểm Thử Tự Động (Integration Tests)

Dự án đi kèm các kịch bản test tự động bằng Node.js giúp kiểm tra toàn bộ luồng nghiệp vụ thông qua Gateway:

```bash
# Di chuyển vào thư mục gateway
cd gateway

# Test 1: Đăng ký, Đăng nhập, Profile, Upload Media, Logout & Blacklist token
node tests/integration.test.js

# Test 2: Test đẩy thông báo thời gian thực qua WebSockets (Socket.IO) & hàng đợi RabbitMQ
node tests/test-notifications.js
```

Kiểm thử chức năng realtime nhắn tin 1-1 của Chat Service:
```bash
# Di chuyển vào thư mục chat-service
cd services/chat-service

# Test 3: Test kết nối Socket, nhắn tin, typing indicator và đọc tin giữa Alice và Bob
node src/test-client.js
```

---

## 📖 Hướng Dẫn Gọi REST API Qua API Gateway (`localhost:8080`)

Mọi yêu cầu từ Client phải đi qua Gateway tại địa chỉ `http://localhost:8080/api`.

### 1. Danh Mục API Xác Thực & Người Dùng (`user-service`)

#### 🔹 Đăng ký tài khoản mới (Public)
`POST /api/auth/register`
- **Body JSON**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "Nguyen Van A"
  }
  ```
- **Response (201 Created)**: Trả về thông tin user và tokens.

#### 🔹 Đăng nhập tài khoản (Public)
`POST /api/auth/login`
- **Body JSON**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK)**: Trả về access token JWT (dùng để gán vào header `Authorization: Bearer <token>` cho các API sau).

#### 🔹 Đăng xuất tài khoản (Protected)
`POST /api/auth/logout`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**: Token sẽ bị đưa vào Redis Blacklist ngăn chặn tái sử dụng.

#### 🔹 Xem trang cá nhân người dùng (Protected)
`GET /api/users/:userId`
- **Headers**: `Authorization: Bearer <token>`

#### 🔹 Cập nhật trang cá nhân (Protected)
`PUT /api/users/:userId`
- **Headers**: `Authorization: Bearer <token>`
- **Body JSON**: `{ "name": "Ten Moi", "bio": "Thong tin bio cap nhat" }`

#### 🔹 Tìm kiếm người dùng (Protected)
`GET /api/users/search?q=Nguyen`
- **Headers**: `Authorization: Bearer <token>`

---

### 2. Danh Mục API Bạn Bè & Mạng Lưới (`friend-service`)

*Tất cả API dưới đây đều yêu cầu Header: `Authorization: Bearer <token>`*

#### 🔹 Gửi lời mời kết bạn
`POST /api/friends/request`
- **Body JSON**: `{ "toUserId": "<id-nguoi-nhan>" }`

#### 🔹 Danh sách lời mời kết bạn (đã gửi và nhận)
`GET /api/friends/requests`

#### 🔹 Chấp nhận lời mời kết bạn
`PUT /api/friends/requests/:requestId/accept`

#### 🔹 Từ chối lời mời kết bạn
`PUT /api/friends/requests/:requestId/reject`

#### 🔹 Xem danh sách bạn bè của tôi
`GET /api/friends`

#### 🔹 Xem gợi ý kết bạn (bạn chung)
`GET /api/friends/suggestions`

#### 🔹 Xem bạn chung với một người
`GET /api/friends/mutual/:userId`

#### 🔹 Hủy kết bạn
`DELETE /api/friends/:friendId`

---

### 3. Danh Mục API Bài Viết & Tương Tác (`post-service`)

*Tất cả API dưới đây đều yêu cầu Header: `Authorization: Bearer <token>`*

#### 🔹 Tạo bài viết mới
`POST /api/posts`
- **Body JSON**:
  ```json
  {
    "content": "Hôm nay trời đẹp quá!",
    "mediaIds": ["media-uuid-1"],
    "visibility": "friends"
  }
  ```

#### 🔹 Lấy thông tin bài viết theo ID
`GET /api/posts/:postId`

#### 🔹 Xóa bài viết
`DELETE /api/posts/:postId`

#### 🔹 Lấy danh sách bài viết của một user cụ thể
`GET /api/posts/user/:userId`

#### 🔹 Lấy bảng tin Newsfeed của tôi (phân trang)
`GET /api/feed?page=1&limit=10`

#### 🔹 Thích (Like) bài viết
`POST /api/posts/:postId/like`

#### 🔹 Bỏ Thích (Unlike) bài viết
`DELETE /api/posts/:postId/like`

#### 🔹 Xem danh sách bình luận của bài viết
`GET /api/posts/:postId/comments?page=1&limit=20`

#### 🔹 Viết bình luận mới
`POST /api/posts/:postId/comments`
- **Body JSON**: `{ "content": "Bài viết hay quá bạn ơi!" }`

#### 🔹 Xóa bình luận
`DELETE /api/posts/:postId/comments/:commentId`

#### 🔹 Chia sẻ bài viết (Share)
`POST /api/posts/:postId/share`

---

### 4. Danh Mục API Tệp Đa Phương Tiện (`media-service`)

*Tất cả API dưới đây đều yêu cầu Header: `Authorization: Bearer <token>` (ngoại trừ endpoint Tải/Hiển thị file nhị phân trực tiếp)*

#### 🔹 Tải lên tệp ảnh/video
`POST /api/media/upload`
- **Content-Type**: `multipart/form-data`
- **Form Data**: Gửi file qua key `file` (ví dụ: `file=@image.png`).
- **Response (201 Created)**: Trả về metadata và `id` của file media.

#### 🔹 Lấy thông tin metadata của file
`GET /api/media/:mediaId`

#### 🔹 Lấy đường dẫn URL proxy dùng để tải/hiển thị file
`GET /api/media/:mediaId/url`
- **Response**: Trả về đường dẫn proxy đi qua Gateway `/media/file/:mediaId` (nhằm giải quyết các lỗi mixed-content HTTPS và ngrok khi chạy trên Vercel).

#### 🔹 Tải/Hiển thị file nhị phân trực tiếp (Public - Không cần Token)
`GET /api/media/file/:mediaId`
- **Response**: Trả về luồng file nhị phân trực tiếp với đúng `Content-Type` và `Cache-Control` được thiết lập dài hạn trong trình duyệt.

#### 🔹 Xóa file
`DELETE /api/media/:mediaId`

---

### 5. Danh Mục API Nhắn Tin & Trò Chuyện (`chat-service`)

*Tất cả API dưới đây đều yêu cầu Header: `Authorization: Bearer <token>`*

#### 🔹 Lấy danh sách cuộc hội thoại của tôi
`GET /api/conversations`
- **Response**: Trả về danh sách các cuộc hội thoại 1-1 và hội thoại nhóm kèm tin nhắn cuối cùng.

#### 🔹 Tạo cuộc hội thoại 1-1 mới
`POST /api/conversations`
- **Body JSON**: `{ "recipientId": "<id-user-nhan>" }`

#### 🔹 Lấy lịch sử tin nhắn trong cuộc hội thoại (phân trang)
`GET /api/conversations/:conversationId/messages?page=1&limit=20`

#### 🔹 Tạo phòng chat nhóm mới
`POST /api/groups`
- **Body JSON**: 
  ```json
  {
    "name": "Nhóm Lập Trình Viên",
    "members": ["user-uuid-1", "user-uuid-2"]
  }
  ```

#### 🔹 Lấy thông tin chi tiết phòng chat nhóm
`GET /api/groups/:groupId`

#### 🔹 Cập nhật thông tin phòng chat nhóm
`PUT /api/groups/:groupId`
- **Body JSON**: `{ "name": "Tên Nhóm Mới" }`

#### 🔹 Thêm thành viên vào phòng chat nhóm
`POST /api/groups/:groupId/members`
- **Body JSON**: `{ "userId": "<id-user-moi>" }`

#### 🔹 Xóa thành viên khỏi phòng chat nhóm (Chỉ Admin)
`DELETE /api/groups/:groupId/members/:userId`

#### 🔹 Rời khỏi phòng chat nhóm
`POST /api/groups/:groupId/leave`

#### 🔹 Kết nối Realtime Chat & Presence (WebSocket)
Khởi tạo kết nối Socket.IO tới Gateway:
- **Địa chỉ**: `ws://localhost:8080`
- **Path option**: `/chat/socket.io/`
- **Handshake Auth**: `{ "token": "Bearer <JWT-token>" }`

---

### 6. Danh Mục API Thông Báo (`notification-service`)

*Tất cả API dưới đây đều yêu cầu Header: `Authorization: Bearer <token>`*

#### 🔹 Lấy danh sách thông báo của tôi (phân trang)
`GET /api/notifications?page=1&limit=20&unreadOnly=false`
- **Query Params**: `unreadOnly=true` lọc chỉ lấy các thông báo chưa đọc.

#### 🔹 Lấy số lượng thông báo chưa đọc
`GET /api/notifications/unread-count`

#### 🔹 Đánh dấu một thông báo đã đọc
`PUT /api/notifications/:notificationId/read`

#### 🔹 Đánh dấu đọc toàn bộ thông báo
`PUT /api/notifications/read-all`

#### 🔹 Kết nối Realtime push (WebSocket)
Khởi tạo kết nối Socket.IO tới Gateway:
- **Địa chỉ**: `ws://localhost:8080`
- **Path option**: `/notification/socket.io/`
- **Handshake Auth**: `{ "token": "Bearer <JWT-token>" }`
- **Sự kiện lắng nghe**:
  - `notification:new`: Nhận thông báo đẩy thời gian thực ngay khi có tương tác (like, comment, gửi lời mời kết bạn, nhắn tin...).
  - `notification:count`: Nhận cập nhật số lượng thông báo chưa đọc mỗi khi thay đổi.

---

## 🛡️ Cấu Hình Logging, Cache-Control & Khả Năng Kháng Lỗi (Resilience Matrix)

Để tối ưu hóa hoạt động và đảm bảo tính nhất quán trên môi trường production (như Vercel và các máy local), hệ thống đã thiết lập cấu hình:

1.  **Vô hiệu hóa ETag & Client Caching (Khắc phục lỗi 304)**:
    - Tất cả các Microservices (`user`, `friend`, `post`, `media`, `chat`, `notification`) và **API Gateway** đều tắt tính năng tự động tạo mã băm ETag của Express (`app.set('etag', false)`).
    - Tích hợp middleware ghi đè các header Cache-Control:
      `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
      Điều này buộc client browser và các server trung gian luôn truy vấn dữ liệu trực tiếp, trả về mã trạng thái `200 OK` thay vì dùng lại cache cũ `304 Not Modified` (gây stale views). Riêng các luồng stream file thô (`/media/file/:id`) được miễn trừ để duy trì hiệu năng tải ảnh.
2.  **Chuẩn hóa Console Logging**:
    - Tất cả các microservices hiện đều tích hợp log HTTP request gọn nhẹ in trực tiếp ra console mỗi khi có API được gọi, dạng: `[HTTP] METHOD PATH STATUS - TIMEms` (ví dụ: `[HTTP] GET /api/friends/requests 200 - 12ms`).
3.  **Kháng lỗi tại API Gateway (Circuit Breaker Resilience)**:
    - **WebSocket Disconnection Protection**: Thêm bộ lọc lỗi `.on('error', ...)` cho Client socket và Proxy socket trong luồng proxy WebSockets thủ công tại `server.js`, ngăn việc Gateway bị sập tiến trình (crashed) khi người dùng ngắt kết nối mạng hoặc đóng tab đột ngột (`ECONNRESET`).
    - **Header Sent Stream Protection**: Trong dịch vụ HTTP Client, hàm fallback Circuit Breaker sẽ kiểm tra điều kiện `res.headersSent` trước khi phản hồi lỗi `503`. Nếu headers đã gửi đi (ví dụ khi đang truyền stream dữ liệu media dở dang thì đứt mạng), hệ thống sẽ ngắt stream và bỏ qua ghi đè status để tránh quăng lỗi crash `ERR_HTTP_HEADERS_SENT`.
