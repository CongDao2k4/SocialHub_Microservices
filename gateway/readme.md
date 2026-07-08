# API Gateway — SocialHub

> **API Gateway** — Cửa ngõ duy nhất (Single Entry Point) cho toàn bộ client requests của hệ thống SocialHub. 
> Chịu trách nhiệm bảo mật, định tuyến động (routing), giới hạn lượt gọi (rate limiting) và chống lỗi tràn (circuit breaking).

---

## Overview

`gateway` được phát triển bằng **Node.js (Express)** đóng vai trò như một Reverse Proxy và Gateway trung tâm:

- **Định tuyến (Routing)**: Phân phối request từ client tới các service tương ứng (`user-service` và `media-service`) dựa trên URL prefix.
- **Xác thực JWT (JWT Validation)**: Tự động trích xuất và verify access token JWT sử dụng secret key chung và kiểm tra blacklist token trong Redis.
- **Header Injection**: Sau khi xác thực thành công, Gateway sẽ tự động inject `x-user-id` và `x-user-jti` vào header của request trước khi forward đi, giúp các downstream service tin tưởng thông tin định danh mà không cần decode lại.
- **Giới hạn lượt gọi (Rate Limiting)**: Sử dụng Redis sliding window counter (`ratelimit:{ip}:{endpoint}`) để giới hạn tối đa 100 requests/phút cho mỗi IP nhằm chống tấn công spam/DDoS.
- **Circuit Breaker (Opossum)**: Tách biệt Circuit Breaker cho từng downstream service. Khi một service gặp sự cố hoặc timeout, Gateway sẽ tự động ngắt mạch (trip) và trả về phản hồi fallback thân thiện (`503 Service Unavailable`) ngay lập tức thay vì chờ đợi timeout gây nghẽn hệ thống.

---

## Tech Stack

| Component  | Choice                          |
|------------|---------------------------------|
| Language   | Node.js 20 Slim (ES Modules)    |
| Framework  | Express v5                      |
| HTTP Client| Axios (Raw request streaming)   |
| Breaker    | Opossum (Circuit Breaker)       |
| Cache/DB   | Redis (via ioredis)             |
| Port       | `8000` (internal) / `8080` (host) |

---

## Routing & Security Matrix

Client kết nối qua Gateway bằng cổng `8080` trên host với URL bắt đầu bằng `/api`:

| Gateway Route | Downstream Service | Downstream Route | Auth Required? | Action on Auth Success |
|---|---|---|---|---|
| `GET /health` | *Gateway Local* | — | ❌ No | Trả về trạng thái Gateway |
| `POST /api/auth/register` | `user-service` | `/api/auth/register` | ❌ No | Forward request trực tiếp |
| `POST /api/auth/login` | `user-service` | `/api/auth/login` | ❌ No | Forward request trực tiếp |
| `POST /api/auth/refresh` | `user-service` | `/api/auth/refresh` | ❌ No | Forward request trực tiếp |
| `POST /api/auth/logout` | `user-service` | `/api/auth/logout` | ✅ Yes (JWT) | Forward kèm Bearer Token để blacklist |
| `GET /api/users/search` | `user-service` | `/api/users/search` | ✅ Yes (JWT) | Inject `x-user-id` & forward |
| `GET /api/users/:id` | `user-service` | `/api/users/:id` | ✅ Yes (JWT) | Inject `x-user-id` & forward |
| `PUT /api/users/:id` | `user-service` | `/api/users/:id` | ✅ Yes (JWT) | Inject `x-user-id` & forward |
| `POST /api/media/upload`| `media-service` | `/media/upload` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & stream |
| `POST /api/media/batch-urls`| `media-service` | `/media/batch-urls`| ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `GET /api/media/:id` | `media-service` | `/media/:id` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `GET /api/media/:id/url`| `media-service` | `/media/:id/url` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |
| `DELETE /api/media/:id` | `media-service` | `/media/:id` | ✅ Yes (JWT) | Strip `/api`, inject `x-user-id` & forward |

---

## Circuit Breaker & Fallback

Gateway cấu hình Circuit Breaker độc lập cho từng dịch vụ để tăng khả năng chống chịu lỗi (Fault Tolerance):

- Nếu một dịch vụ phản hồi chậm hơn 5 giây hoặc tỷ lệ lỗi (5xx, timeouts) vượt quá 50%, Circuit Breaker sẽ mở (**OPEN**).
- Khi ở trạng thái **OPEN**, mọi request đến dịch vụ này sẽ bị chặn ngay tại Gateway và nhận phản hồi fallback dưới dạng:
  ```json
  {
    "success": false,
    "error": "Service Temporarily Unavailable",
    "message": "The media-service is currently unavailable or experiencing high failure rates. Please try again later."
  }
  ```
- Sau thời gian 10 giây (resetTimeout), mạch sẽ chuyển sang **HALF-OPEN** để thử nghiệm một số request. Nếu thành công, mạch sẽ đóng lại (**CLOSED**) hoạt động bình thường. Nếu tiếp tục lỗi, mạch lại mở ra (**OPEN**).

---

## Project Structure

```
gateway/
├── Dockerfile
├── package.json
├── readme.md
└── src/
    ├── app.js               # Khởi tạo Express, Helmet, CORS, Rate Limiter
    ├── server.js            # Entrypoint - Kết nối Redis, khởi động server & graceful shutdown
    ├── config/
    │   └── index.js         # Load và parse các biến môi trường
    │   └── redis.js         # Khởi tạo client kết nối Redis (ioredis)
    ├── middlewares/
    │   ├── auth.middleware.js          # Xác thực JWT token & kiểm tra Redis blacklist
    │   └── rate-limiter.middleware.js  # Middleware giới hạn request bằng Redis
    └── services/
        └── http-client.service.js      # Opossum Circuit Breakers & Axios stream forwarding
```

---

## Environment Variables

Các biến môi trường được khai báo trong file `.env` ở thư mục root và load tự động vào Gateway:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port lắng nghe nội bộ của Gateway | `8000` |
| `USER_SERVICE_URL` | Địa chỉ internal của User Service | `http://user-service:5000` |
| `MEDIA_SERVICE_URL` | Địa chỉ internal của Media Service | `http://media-service:5000` |
| `JWT_SECRET` | Secret key dùng để verify chữ ký JWT | `your-jwt-secret-change-in-production` |
| `REDIS_URL` | URL kết nối tới Redis cache | `redis://redis:6379` |
| `CIRCUIT_BREAKER_TIMEOUT` | Thời gian tối đa chờ phản hồi trước khi tính là lỗi (ms) | `5000` |
| `CIRCUIT_BREAKER_ERROR_THRESHOLD` | Tỷ lệ phần trăm request lỗi để mở mạch (%) | `50` |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | Thời gian giữ trạng thái OPEN trước khi chuyển HALF-OPEN (ms)| `10000` |

---

## Running & Testing

### 1. Khởi động (Docker Compose)
Khởi động hệ thống đã cấu hình Gateway (cổng `8080` trên host):
```bash
# Từ thư mục root của dự án
docker compose up --build gateway
```

### 2. Chạy Integration Tests
Chúng tôi đã cung cấp sẵn các kịch bản kiểm thử tích hợp (integration tests) trực tiếp từ máy host:
```bash
# Cài đặt thư viện test tại thư mục gateway
cd gateway
npm install

# Test toàn bộ luồng Routing, Auth, Media upload, Blacklist token
node tests/integration.test.js

# Test chức năng Circuit Breaker khi tắt media-service
# (Dừng media-service trước: docker compose stop media-service)
node tests/test-circuit-breaker.js
```
