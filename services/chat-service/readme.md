# Chat Service — Messaging

> Bounded Context: Realtime Messaging & Group Management
> Quản lý hội thoại 1-1, nhóm chat, lịch sử tin nhắn, typing indicator, online presence và phát hành sự kiện realtime.

## Overview

- **1-1 Messaging & Group Chat**: Nhắn tin trực tiếp giữa 2 cá nhân và theo nhóm.
- **Realtime via Socket.IO**: Sử dụng Socket.IO v4 kết hợp `@socket.io/redis-adapter` hỗ trợ mở rộng ngang (horizontal scaling) qua nhiều container instances.
- **Message History**: Lưu trữ tin nhắn MongoDB, hỗ trợ phân trang cursor-based pagination thông qua compound index (`conversationId`, `createdAt`).
- **Realtime Features**: Typing indicators (`typing:start`, `typing:stop`), read receipts (`message:read`), online presence (`user:online`, `user:offline`, `presence:heartbeat`).
- **Redis Pub/Sub Events**: Phát hành các sự kiện `message.sent` (khi người nhận offline) và `group.member.added` để `notification-service` xử lý gửi thông báo đẩy.
- **Inter-service Integration**: Gọi REST API sang `user-service` (lấy thông tin người dùng batch) và `media-service` (lấy URL ảnh presigned).

## Tech Stack

| Component  | Choice                              | Lý do |
|------------|-------------------------------------|-------|
| Runtime    | Node.js 20 (ESM)                    | Nhẹ, non-blocking I/O, tối ưu cho kết nối realtime WebSocket |
| Framework  | Express v4 + Socket.IO v4           | Hỗ trợ HTTP REST APIs và kết nối WebSockets |
| Database   | MongoDB (Mongoose)                  | Dữ liệu dạng tài liệu linh hoạt cho cấu trúc cuộc hội thoại & tin nhắn |
| Cache/PubSub| Redis (ioredis)                    | Lưu trạng thái online (`online:{userId}` TTL 5m) và truyền tin Pub/Sub |
| Adapter    | @socket.io/redis-adapter            | Chia sẻ socket state giữa nhiều instance container |

---

## API Endpoints (REST API)

Tất cả các endpoint REST (ngoại trừ `/health`) đều yêu cầu xác thực JWT. Khi qua API Gateway, Gateway sẽ chuyển tiếp Header `Authorization: Bearer <JWT_TOKEN>` hoặc các header định danh (`x-user-id`, `x-user-name`, `x-user-avatar`).

| Method | Endpoint (qua Gateway `/api`)      | Direct Endpoint (port `5004`)      | Description                                         |
|--------|-----------------------------------|-----------------------------------|-----------------------------------------------------|
| GET    | —                                 | `/health`                         | Health check dịch vụ (Public)                      |
| GET    | `/conversations`                  | `/conversations`                  | Lấy danh sách hội thoại của người dùng đăng nhập    |
| POST   | `/conversations`                  | `/conversations`                  | Tạo mới hoặc lấy cuộc hội thoại 1-1 (`targetUserId`)|
| GET    | `/conversations/:id/messages`     | `/conversations/:id/messages`     | Lấy lịch sử tin nhắn (hỗ trợ `limit`, `before`)     |
| POST   | `/groups`                         | `/groups`                         | Tạo nhóm chat mới (`name`, `memberIds`, `avatarUrl`)|
| GET    | `/groups/:id`                     | `/groups/:id`                     | Lấy thông tin chi tiết nhóm chat                    |
| PUT    | `/groups/:id`                     | `/groups/:id`                     | Cập nhật tên/avatar nhóm (Chỉ Admin nhóm)          |
| POST   | `/groups/:id/members`             | `/groups/:id/members`             | Thêm thành viên vào nhóm (Chỉ Admin nhóm)           |
| DELETE | `/groups/:id/members/:userId`     | `/groups/:id/members/:userId`     | Xóa thành viên khỏi nhóm (Admin hoặc tự rời)        |
| POST   | `/groups/:id/leave`               | `/groups/:id/leave`               | Rời khỏi nhóm chat                                  |

> Tham khảo thêm tài liệu OpenAPI: [`docs/api-specs/chat-service.yaml`](../../docs/api-specs/chat-service.yaml)

---

## Socket.IO Realtime Events

Kết nối WebSocket được thiết lập qua đường dẫn `/socket.io/` với handshake auth:
* Direct: `ws://localhost:5004/socket.io/` với `{ auth: { token: "Bearer <JWT>" } }` hoặc query `token`.
* Gateway: `ws://localhost:8080/socket.io/`

### Client → Server (Sự kiện gửi lên)

* **`conversation:join`**: Tham gia vào room hội thoại cụ thể.
  * Payload: `{ conversationId }`
* **`message:send`**: Gửi tin nhắn mới trong hội thoại.
  * Payload: `{ conversationId, content, type: "text" | "image", mediaId? }`
* **`message:read`**: Báo đã đọc tin nhắn trong hội thoại.
  * Payload: `{ conversationId, messageId }`
* **`typing:start`**: Báo đang soạn thảo tin nhắn.
  * Payload: `{ conversationId }`
* **`typing:stop`**: Báo đã dừng soạn thảo tin nhắn.
  * Payload: `{ conversationId }`
* **`presence:heartbeat`**: Định kỳ gửi để gia hạn TTL trạng thái online trong Redis (mặc định Redis key giữ 5 phút).

### Server → Client (Sự kiện nhận về)

* **`message:received`**: Phát tin nhắn mới đến toàn bộ phòng chat `conv:{conversationId}`.
  * Payload: `{ _id, conversationId, senderId, senderName, senderAvatar, content, type, mediaUrl, readBy, createdAt }`
