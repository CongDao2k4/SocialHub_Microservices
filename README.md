# SocialHub Microservices Platform

Chào mừng bạn đến với **SocialHub**, hệ thống mạng xã hội phát triển theo kiến trúc Microservice. 
Dự án được tối ưu hóa hiệu năng bằng cách chạy các **dịch vụ cơ sở dữ liệu và trung gian trong Docker**, còn các **microservice ứng dụng chạy trực tiếp trên máy host (Node.js)** để giảm tải sử dụng RAM.

---

## 🗺️ Bản Đồ Cổng Kết Nối (Port Allocations)

Hệ thống được tổ chức phân chia cổng rõ ràng giữa môi trường Docker và môi trường Host:

### 1. Cơ sở hạ tầng trung gian (Docker Containers)
Các container được kích hoạt thông qua Docker Compose và mở cổng trực tiếp ra máy host:

| Dịch vụ | Cổng trên Host | Cổng trong Container | Mục đích sử dụng |
|---|---|---|---|
| **PostgreSQL** | `5432` | `5432` | DB cho `user-service`, `friend-service`, `post-service` |
| **MongoDB** | `27018` | `27017` | DB lưu trữ dữ liệu của `media-service` và `notification-service` |
| **Redis** | `6379` | `6379` | Cache dữ liệu bạn bè & Blacklist Token JWT |
| **MinIO** | `9005` (API) / `9001` (Web Console) | `9000` / `9001` | S3-compatible lưu trữ ảnh và file đa phương tiện |
| **RabbitMQ** | `5672` (AMQP) / `15672` (Console UI) | `5672` / `15672` | Message Queue trung chuyển các sự kiện thông báo |

### 2. Các Microservices Ứng Dụng (Chạy local trên Host)

| Tên Dịch Vụ | Cổng trên Host | URL Downstream | Trách nhiệm chính |
|---|---|---|---|
| **API Gateway** | `8080` | `http://localhost:8080` | Cổng vào duy nhất, Routing, Auth JWT, Rate Limit, WS Proxy |
| **user-service** | `5001` | `http://localhost:5001` | Quản lý Tài khoản, Đăng nhập, Profile, Search User, Batch API |
| **friend-service** | `5002` | `http://localhost:5002` | Quản lý kết bạn, Lời mời kết bạn, mutual friends, suggestions |
| **post-service** | `5003` | `http://localhost:5003` | Quản lý bài viết, Newsfeed, Likes, Bình luận, Chia sẻ |
| **media-service** | `5005` | `http://localhost:5005` | Upload file ảnh/video lên MinIO, tạo presigned URL |
| **notification-service** | `5006` | `http://localhost:5006` | Bridge sự kiện, Queue RabbitMQ, gửi đẩy Realtime via Socket.IO |

---

## 🚀 Hướng Dẫn Chạy Hệ Thống

### Bước 1: Khởi động cơ sở hạ tầng (Docker)
Từ thư mục root của dự án, khởi động cơ sở dữ liệu và queue:
```bash
docker compose up -d
```
*Hệ thống sẽ tự động chạy kịch bản tạo 3 databases PostgreSQL độc lập: `socialhub` (post), `socialhub_user`, và `socialhub_friend`.*

### Bước 2: Khởi động các Microservices cục bộ
Mở các cửa sổ terminal riêng biệt trên máy của bạn và chạy các lệnh sau:

```bash
# 1. Khởi chạy user-service
cd services/user-service && npm install && npm run dev

# 2. Khởi chạy friend-service
cd services/friend-service && npm install && npm run dev

# 3. Khởi chạy post-service
cd services/post-service && npm install && npm run dev

# 4. Khởi chạy media-service
cd services/media-service && npm install && node src/server.js

# 5. Khởi chạy notification-service
cd services/notification-service && npm install && npm run dev

# 6. Khởi chạy API Gateway
cd gateway && npm install && npm run dev
```

---

## 🧪 Kịch Bản Chạy Kiểm Thử (Testing)

Chúng tôi đã viết sẵn các kịch bản test tự động bằng Node.js giúp kiểm tra toàn bộ luồng nghiệp vụ thông qua Gateway:

```bash
# Di chuyển vào thư mục gateway
cd gateway

# Test 1: Đăng ký, Đăng nhập, Profile, Upload Media, Logout & Blacklist token
node tests/integration.test.js

# Test 2: Test đẩy thông báo thời gian thực qua WebSockets (Socket.IO) & hàng đợi RabbitMQ
node tests/test-notifications.js

# Test 3: Test ngắt mạch Circuit Breaker khi media-service bị dừng đột ngột
# (Cách test: Chạy `docker compose stop media-service` rồi gọi lệnh dưới)
node tests/test-circuit-breaker.js
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

*Tất cả API dưới đây đều yêu cầu Header: `Authorization: Bearer <token>`*

#### 🔹 Tải lên tệp ảnh/video
`POST /api/media/upload`
- **Content-Type**: `multipart/form-data`
- **Form Data**: Gửi file qua key `file` (ví dụ: `file=@image.png`).
- **Response (201 Created)**: Trả về metadata và `id` của file media.

#### 🔹 Lấy thông tin metadata của file
`GET /api/media/:mediaId`

#### 🔹 Lấy đường dẫn Presigned URL dùng để tải/hiển thị file
`GET /api/media/:mediaId/url`
- **Response**: Trả về link S3 MinIO trực tiếp có giới hạn thời gian (TTL 15 phút).

#### 🔹 Xóa file
`DELETE /api/media/:mediaId`

---

### 5. Danh Mục API Thông Báo (`notification-service`)

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
- **Địa chỉ**: `ws://localhost:8080` (sử dụng path `/socket.io/`)
- **Handshake Auth**: `{ "token": "Bearer <JWT-token>" }`
- **Sự kiện lắng nghe**:
  - `notification:new`: Nhận thông báo đẩy thời gian thực ngay khi có tương tác (like, comment, gửi lời mời kết bạn...).
  - `notification:count`: Nhận cập nhật số lượng thông báo chưa đọc mỗi khi thay đổi.
