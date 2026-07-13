# Post Service — Content Management

> Bounded Context: Post & Feed Management
> Dịch vụ quản lý nội dung bài viết, bảng tin (newsfeed), tương tác lượt thích (like), bình luận (comment) và chia sẻ (share).

## Overview

- **Business Domain**: Quản lý bài viết (Posts), Newsfeed, Lượt thích (Likes), Bình luận (Comments) và Chia sẻ bài viết (Shares).
- **Data Owned**: Nội dung bài viết, cài đặt quyền riêng tư (visibility), đếm tương tác (like_count, comment_count, share_count), danh sách likes và bình luận.
- **Operations Exposed**: 
  - Tạo, đọc, cập nhật, xóa bài viết.
  - Thích (Like) và Bỏ thích (Unlike) bài viết.
  - Lấy danh sách bình luận, tạo bình luận mới và xóa bình luận.
  - Chia sẻ bài viết (Share post).
  - Tạo bảng tin cá nhân/toàn cục (Newsfeed) với hỗ trợ phân trang Cursor-based & Offset-based.
- **Inter-service Communication & Caching**:
  - Tích hợp với `user-service` để truy vấn thông tin tác giả bài viết, tự động cache profile người dùng vào Redis (`user:{userId}`) với thời gian sống (TTL) 30 phút.
  - Tích hợp với `media-service` để xác thực danh sách `mediaIds` đính kèm bài viết.
  - Phát hành các sự kiện Redis Pub/Sub (`post.liked`, `post.commented`, `post.shared`) để `notification-service` xử lý gửi thông báo.

---

## Tech Stack

| Component  | Choice             | Lý do |
|------------|--------------------|-------|
| Runtime    | Node.js (ESM)      | Non-blocking I/O, hiệu năng cao cho REST APIs |
| Framework  | Express.js v4      | Xây dựng RESTful API router linh hoạt |
| Database   | PostgreSQL         | Lưu trữ dữ liệu quan hệ có cấu trúc bền vững (ACID) |
| ORM        | Prisma ORM (v5)    | Quản lý Schema, Migration và truy vấn cơ sở dữ liệu an toàn kiểu dữ liệu (Type-safe) |
| Cache/PubSub| Redis (ioredis)   | Caching thông tin người dùng & phát hành sự kiện Pub/Sub bất đồng bộ |

---

## Database Models (Prisma Schema)

Dịch vụ sử dụng PostgreSQL thông qua Prisma ORM ([`prisma/schema.prisma`](prisma/schema.prisma)):

* **`Post`**: Bài viết (gồm tác giả `author_id`, `content`, mảng `media_ids`, `visibility`, flags bài chia sẻ `is_shared`, `original_post_id`, cùng các bộ đếm `like_count`, `comment_count`, `share_count`).
* **`Like`**: Lưu trữ tương tác thích bài viết (Ràng buộc duy nhất Unique `[post_id, user_id]`).
* **`Comment`**: Bình luận bài viết (`post_id`, `author_id`, `content`).

---

## API Endpoints (REST API)

Tất cả các endpoint ngoại trừ `/health` đều yêu cầu xác thực JWT. Gateway sẽ chuyển tiếp Header `Authorization: Bearer <JWT_TOKEN>` hoặc `x-user-id`.

| Method | Endpoint (qua Gateway `/api`)           | Direct Endpoint (port `5000`)           | Description                                                        |
|--------|----------------------------------------|----------------------------------------|--------------------------------------------------------------------|
| GET    | —                                      | `/health`                              | Health check dịch vụ (Public)                                     |
| POST   | `/posts`                               | `/posts`                               | Tạo bài viết mới (`content`, `mediaIds`, `visibility`)             |
| GET    | `/posts/:id`                           | `/posts/:id`                           | Lấy thông tin bài viết theo ID (kèm thông tin tác giả & isLiked)   |
| PUT    | `/posts/:id`                           | `/posts/:id`                           | Cập nhật bài viết (Chỉ tác giả)                                    |
| DELETE | `/posts/:id`                           | `/posts/:id`                           | Xóa bài viết (Chỉ tác giả)                                         |
| GET    | `/posts/user/:userId`                  | `/posts/user/:userId`                  | Lấy danh sách bài viết của một người dùng (Phân trang `page`, `limit`)|
| GET    | `/feed`                                | `/feed`                                | Lấy Bảng tin Newsfeed (Hỗ trợ Cursor `cursor` hoặc `page`, `limit`)|
| POST   | `/posts/:id/like`                      | `/posts/:id/like`                      | Thích bài viết                                                     |
| DELETE | `/posts/:id/like`                      | `/posts/:id/like`                      | Bỏ thích bài viết                                                  |
| GET    | `/posts/:id/comments`                  | `/posts/:id/comments`                  | Lấy danh sách bình luận của bài viết (Phân trang `page`, `limit`)  |
| POST   | `/posts/:id/comments`                  | `/posts/:id/comments`                  | Tạo bình luận mới trên bài viết (`content`)                        |
| DELETE | `/posts/:postId/comments/:commentId`   | `/posts/:postId/comments/:commentId`   | Xóa bình luận (Tác giả bình luận hoặc tác giả bài viết)           |
| POST   | `/posts/:id/share`                     | `/posts/:id/share`                     | Chia sẻ lại một bài viết (`content`)                               |

