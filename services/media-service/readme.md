# media-service

> **Bounded Context:** Media — Quản lý toàn bộ vòng đời của file media trong hệ thống SocialHub.

---

## Overview

`media-service` chịu trách nhiệm:

- **Upload** file ảnh (JPG, PNG, GIF, WEBP) và video (MP4, WEBM, MOV, AVI) lên MinIO Object Storage
- **Lưu trữ Metadata** (tên file, kích thước, định dạng, người upload) vào MongoDB
- **Cấp phát Presigned URL** có thời hạn (TTL 15 phút) để client tải ảnh trực tiếp từ MinIO mà không cần đi qua service
- **Xóa** file khỏi MinIO và metadata khỏi MongoDB

Trong kiến trúc hệ thống, mọi request từ client đều đi qua **API Gateway** (cổng 8080), Gateway sẽ validate JWT và inject `x-user-id` header trước khi forward sang service này.

---

## Tech Stack

| Component  | Choice                          |
|------------|---------------------------------|
| Language   | Node.js 20 Slim (ES Modules)    |
| Framework  | Express v5                      |
| Database   | MongoDB (via Mongoose)          |
| Storage    | MinIO (S3-compatible)           |
| Upload     | Multer (memoryStorage)          |
| Port       | `5000` (internal) / `5005` (host) |
| Base Image | `node:20-slim` (Debian — tránh lỗi DNS của Alpine) |

---

## API Endpoints

| Method | Endpoint              | Description                          | Auth           |
|--------|-----------------------|--------------------------------------|----------------|
| GET    | `/health`             | Kiểm tra trạng thái service và MinIO | Không cần      |
| POST   | `/media/upload`       | Upload file ảnh (multipart/form-data)| `x-user-id`    |
| GET    | `/media/file/:id`     | Tải/Hiển thị file nhị phân trực tiếp | Không cần      |
| GET    | `/media/:id`          | Lấy metadata của file                | `x-user-id`    |
| GET    | `/media/:id/url`      | Lấy relative proxy URL để tải ảnh    | `x-user-id`    |
| DELETE | `/media/:id`          | Xóa file (chỉ chủ sở hữu)            | `x-user-id`    |
| POST   | `/media/batch-urls`   | Lấy relative proxy URLs cho nhiều file| `x-user-id`   |

> Full API specification: [`docs/api-specs/media-service.yaml`](../../docs/api-specs/media-service.yaml)

---

## Luồng hoạt động

```
POST /media/upload
  │
  ├─ Multer kiểm tra file type (JPG/PNG/GIF/WEBP) + size (≤ 10MB)
  ├─ Upload file buffer → MinIO (private bucket)
  ├─ Lưu Metadata → MongoDB collection "media"
  └─ Trả về { id, originalName, mimeType, size, uploadedBy, createdAt }

GET /media/:id/url
  │
  ├─ Tìm Metadata trong MongoDB theo id
  └─ Trả về { mediaId, url: "/media/file/:id", expiresAt, ttlSeconds }

GET /media/file/:id (Public Proxy Stream)
  │
  ├─ Tìm Metadata trong MongoDB theo id
  ├─ Gọi MinIO lấy luồng đọc file (getObject stream)
  └─ Stream trực tiếp về Client kèm Content-Type & Cache-Control
```

---

## Project Structure

```
media-service/
├── Dockerfile
├── .dockerignore
├── package.json
├── readme.md
└── src/
    ├── server.js                    # Entry point — kết nối DB, MinIO, khởi động server
    ├── app.js                       # Express setup — middleware, routes, error handler
    ├── config/
    │   ├── index.js                 # Tất cả biến môi trường (process.env)
    │   └── db.js                    # Kết nối MongoDB với Mongoose
    ├── models/
    │   └── media.model.js           # Mongoose Schema cho MediaAsset
    ├── services/
    │   ├── minio.service.js         # Thao tác với MinIO
    │   └── media.service.js         # Logic nghiệp vụ & tương tác MongoDB
    ├── middlewares/
    │   └── upload.middleware.js     # Multer config — file type + size validation
    ├── controllers/
    │   └── media.controller.js      # Request handlers — nhận request và đẩy xuống tầng Service
    ├── routes/
    │   └── media.routes.js          # Route definitions
    └── utils/
        └── error.js                 # Custom error classes (AppError, NotFoundError, ...)
```

---

