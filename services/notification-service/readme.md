# Notification Service — SocialHub

> **Notification Service** chịu trách nhiệm thu nhận, lưu trữ thông báo và đẩy thông báo thời gian thực (realtime push) cho người dùng qua WebSockets (Socket.IO). 
> Dịch vụ hoạt động theo mô hình hướng sự kiện (Event-driven Architecture), phối hợp giữa **Redis Pub/Sub** và **RabbitMQ** để đảm bảo tính bền vững (durability) và tính mở rộng.

---

## 📋 1. Kiến Trúc Hoạt Động (Architecture & Event Flow)

Quy trình xử lý sự kiện thông báo được mô tả qua sơ đồ dưới đây:

```
[Các Dịch Vụ Khác] 
   │ (Ví dụ: friend-service, post-service, chat-service)
   ├─► Phát sự kiện thô lên kênh Redis Pub/Sub tương ứng (VD: 'post.liked', 'message.sent')
   │
   ▼
[Event Bridge (Redis Subscriber)] ──── (Trong Notification Service)
   │ 
   ├─► Nhận sự kiện thô từ Redis Pub/Sub.
   ├─► Đóng gói dữ liệu thành Envelope JSON chuẩn hóa.
   ├─► Đưa vào hàng đợi RabbitMQ bền vững: 'notifications-queue'
   │
   ▼
[RabbitMQ Broker Container] (Port 5672) ─ Hàng đợi bền vững lưu trữ sự kiện tạm thời.
   │
   ▼
[MQ Consumer Worker] ─────────────────── (Trong Notification Service)
   │
   ├─► Nhận sự kiện từ hàng đợi 'notifications-queue'.
   ├─► Gọi REST API tới user-service (POST /api/users/batch) lấy thông tin Actor (displayName, avatarUrl).
   ├─► Lưu trữ dữ liệu thông báo hoàn chỉnh vào MongoDB.
   ├─► Cập nhật và đẩy thông tin Socket.IO:
   │     ├─ Emits 'notification:new' tới Room `user:{userId}` (nếu người nhận online).
   │     └─ Emits 'notification:count' cập nhật số lượng tin chưa đọc.
   │
   ▼
[Socket.IO Client (Browser)]
```

### Các Kênh Sự Kiện Được Hỗ Trợ (Event Types)

| Nguồn Sự Kiện | Kênh Redis | Kiểu Thông Báo (Mongo) | Mô Tả Nội Dung |
|---|---|---|---|
| **friend-service** | `friend.request.sent` | `friend_request` | `<Actor> đã gửi lời mời kết bạn.` |
| **friend-service** | `friend.request.accepted` | `friend_accepted` | `<Actor> đã chấp nhận lời mời kết bạn.` |
| **post-service** | `post.liked` | `post_liked` | `<Actor> đã thích bài viết của bạn.` |
| **post-service** | `post.commented` | `post_commented` | `<Actor> đã bình luận bài viết của bạn.` |
| **post-service** | `post.shared` | `post_shared` | `<Actor> đã chia sẻ bài viết của bạn.` |
| **chat-service** | `message.sent` | `new_message` | `<Actor> đã gửi tin nhắn: "<preview>"` |
| **chat-service** | `group.member.added` | `group_added` | `<Actor> đã thêm bạn vào nhóm "<groupName>".` |

---

## 🔌 2. Kết Nối WebSockets Qua Gateway

Client thiết lập kết nối thời gian thực qua Gateway:
- **Địa chỉ**: `ws://localhost:8080`
- **Đường dẫn (Path)**: `/notification/socket.io/` (Gateway sẽ tự động map và loại bỏ tiền tố này khi chuyển tiếp tới `notification-service` ở cổng `5006`).
- **Handshake Auth**: `{ "token": "Bearer <JWT-Access-Token>" }`
- **Sự kiện lắng nghe (Listening Events)**:
  - `notification:new`: Nhận object thông báo đầy đủ khi có sự kiện mới.
  - `notification:count`: Nhận số lượng thông báo chưa đọc cập nhật dạng `{ unreadCount: N }`.

---

## 📖 3. Chi Tiết REST API Của Notification Service

Mọi endpoint dưới đây đều được bảo vệ bởi middleware xác thực, yêu cầu truyền header:
`Authorization: Bearer <JWT_ACCESS_TOKEN>`