> Tham khảo chi tiết tài liệu OpenAPI: [`docs/api-specs/post-service.yaml`](../../docs/api-specs/post-service.yaml)

---

## Redis Pub/Sub Events (Published)

Dịch vụ phát hành các sự kiện bất đồng bộ lên Redis Pub/Sub khi có tương tác bài viết để `notification-service` thông báo đến người dùng:

1. **Kênh `post.liked`**:
   ```json
   {
     "eventId": "uuid",
     "userId": "string",
     "postId": "string",
     "postAuthorId": "string",
     "occurredAt": "ISO8601 string"
   }
   ```
2. **Kênh `post.commented`**:
   ```json
   {
     "eventId": "uuid",
     "userId": "string",
     "postId": "string",
     "postAuthorId": "string",
     "commentId": "string",
     "occurredAt": "ISO8601 string"
   }
   ```
3. **Kênh `post.shared`**:
   ```json
   {
     "eventId": "uuid",
     "userId": "string",
     "postId": "string",
     "postAuthorId": "string",
     "occurredAt": "ISO8601 string"
   }
   ```

---

## Environment Variables

| Variable | Description | Local Fallback | Docker / K8s (Container Network) |
|---|---|---|---|
| `PORT` | Cổng HTTP Server | `5000` | `5000` |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho Prisma | `postgresql://socialhub:socialhub_secret@localhost:5432/socialhub?schema=public` | `postgresql://socialhub:socialhub_secret@pg:5432/socialhub_post?schema=public` |
| `REDIS_URL` | Chuỗi kết nối Redis Cache & Pub/Sub | `redis://localhost:6379` | `redis://redis:6379` |
| `USER_SERVICE_URL` | URL gọi nội bộ `user-service` | `http://user-service:5000` (hoặc `http://localhost:5001`) | `http://user-service:5000` |
| `MEDIA_SERVICE_URL` | URL gọi nội bộ `media-service` | `http://media-service:5000` (hoặc `http://localhost:5005`) | `http://media-service:5000` |
| `JWT_SECRET` | Khóa bí mật dùng cho xác thực JWT | `your-jwt-secret-change-in-production` | Được inject từ Secret / `.env` |

---

## Running Locally

### 1. Chạy qua Docker Compose (Khuyên dùng)
```bash
# Từ thư mục gốc của dự án
docker compose up post-service --build
```

### 2. Chạy Standalone (Local Development)
Yêu cầu đã có PostgreSQL và Redis đang chạy.
```bash
# Di chuyển vào thư mục post-service
cd services/post-service

# Cài đặt dependency & đồng bộ Prisma schema với cơ sở dữ liệu
npm install
npx prisma db push

# Chạy dịch vụ ở chế độ phát triển
npm run dev
```

---

## Project Structure

```
post-service/
├── Dockerfile
├── .dockerignore
├── .env
├── package.json
├── readme.md
├── prisma/
│   └── schema.prisma         # Prisma Schema định nghĩa Post, Like, Comment
└── src/
    ├── index.js              # Khởi tạo Express Server và kết nối Database
    ├── config/
    │   ├── db.js             # Khởi tạo Prisma Client
    │   └── redis.js          # Khởi tạo Redis Client & Publisher
    ├── controllers/
    │   ├── post.controller.js   # API Controller cho bài viết
    │   ├── feed.controller.js   # API Controller cho bảng tin newsfeed
    │   ├── like.controller.js   # API Controller cho lượt thích
    │   ├── comment.controller.js# API Controller cho bình luận
    │   └── share.controller.js  # API Controller cho chia sẻ bài viết
    ├── middleware/
    │   └── auth.js           # Middleware xác thực JWT / Headers từ Gateway
    ├── repositories/         # Tầng thao tác trực tiếp với cơ sở dữ liệu qua Prisma
    │   ├── post.repository.js
    │   ├── feed.repository.js
    │   ├── like.repository.js
    │   └── comment.repository.js
    ├── routes/
    │   └── post.routes.js    # Khai báo các tuyến đường REST API
    ├── services/             # Logic nghiệp vụ chính & phát hành sự kiện Redis
    │   ├── post.service.js
    │   ├── feed.service.js
    │   ├── like.service.js
    │   ├── comment.service.js
    │   └── share.service.js
    └── utils/
        ├── api.js            # Gọi REST API inter-service (user-service, media-service) & Caching
        ├── error.js          # Các lớp xử lý lỗi tùy chỉnh
        └── response.js       # Format dữ liệu trả về HTTP response
```
