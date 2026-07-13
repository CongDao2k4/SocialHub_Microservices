# Chat Service — Messaging

> Bounded Context: Messaging
> Quản lý tin nhắn realtime: hội thoại 1-1, nhóm chat, lịch sử tin nhắn, typing indicator, online presence.

## Overview

- **1-1 messaging & group chat**: Nhắn tin trực tiếp giữa 2 cá nhân và theo nhóm.
- **Realtime via Socket.IO**: Sử dụng Socket.IO v4 kèm Redis Adapter để hỗ trợ mở rộng ngang (horizontal scaling).
- **Message history**: Hỗ trợ phân trang tin nhắn cursor-based pagination thông qua compound index.
- **Realtime features**: Typing indicators (đang soạn tin), read receipts (báo đọc), online presence (trạng thái hoạt động).
- **Redis Pub/Sub**: Phát hành các sự kiện `message.sent` và `group.member.added` để `notification-service` xử lý gửi thông báo đẩy.

## Tech Stack

| Component  | Choice                              | Lý do |
|------------|-------------------------------------|-------|
| Runtime    | Node.js 20 (ESM)                    | Nhẹ, non-blocking I/O, phù hợp realtime chat |
| Framework  | Express v4 + Socket.IO v4           | Hỗ trợ HTTP REST APIs và kết nối WebSocket |
| Database   | MongoDB (Mongoose)                  | Dữ liệu dạng tài liệu cực kỳ linh hoạt cho chat |
| Cache/Pub  | Redis (ioredis)                     | Lưu trạng thái online và truyền tin Pub/Sub nhanh |
| Adapter    | @socket.io/redis-adapter            | Chia sẻ socket state qua nhiều instance container |

## API Endpoints (Gateway Proxied)

Tất cả các route ngoại trừ `/health` đều cần Header `Authorization: Bearer <JWT_TOKEN>` được chuyển tiếp qua API Gateway (cổng `8080`).

| Method | Endpoint (qua Gateway `/api`)      | Direct Endpoint (port `5004`)      | Description                 |
|--------|-----------------------------------|-----------------------------------|-----------------------------|
| GET    | —                                 | `/health`                         | Health check dịch vụ        |
| GET    | `/conversations`                  | `/conversations`                  | Lấy danh sách hội thoại     |
| POST   | `/conversations`                  | `/conversations`                  | Tạo/lấy hội thoại 1-1       |
| GET    | `/conversations/:id/messages`     | `/conversations/:id/messages`     | Lấy lịch sử tin nhắn (cursor)|
| POST   | `/groups`                         | `/groups`                         | Tạo nhóm chat mới           |
| GET    | `/groups/:id`                     | `/groups/:id`                     | Lấy thông tin chi tiết nhóm |
| PUT    | `/groups/:id`                     | `/groups/:id`                     | Cập nhật tên/avatar nhóm    |
| POST   | `/groups/:id/members`             | `/groups/:id/members`             | Thêm thành viên vào nhóm    |
| DELETE | `/groups/:id/members/:userId`     | `/groups/:id/members/:userId`     | Xóa thành viên khỏi nhóm    |
| POST   | `/groups/:id/leave`               | `/groups/:id/leave`               | Rời nhóm chat               |

> Tham khảo chi tiết tại tài liệu OpenAPI: [`docs/api-specs/chat-service.yaml`](../../docs/api-specs/chat-service.yaml)

## Socket.IO Events

Kết nối Client được thiết lập qua API Gateway tại địa chỉ `ws://localhost:8080/socket.io/` sử dụng JWT trong handshake auth `{ token: "Bearer <JWT>" }`.

### Client → Server

- `message:send`: Gửi tin nhắn mới.
  - Payload: `{ conversationId, content, type: "text"|"image", mediaId? }`
- `message:read`: Báo đã đọc tin nhắn.
  - Payload: `{ conversationId, messageId }`
- `typing:start` / `typing:stop`: Trạng thái đang soạn thảo.
  - Payload: `{ conversationId }`
- `presence:heartbeat`: Giữ kết nối online (gửi định kỳ mỗi 3 phút).

### Server → Client