### 🔹 1. Lấy danh sách thông báo
* **Endpoint**: `GET /notifications`
* **Query Parameters**:
  * `page` (number, default: 1): Trang hiển thị.
  * `limit` (number, default: 20): Số lượng thông báo mỗi trang.
  * `unreadOnly` (boolean, default: false): Nếu là `true`, chỉ trả về thông báo chưa đọc (`isRead = false`).
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "notifications": [
      {
        "_id": "6a50a334ca987853088f8456",
        "userId": "548b7bbe-7486-44cb-831d-91b400922c20",
        "type": "friend_request",
        "message": "Nguyen Van A đã gửi lời mời kết bạn.",
        "fromUser": {
          "id": "3b146f22-d116-4bb7-9db1-89b2e4c3d3ab",
          "displayName": "Nguyen Van A",
          "avatarUrl": null
        },
        "referenceId": "6ea301e3-376c-4174-9267-b63991610868",
        "referenceType": "friend_request",
        "isRead": false,
        "createdAt": "2026-07-10T07:45:56.907Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
  ```

### 🔹 2. Lấy số lượng thông báo chưa đọc
* **Endpoint**: `GET /notifications/unread-count`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "unreadCount": 1
  }
  ```

### 🔹 3. Đánh dấu một thông báo đã đọc
* **Endpoint**: `PUT /notifications/:id/read`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Notification marked as read"
  }
  ```

### 🔹 4. Đánh dấu đọc toàn bộ thông báo
* **Endpoint**: `PUT /notifications/read-all`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "All notifications marked as read"
  }
  ```

---

## 📊 4. Hướng Dẫn Giám Sát Qua Giao Diện Quản Trị RabbitMQ

Khi docker infrastructure đang chạy (`docker compose up -d`), bạn có thể giám sát toàn bộ hoạt động xếp hàng đợi của thông báo trực tiếp qua RabbitMQ Management Console.

### Cách Truy Cập:
- **Đường dẫn**: [http://localhost:15672](http://localhost:15672)
- **Tài khoản mặc định**: 
  - *Username*: `socialhub`
  - *Password*: `socialhub_secret`

### Các Điểm Giám Sát Quan Trọng (Observation Guides):

#### 1. Theo Dõi Hàng Đợi (Queues):
- Truy cập tab **Queues and Streams** từ menu trên cùng.
- Bạn sẽ nhìn thấy hàng đợi tên là **`notifications-queue`**.
- Các thông số cần quan tâm:
  - **State**: Trạng thái hàng đợi (thường là `running`).
  - **Ready**: Số lượng thông điệp đang nằm trong hàng đợi chờ được Consumer xử lý.
  - **Unacked**: Số lượng thông điệp đã gửi cho consumer nhưng chưa nhận được phản hồi xác nhận (`ack`).
  - **Total**: Tổng số lượng thông điệp trong queue.

#### 2. Biểu Đồ Tốc Độ Xử Lý (Message Rates):
- Click trực tiếp vào hàng đợi `notifications-queue` để xem chi tiết.
- Bạn sẽ thấy biểu đồ thời gian thực hiển thị **Publish rate** (tốc độ đẩy sự kiện vào hàng đợi) và **Acknowledge rate** (tốc độ xử lý thành công).

#### 3. Test Đẩy Tin Thủ Công (Publish Message):
- Bạn có thể mô phỏng một sự kiện trực tiếp trên giao diện quản trị để test dịch vụ:
  - Cuộn xuống phần **Publish message**.
  - Phần **Payload**, nhập dữ liệu JSON mô phỏng (ví dụ về sự kiện thích bài viết):
    ```json
    {
      "channel": "post.liked",
      "payload": {
        "userId": "d748f655-46b5-4b02-aa92-3bc374828b8b",
        "postId": "postId-123-abc",
        "postAuthorId": "<your-user-uuid-currently-online>"
      },
      "bridgedAt": "2026-07-10T12:00:00.000Z"
    }
    ```
  - Click **Publish message**. Notification Service sẽ nhận được ngay lập tức, ghi nhận vào MongoDB và bắn Socket.IO realtime báo động.

---

## ⚙️ Biến Môi Trường (Environment Variables)

Các biến cấu hình khai báo trong file `.env` của Notification Service:

| Biến Môi Trường | Mô Tả | Giá Trị Mặc Định |
|---|---|---|
| `PORT` | Cổng HTTP Server của Notification Service | `5006` |
| `MONGO_URI` | Chuỗi kết nối cơ sở dữ liệu MongoDB | `mongodb://socialhub:socialhub_secret@localhost:27018/socialhub_notification?authSource=admin` |
| `REDIS_URL` | Link kết nối Redis Server để subscribe sự kiện | `redis://localhost:6379` |
| `RABBITMQ_URL` | Địa chỉ kết nối RabbitMQ Broker | `amqp://socialhub:socialhub_secret@localhost:5672` |
| `JWT_SECRET` | Secret key chung dùng để giải mã JWT | `your-jwt-secret-change-in-production` |
| `USER_SERVICE_URL` | Địa chỉ user-service dùng để gọi batch lấy thông tin user | `http://localhost:5001` |

---

## 📁 Cấu Trúc Thư Mục (Directory Structure)

```
notification-service/
├── package.json
├── readme.md
├── src/
│   ├── server.js            # Điểm chạy dịch vụ chính, kết nối Mongo, Redis, RabbitMQ & khởi tạo Sockets
│   ├── config/
│   │   ├── index.js         # Khai báo cấu hình từ biến môi trường
│   │   ├── db.js            # Hàm kết nối MongoDB Mongoose
│   │   └── redis.js         # Khởi tạo ioredis subscriber
│   ├── controllers/
│   │   └── notification.controller.js  # API điều khiển hiển thị & cập nhật trạng thái đọc thông báo
│   ├── middleware/
│   │   └── auth.js          # Xác thực token JWT
│   ├── models/
│   │   └── notification.model.js       # Định nghĩa Schema & Enums MongoDB Mongoose
│   ├── routes/
│   │   └── notification.routes.js     # Khai báo các endpoints REST API
│   └── services/
│       ├── event-bridge.service.js     # Đọc từ Redis Pub/Sub và viết vào RabbitMQ
│       └── rabbitmq.consumer.js        # Worker tiêu thụ hàng đợi RabbitMQ, lưu DB & emit Socket
```

---

## 🚀 Hướng Dẫn Khởi Chạy Cục Bộ

1. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
2. Chạy dịch vụ trong môi trường development (sử dụng nodemon):
   ```bash
   npm run dev
   ```

---

## Logging & Caching Behavior
- **HTTP Request Logger**: All incoming API requests are logged to the console using a lightweight middleware printing the format `[HTTP] METHOD PATH STATUS - TIMEms`.
- **Cache-Control & ETags**: ETags are disabled (`app.set('etag', false)`) and response headers are set to `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` to prevent browser caching of dynamic notifications and unread counts, forcing fresh loads on every call.
- **RabbitMQ Consumer Resilience**: Requeuing infinite loop fixes are applied to prevent process lockups in the event of payload processing exceptions.
