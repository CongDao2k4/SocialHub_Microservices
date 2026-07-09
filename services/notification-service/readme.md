# notification-service

> Dịch vụ quản lý và đẩy thông báo thời gian thực cho hệ thống SocialHub.

---

## 📋 Tổng Quan (Overview)

`notification-service` đảm nhận vai trò thu thập sự kiện bất đồng bộ từ các microservices khác, tổng hợp thông tin, lưu trữ thông báo và đẩy tới người dùng cuối trong thời gian thực.

- **Bounded Context**: Notification Management
- **Trách nhiệm chính**:
  1. Lắng nghe các sự kiện tương tác người dùng (like, comment, kết bạn...) từ hệ thống.
  2. Tạo bản ghi thông báo trong MongoDB.
  3. Duy trì kết nối WebSocket và đẩy thông báo trực tiếp qua **Socket.IO** tới người dùng đang trực tuyến.
  4. Cung cấp các REST API cho phép client truy vấn và đánh dấu đã đọc thông báo.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Ngôn ngữ & Runtime**: Node.js 20 (ES Modules)
- **Framework**: Express.js
- **Cơ sở dữ liệu**: MongoDB (thông qua **Mongoose**)
- **Message Broker**: RabbitMQ (`amqplib`) - Hệ thống hàng đợi xử lý sự kiện
- **Pub/Sub Broker**: Redis (`ioredis`) - Lắng nghe kênh sự kiện thô
- **Đẩy thời gian thực**: Socket.IO (Server)
- **HTTP Client**: Axios (Gọi API User Service để giải quyết thông tin người dùng)

---

## 🔄 Luồng Sự Kiện Bất Đồng Bộ (Async Event Flow)

Dịch vụ sử dụng kết hợp Redis Pub/Sub và RabbitMQ làm trục xương sống truyền nhận sự kiện:

```
[friend-service]  ──(Redis Pub/Sub)──> [Event Bridge]
[post-service]                         (Trong Notification Service)
                                              │
                                       (RabbitMQ Queue)
                                              │
                                              ▼
[Socket.IO Client] <──(Realtime Push)── [MQ Consumer] ──> [MongoDB]
```

### 1. Redis-to-RabbitMQ Event Bridge (`event-bridge.service.js`)
Lắng nghe các sự kiện thô từ các dịch vụ khác trên Redis Pub/Sub và đưa vào hàng đợi bền vững của RabbitMQ:
- **Kênh Redis đăng ký**:
  - `friend.request.sent` — Có lời mời kết bạn mới.
  - `friend.request.accepted` — Lời mời kết bạn được chấp nhận.
  - `post.liked` — Có người thích bài viết.
  - `post.commented` — Có người bình luận bài viết.
  - `post.shared` — Có người chia sẻ bài viết.
- **Hàng đợi RabbitMQ mục tiêu**: `notifications-queue` (Durable queue)

### 2. RabbitMQ Event Consumer (`rabbitmq.consumer.js`)
Tiêu thụ các thông điệp từ `notifications-queue` và xử lý:
1. Trích xuất thông tin định danh của người thực hiện hành động (`actorId`).
2. Gửi request REST API nội bộ tới `user-service` (`POST /api/users/batch`) để lấy thông tin chi tiết của người thực hiện hành động (Tên hiển thị, Ảnh đại diện).
3. Tạo và lưu bản ghi thông báo vào MongoDB.
4. Đẩy sự kiện realtime tới người nhận thông qua Socket.IO room `user:{userId}`.

---

## 💾 Cấu Trúc Dữ Liệu Thông Báo (MongoDB Schema)

Mỗi bản ghi thông báo bao gồm các trường sau:

```javascript
{
  userId: String,        // ID người nhận thông báo (UUID)
  type: String,          // Phân loại: friend_request, friend_accepted, post_liked, post_commented, post_shared
  message: String,       // Nội dung thông báo hiển thị (ví dụ: "Nguyễn Văn A đã thích bài viết của bạn.")
  fromUser: {            // Thông tin người thực hiện hành động
    id: String,
    displayName: String,
    avatarUrl: String
  },
  referenceId: String,   // ID đối tượng liên quan (postId, requestId...)
  referenceType: String, // Loại đối tượng liên quan (post, friend_request...)
  isRead: Boolean,       // Trạng thái đã đọc (mặc định: false)
  createdAt: Date        // Thời gian tạo
}
```

---

## 🔌 Giao Thức Kết Nối WebSockets (Socket.IO API)

Client thiết lập kết nối thời gian thực qua Gateway hoặc trực tiếp tới service:

- **Địa chỉ**: `ws://localhost:8080` (Cổng Gateway) hoặc `ws://localhost:5006` (Trực tiếp)
- **Đường dẫn (Path)**: `/socket.io/`
- **Xác thực**: Gửi JWT token qua đối tượng handshake auth:
  ```json
  {
    "auth": {
      "token": "Bearer <JWT-Access-Token>"
    }
  }
  ```
- **Hành vi kết nối**: Sau khi verify token thành công, Socket sẽ tự động tham gia vào phòng (Room) riêng biệt: `user:{userId}`.

### Sự kiện Server gửi xuống Client (Server-to-Client Events)
1. **`notification:new`**: Phát ra khi có thông báo mới được tạo cho người dùng này.
   - **Payload**:
     ```json
     {
       "id": "6a4f1b8...",
       "type": "friend_request",
       "message": "User A đã gửi lời mời kết bạn.",
       "fromUser": {
         "id": "9f247bd...",
         "displayName": "User A",
         "avatarUrl": null
       },
       "referenceId": "f09b92...",
       "referenceType": "friend_request",
       "isRead": false,
       "createdAt": "2026-07-09T03:54:55.898Z"
     }
     ```
2. **`notification:count`**: Phát ra khi số lượng thông báo chưa đọc của người dùng thay đổi (khi có thông báo mới hoặc khi đánh dấu đã đọc).
   - **Payload**: `{ "unreadCount": 3 }`

---

## 📖 REST API Endpoints

Mọi endpoint (ngoại trừ health check) đều yêu cầu Client truyền kèm Header: `x-user-id` (do Gateway tự động xác thực JWT và chèn vào).

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| **GET** | `/health` | Kiểm tra sức khỏe của dịch vụ | ❌ Public |
| **GET** | `/notifications` | Lấy danh sách thông báo phân trang của user | ✅ JWT |
| **GET** | `/notifications/unread-count` | Lấy tổng số thông báo chưa đọc | ✅ JWT |
| **PUT** | `/notifications/read-all` | Đánh dấu tất cả thông báo là đã đọc | ✅ JWT |
| **PUT** | `/notifications/:id/read` | Đánh dấu một thông báo cụ thể là đã đọc | ✅ JWT |

---

## ⚙️ Biến Môi Trường (Environment Variables)

File cấu hình `.env` của service chứa các thông số:

```env
PORT=5006
MONGO_URI=mongodb://socialhub:socialhub_secret@localhost:27018/socialhub?authSource=admin
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
JWT_SECRET=your-jwt-secret-change-in-production
USER_SERVICE_URL=http://localhost:5001
```

---

## 🚀 Hướng Dẫn Chạy Local

1. Đảm bảo hạ tầng Docker (MongoDB, Redis, RabbitMQ) đang chạy ở máy host.
2. Di chuyển vào thư mục và cài đặt thư viện:
   ```bash
   cd services/notification-service
   npm install
   ```
3. Chạy môi trường phát triển (Hot-reload):
   ```bash
   npm run dev
   ```
