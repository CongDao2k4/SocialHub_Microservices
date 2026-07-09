# API Gateway — SocialHub

> **API Gateway** — Cửa ngõ duy nhất (Single Entry Point) cho toàn bộ client requests của hệ thống SocialHub. 
> Chịu trách nhiệm bảo mật, định tuyến động (routing), giới hạn lượt gọi (rate limiting), chống lỗi tràn (circuit breaking) và ủy nhiệm kết nối Socket.IO (WebSocket Proxy).

---

## 📋 Tổng Quan (Overview)

`gateway` được phát triển bằng **Node.js (Express)** đóng vai trò như một Reverse Proxy và Gateway trung tâm điều khiển lưu lượng:

- **Định tuyến (Routing)**: Phân phối request từ client tới các service tương ứng (`user`, `friend`, `post`, `media`, `notification`) dựa trên URL prefix.
- **Xác thực JWT Tập Trung (JWT Validation)**: Tự động trích xuất và verify access token JWT sử dụng secret key chung và kiểm tra blacklist token trong Redis.
- **Header Injection**: Sau khi xác thực thành công, Gateway sẽ tự động inject `x-user-id` và `x-user-jti` vào header của request trước khi forward đi, giúp các downstream service tin tưởng thông tin định danh mà không cần decode lại.
- **Giới hạn lượt gọi (Rate Limiting)**: Sử dụng Redis sliding window counter (`ratelimit:{ip}:{endpoint}`) để giới hạn tối đa 100 requests/phút cho mỗi IP nhằm chống tấn công spam/DDoS.
- **Fault Tolerance (Circuit Breakers)**: Tách biệt Circuit Breaker cho từng downstream service bằng thư viện **Opossum**. Khi một service gặp sự cố hoặc timeout, Gateway sẽ tự động ngắt mạch (trip) và trả về phản hồi fallback thân thiện (`503 Service Unavailable`) ngay lập tức thay vì chờ đợi timeout gây nghẽn hệ thống.
- **WebSocket Reverse Proxy**: Ủy quyền nâng cấp giao thức (HTTP Upgrade) cho Socket.IO để kết nối truyền thông tin realtime từ Gateway thẳng tới `notification-service` mà không thông qua cơ chế Express HTTP truyền thống.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ lựa chọn |
|---|---|
| Language | Node.js 20 Slim (ES Modules) |
| Framework | Express v5 |
| HTTP Client | Axios (Raw request streaming) |
| Fault Tolerance | Opossum (Circuit Breaker) |
| Cache/Blacklist | Redis (via ioredis) |
| Port | `8080` (host) / `8000` (internal) |

---

## 🗺️ Routing & Security Matrix

Client kết nối qua Gateway bằng cổng `8080` trên host với URL bắt đầu bằng `/api`:

| Gateway Route | Downstream Service | Downstream Route | Auth Required? | Action on Auth Success / Rewrite |
|---|---|---|---|---|
| `GET /health` | *Gateway Local* | — | ❌ No | Trả về trạng thái Gateway |
| `POST /api/auth/register` | `user-service` | `/api/auth/register` | ❌ No | Forward request trực tiếp |
| `POST /api/auth/login` | `user-service` | `/api/auth/login` | ❌ No | Forward request trực tiếp |
| `POST /api/auth/refresh` | `user-service` | `/api/auth/refresh` | ❌ No | Forward request trực tiếp |
| `POST /api/auth/logout` | `user-service` | `/api/auth/logout` | ✅ Yes (JWT) | Forward kèm Bearer Token để blacklist |
| `GET /api/users/search` | `user-service` | `/api/users/search` | ✅ Yes (JWT) | Inject `x-user-id` & forward |
| `GET /api/users/:id` | `user-service` | `/api/users/:id` | ✅ Yes (JWT) | Inject `x-user-id` & forward |
| `PUT /api/users/:id` | `user-service` | `/api/users/:id` | ✅ Yes (JWT) | Inject `x-user-id` & forward |
| `POST /api/friends/**` | `friend-service` | `/api/friends/**` | ✅ Yes (JWT) | Giữ nguyên tiền tố `/api/friends`, inject `x-user-id` & forward |
| `POST /api/posts/**` | `post-service` | `/posts/**` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `GET /api/feed` | `post-service` | `/feed` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `POST /api/media/upload`| `media-service` | `/media/upload` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & stream proxy |
| `GET /api/media/:id` | `media-service` | `/media/:id` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `GET /api/media/:id/url`| `media-service` | `/media/:id/url` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `DELETE /api/media/:id` | `media-service` | `/media/:id` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `GET /api/notifications/**`| `notification-service` | `/notifications/**`| ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |

---

## ⚡ WebSocket Proxying (Socket.IO Connection)

Để hỗ trợ tính năng thông báo thời gian thực, Gateway được trang bị cơ chế bắt sự kiện `upgrade` của Node.js HTTP Server. 