* **`message:read:ack`**: Phát thông báo xác nhận tin nhắn đã được đối phương đọc.
  * Payload: `{ conversationId, messageId, readBy, readAt }`
* **`typing:indicator`**: Phát trạng thái soạn thảo cho các thành viên khác trong phòng.
  * Payload: `{ conversationId, userId, displayName, isTyping }`
* **`user:online`**: Thông báo người dùng trong cuộc hội thoại đã truy cập online.
  * Payload: `{ userId }`
* **`user:offline`**: Thông báo người dùng trong cuộc hội thoại đã ngắt kết nối (offline).
  * Payload: `{ userId }`
* **`error`**: Trả về thông báo lỗi khi xử lý sự kiện socket thất bại.
  * Payload: `{ message }`

---

## Redis Pub/Sub Events (Published)

Dịch vụ phát hành các sự kiện bất đồng bộ lên Redis Pub/Sub để `notification-service` tiêu thụ (consume) và đẩy thông báo:

1. **Kênh `message.sent`** *(Phát khi người nhận tin nhắn đang offline)*:
   ```json
   {
     "eventId": "uuid",
     "senderId": "string",
     "conversationId": "string",
     "recipientId": "string",
     "preview": "string",
     "occurredAt": "ISO8601 string"
   }
   ```
2. **Kênh `group.member.added`** *(Phát khi có thành viên mới được thêm vào nhóm)*:
   ```json
   {
     "eventId": "uuid",
     "groupId": "string",
     "groupName": "string",
     "addedUserId": "string",
     "addedByUserId": "string",
     "occurredAt": "ISO8601 string"
   }
   ```

---

## Environment Variables

| Variable | Description | Local Fallback | Docker / K8s (Container Network) |
|---|---|---|---|
| `PORT` | Cổng HTTP / Socket.IO server | `5004` | `5000` (hoặc `5004`) |
| `MONGO_URI` | Chuỗi kết nối MongoDB | `mongodb://socialhub:socialhub_secret@localhost:27018/socialhub_chat?authSource=admin` | `mongodb://socialhub:socialhub_secret@mongo:27017/socialhub_chat?authSource=admin` |
| `REDIS_URL` | Chuỗi kết nối Redis Cache & Pub/Sub | `redis://localhost:6379` | `redis://redis:6379` |
| `JWT_SECRET` | Khóa bí mật dùng giải mã Token JWT | `your-jwt-secret-change-in-production` | Được inject qua Secret / `.env` |
| `USER_SERVICE_URL` | URL gọi REST API nội bộ `user-service` | `http://localhost:5001` | `http://user-service:5000` |
| `MEDIA_SERVICE_URL` | URL gọi REST API nội bộ `media-service` | `http://localhost:5005` | `http://media-service:5000` |

---

## Running Locally

### 1. Chạy qua Docker Compose (Khuyên dùng)
```bash
# Từ thư mục gốc của dự án
docker compose up chat-service --build
```

### 2. Chạy Standalone (Local Development)
Yêu cầu đã có MongoDB và Redis chạy trên máy cục bộ (hoặc qua Docker infra).
```bash
# Di chuyển vào thư mục dịch vụ
cd services/chat-service

# Cài đặt dependency & chạy ở chế độ phát triển (nodemon)
npm install
npm run dev
```

---

## Project Structure

```
chat-service/
├── Dockerfile
├── .dockerignore
├── package.json
├── readme.md
└── src/
    ├── app.js                    # Khởi tạo Express app & middlewares
    ├── server.js                 # Điểm khởi chạy HTTP Server + Socket.IO Server
    ├── test-client.js            # Script mô phỏng Socket client để kiểm thử
    ├── config/
    │   ├── index.js              # Đọc & quản lý các biến môi trường
    │   ├── db.js                 # Kết nối MongoDB qua Mongoose
    │   └── redis.js              # Khởi tạo Redis Clients (Cache & Publisher)
    ├── controllers/
    │   ├── conversation.controller.js # Xử lý request HTTP hội thoại
    │   └── group.controller.js        # Xử lý request HTTP nhóm chat
    ├── middleware/
    │   └── auth.js               # Middleware xác thực JWT / Headers từ Gateway
    ├── models/
    │   ├── conversation.model.js # Mongoose Schema: Cuộc hội thoại (1-1 & Group)
    │   ├── group.model.js        # Mongoose Schema: Thông tin nhóm chat
    │   └── message.model.js      # Mongoose Schema: Tin nhắn & trạng thái đã đọc
    ├── routes/
    │   ├── conversation.routes.js # Định tuyến REST API hội thoại
    │   └── group.routes.js        # Định tuyến REST API nhóm chat
    ├── services/
    │   ├── conversation.service.js# Logic nghiệp vụ cuộc hội thoại
    │   ├── group.service.js       # Logic nghiệp vụ nhóm chat
    │   └── message.service.js      # Logic truy vấn lịch sử tin nhắn
    ├── socket/
    │   ├── index.js              # Khởi tạo Socket.IO & đính kèm Redis Adapter
    │   ├── auth.handler.js       # Middleware xác thực Socket handshake JWT
    │   ├── message.handler.js    # Xử lý sự kiện tin nhắn (send, read, join)
    │   ├── presence.handler.js   # Xử lý trạng thái online/offline & heartbeat
    │   └── typing.handler.js     # Xử lý chỉ báo đang soạn tin (typing indicator)
    └── utils/
        ├── api.js                # Helper gọi REST API inter-service (user-service, media-service)
        ├── error.js              # Định nghĩa các lớp Error tuỳ chỉnh (HttpError)
        └── response.js           # Helper chuẩn hoá định dạng HTTP response
```