- `message:received`: Nhận tin nhắn mới từ phòng chat.
  - Payload: `{ id, conversationId, senderId, senderName, senderAvatar, content, type, mediaUrl, createdAt }`
- `message:read:ack`: Xác nhận tin nhắn đã được đối phương đọc.
  - Payload: `{ conversationId, messageId, readBy, readAt }`
- `typing:indicator`: Hiển thị trạng thái đang soạn tin của người khác.
  - Payload: `{ conversationId, userId, displayName, isTyping }`
- `user:online` / `user:offline`: Thông báo bạn chat thay đổi trạng thái hoạt động.
  - Payload: `{ userId }`

## Redis Pub/Sub Events

Khi người nhận offline, hệ thống sẽ phát các sự kiện sau lên Redis Pub/Sub để notify:

1.  **Kênh `message.sent`**:
    - Payload: `{ eventId, senderId, conversationId, recipientId, preview, occurredAt }`
2.  **Kênh `group.member.added`**:
    - Payload: `{ eventId, groupId, groupName, addedUserId, addedByUserId, occurredAt }`

## Running Locally

### Chạy qua Docker (Khuyên dùng)
```bash
# Chạy từ thư mục gốc của dự án
docker compose up chat-service --build
```

### Chạy Standalone (Phục vụ phát triển)
Cần có sẵn MongoDB và Redis chạy ở localhost.
```bash
# Di chuyển vào thư mục chat-service
cd services/chat-service

# Cài đặt dependency & chạy ở chế độ dev (nodemon)
npm install
npm run dev
```

## Project Structure

```
chat-service/
├── Dockerfile
├── .dockerignore
├── package.json
├── plan.md
├── readme.md
└── src/
    ├── server.js                 # Điểm khởi chạy HTTP + Socket.IO Server
    ├── app.js                    # Khởi tạo Express app và middlewares
    ├── config/
    │   ├── index.js              # Quản lý các biến môi trường
    │   ├── db.js                 # Kết nối MongoDB (Mongoose)
    │   └── redis.js              # Khởi tạo Redis clients
    ├── models/
    │   ├── conversation.model.js # Schema cuộc hội thoại
    │   ├── message.model.js      # Schema tin nhắn & read receipts
    │   └── group.model.js        # Schema nhóm chat
    ├── services/                 # Xử lý nghiệp vụ chính (Business Logic)
    ├── controllers/              # Điều phối request REST HTTP
    ├── routes/                   # Khai báo các endpoints REST
    ├── socket/                   # Quản lý WebSockets và realtime events
    ├── middleware/               # Middleware xác thực JWT
    └── utils/                    # Thư viện dùng chung (API call, Error, Response)
```

## Environment Variables

| Variable           | Description                       | Default                           |
|--------------------|-----------------------------------|-----------------------------------|
| `PORT`             | Cổng chạy service bên trong       | `5000`                            |
| `MONGO_URI`        | Chuỗi kết nối MongoDB             | `mongodb://mongo:27017/socialhub_chat` |
| `REDIS_URL`        | Chuỗi kết nối Redis               | `redis://redis:6379`              |
| `JWT_SECRET`       | Khóa bí mật giải mã JWT token     | —                                 |
| `USER_SERVICE_URL` | URL gọi nội bộ user-service       | `http://user-service:5000`        |
| `MEDIA_SERVICE_URL`| URL gọi nội bộ media-service      | `http://media-service:5000`       |

## Logging & Caching Behavior
- **HTTP Request Logger**: All incoming API requests are logged to the console using a lightweight middleware printing the format `[HTTP] METHOD PATH STATUS - TIMEms`.
- **Socket.IO Logging**: WebSockets connection and action events (such as `message:send`, `message:read`, `typing:start`, and room joining) are logged in real-time.
- **Cache-Control & ETags**: ETags are disabled (`app.set('etag', false)`) and response headers are set to `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` to prevent browser caching of dynamic message history.
- **Message Notification Alerts**: The publishing of `message.sent` events to Redis/RabbitMQ is disabled to prevent intrusive alert toasts during chat sessions, relying instead on dynamic unread status dot markers.