## Environment Variables

| Variable                | Description                              | Default                    |
|-------------------------|------------------------------------------|----------------------------|
| `PORT`                  | Port server lắng nghe                    | `5000`                     |
| `MONGO_URI`             | MongoDB connection string                | `mongodb://localhost:27017/socialhub-media` |
| `MINIO_ENDPOINT`        | Hostname của MinIO server                | `localhost`                |
| `MINIO_PORT`            | Port MinIO API                           | `9000`                     |
| `MINIO_USE_SSL`         | Dùng HTTPS cho MinIO không               | `false`                    |
| `MINIO_ACCESS_KEY`      | MinIO access key (username)              | `minioadmin`               |
| `MINIO_SECRET_KEY`      | MinIO secret key (password)              | `minioadmin`               |
| `MINIO_BUCKET_NAME`     | Tên bucket chứa ảnh                     | `socialhub-media`          |
| `PRESIGNED_URL_TTL`     | Thời hạn của Presigned URL (giây)        | `900` (15 phút)            |
| `MAX_FILE_SIZE`         | Giới hạn dung lượng ảnh (bytes)          | `10485760` (10MB)          |
| `MAX_VIDEO_SIZE`        | Giới hạn dung lượng video (bytes)         | `104857600` (100MB)        |

---

## Running Locally

```bash
# Từ thư mục gốc của project — chỉ khởi động media-service + minio + mongo
docker compose up --build media-service

# Kiểm tra health
curl http://localhost:5005/health
# → {"status":"ok","service":"media-service"}

# Upload ảnh
curl -X POST http://localhost:5005/media/upload \
  -F "file=@./test.jpg" \
  -H "x-user-id: user-123"
# → {"id":"...","originalName":"test.jpg",...}

# Lấy presigned URL
curl http://localhost:5005/media/{id}/url
# → {"mediaId":"...","url":"http://localhost:9000/...","expiresAt":"..."}
```

> **Lưu ý:** Trong môi trường thực tế, header `x-user-id` được **API Gateway inject** sau khi validate JWT. Khi test thủ công không qua Gateway, bạn cần tự truyền header này.

---

## Design Decisions

- **In-memory buffer với Multer**: File được giữ trên RAM thay vì ghi tạm ra ổ cứng container để đẩy thẳng sang MinIO, giảm I/O không cần thiết.
- **Bucket PRIVATE**: Toàn bộ file trong MinIO ở chế độ private. Client **không thể** truy cập trực tiếp. Mọi truy cập phải qua Presigned URL có thời hạn để kiểm soát quyền truy cập.
- **objectKey ẩn khỏi API**: Đường dẫn thật của file trong MinIO (`userId/uuid.ext`) không bao giờ được trả về cho client. Client chỉ biết `mediaId` (UUID của MongoDB).
- **`node:20-slim` thay vì `node:20-alpine`**: Alpine dùng `musl libc` gây lỗi DNS (`EAI_AGAIN`) khi phân giải tên container nội bộ Docker (ví dụ: `mongo`). `slim` dùng `glibc` chuẩn của Debian, tránh hoàn toàn lỗi này.

---

## MinIO Console (Quản lý file trực quan)

Khi hệ thống đang chạy, bạn có thể truy cập giao diện web của MinIO để xem, tải lên, xóa file thủ công:

**URL:** http://localhost:9001

| Thông tin  | Giá trị                 |
|------------|-------------------------|
| Username   | `socialhub_minio`       |
| Password   | `socialhub_minio_secret`|

**Sau khi đăng nhập:**
1. Vào menu **Buckets** → chọn bucket `socialhub-media`
2. Chọn tab **Object Browser** để xem toàn bộ file ảnh
3. File được tổ chức theo cấu trúc: `{userId}/{uuid}.{ext}`

> **Lưu ý:** Cổng `9000` là cổng API dành cho code (không dùng trực tiếp). Cổng `9001` là giao diện quản trị web.

---

## Logging & Caching Behavior
- **HTTP Request Logger**: All incoming API requests are logged using `morgan('dev')`.
- **Cache-Control & ETags**: ETags are disabled (`app.set('etag', false)`). Metadata API responses are set to `Cache-Control: no-store` to prevent browser caching. Public binary streams (`/media/file/:id`) bypass this control and use a long-lived caching header (`Cache-Control: public, max-age=86400`) to optimize image loading performance.