Khi client gửi bắt tay nâng cấp giao thức WebSocket tới `ws://localhost:8080/socket.io/...`, Gateway sẽ:
1. Nhận dạng URL bắt đầu bằng `/socket.io/`.
2. Tạo một HTTP request thô gửi tới `notification-service` (`http://localhost:5006/socket.io/...`) kèm toàn bộ headers.
3. Khi nhận được phản hồi `101 Switching Protocols` từ dịch vụ thông báo, nó sẽ viết mã trạng thái trở lại cho Client socket và trực tiếp bắc cầu dữ liệu (TCP piping) thông qua:
   ```javascript
   proxySocket.pipe(socket).pipe(proxySocket);
   ```
Cơ chế này hoàn toàn độc lập với Express middlewares, đạt hiệu năng xử lý cực cao và không cần cài thêm thư viện proxy bên ngoài.

---

## 🛡️ Circuit Breaker & Fallback

Gateway bảo vệ hệ thống khỏi sập dây chuyền (Cascading Failures) bằng cách bọc các request downstream trong các Circuit Breaker riêng biệt:

- **Giới hạn Timeout**: Mặc định 5 giây. Nếu service không phản hồi, coi như lỗi.
- **Tỷ lệ lỗi tối đa**: Mặc định 50%. Nếu quá nửa số request bị lỗi (mã >= 500 hoặc timeout) trong cửa sổ giám sát, mạch sẽ chuyển sang **OPEN**.
- **Thời gian giữ mạch mở**: Mặc định 10 giây. Sau thời gian này, mạch chuyển sang **HALF-OPEN** để thử nghiệm một số request. Nếu thành công, mạch sẽ **CLOSE** trở lại.
- **Phản hồi Fallback**: Khi mạch mở (OPEN), mọi request gửi tới service đó sẽ bị chặn ngay tại Gateway và trả về lỗi `503 Service Unavailable`:
  ```json
  {
    "success": false,
    "error": "Service Temporarily Unavailable",
    "message": "The <service-name> is currently unavailable or experiencing high failure rates. Please try again later."
  }
  ```

---

## 📁 Cấu Trúc Thư Mục

```
gateway/
├── Dockerfile
├── package.json
├── readme.md
├── src/
│   ├── app.js               # Khởi tạo Express, Morgan, Helmet, Rate Limiter
│   ├── server.js            # Node HTTP server, WebSocket proxy, Graceful Shutdown
│   ├── config/
│   │   └── index.js         # Đọc và parse cấu hình từ biến môi trường
│   │   └── redis.js         # Khởi tạo ioredis client
│   ├── middlewares/
│   │   ├── auth.middleware.js          # Xác thực JWT, Blacklist Redis, Inject Headers
│   │   └── rate-limiter.middleware.js  # Middleware giới hạn request bằng Redis
│   └── services/
│       └── http-client.service.js      # Opossum Circuit Breakers & Axios stream forwarding
└── tests/
    ├── integration.test.js      # Test toàn bộ luồng REST API qua Gateway
    ├── test-notifications.js    # Test đẩy tin nhắn thông qua WebSocket proxy & RabbitMQ
    └── test-circuit-breaker.js  # Test trạng thái ngắt mạch của Gateway
```

---

## ⚙️ Biến Môi Trường (Environment Variables)

Các biến cấu hình khai báo trong file `.env` của Gateway:

| Biến môi trường | Mô tả | Giá trị mặc định |
|---|---|---|
| `PORT` | Cổng HTTP Server của Gateway lắng nghe | `8080` |
| `USER_SERVICE_URL` | Địa chỉ user-service trên máy host | `http://localhost:5001` |
| `FRIEND_SERVICE_URL` | Địa chỉ friend-service trên máy host | `http://localhost:5002` |
| `POST_SERVICE_URL` | Địa chỉ post-service trên máy host | `http://localhost:5003` |
| `MEDIA_SERVICE_URL` | Địa chỉ media-service trên máy host | `http://localhost:5005` |
| `NOTIFICATION_SERVICE_URL`| Địa chỉ notification-service trên máy host | `http://localhost:5006` |
| `JWT_SECRET` | Secret key chung dùng để giải mã JWT | `your-jwt-secret-change-in-production` |
| `REDIS_URL` | Link kết nối Redis Server | `redis://localhost:6379` |
| `CIRCUIT_BREAKER_TIMEOUT` | Thời gian chờ tối đa downstream phản hồi (ms) | `5000` |
| `CIRCUIT_BREAKER_ERROR_THRESHOLD` | Tỷ lệ phần trăm request lỗi để mở mạch (%) | `50` |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | Thời gian giữ trạng thái OPEN trước khi chuyển HALF-OPEN (ms)| `10000` |

---

## 🚀 Hướng Dẫn Chạy Local & Chạy Test

### 1. Khởi chạy
```bash
# Di chuyển vào thư mục gateway và cài thư viện
cd gateway
npm install

# Khởi chạy môi trường development
npm run dev
```

### 2. Chạy kịch bản test tích hợp
Đảm bảo tất cả 5 downstream microservices và cơ sở hạ tầng đã được bật:
```bash
# Chạy bộ test tính năng cơ bản (Auth, User, Media)
node tests/integration.test.js

# Chạy bộ test realtime đẩy thông báo qua WebSocket
node tests/test-notifications.js

# Chạy bộ test ngắt mạch Circuit Breaker
node tests/test-circuit-breaker.js
```
