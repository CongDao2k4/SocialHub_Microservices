# SocialHub Microservices Platform

SocialHub la mot mang xa hoi duoc tach thanh nhieu microservice. Repo nay gom:

- Gateway
- User / Friend / Post / Chat / Media / Notification service
- Frontend React
- ha tang local bang Docker Compose
- tai lieu deploy cloud, TURN server, Cloudflare tunnel

## Kien truc tong quan

### Application services

| Service | Host port | Vai tro |
| --- | --- | --- |
| Gateway | `8080` | diem vao duy nhat cho REST + WebSocket |
| user-service | `5001` | auth, profile, search user |
| friend-service | `5002` | friend graph, request, suggestion |
| post-service | `5003` | post, feed, comment, like, reel |
| chat-service | `5004` | conversation, message, group, call signaling |
| media-service | `5005` | upload image/video, MinIO stream, HLS |
| notification-service | `5006` | notification realtime |

### Infrastructure services

| Service | Host port | Vai tro |
| --- | --- | --- |
| PostgreSQL | `5432` | user / friend / post data |
| MongoDB | `27018` | chat / media / notification data |
| Redis | `6379` | cache, presence, blacklist token |
| MinIO API | `9005` | object storage cho image/video |
| MinIO Console | `9001` | quan tri object storage |
| RabbitMQ AMQP | `5672` | event bus |
| RabbitMQ Console | `15672` | admin UI |

## Luong truy cap chinh

- REST: frontend -> Gateway -> downstream service
- WebSocket:
  - `/notification/socket.io/` -> notification-service
  - `/chat/socket.io/` -> chat-service
- Media:
  - file stream: `/api/media/file/:id`
  - HLS playlist: `/api/media/hls/:id/index.m3u8`
  - HLS segment: `/api/media/hls/:id/:segment`

## Diem moi quan trong trong code hien tai

### 1. Upload video cho reel da doi sang HLS dong bo

Khi goi `POST /api/media/upload` voi file video:

- media-service upload file goc
- transcode HLS bang FFmpeg
- upload `index.m3u8` va segment `.ts`
- chi sau khi `hlsReady=true` moi tra `201`

Tac dung:

- giam han tinh trang "upload xong nhung mo reel ngay thi `index.m3u8` bi 404"

### 2. Gateway stream media ben hon

Gateway va media-service da doi luong stream sang `pipeline(...)` de xu ly tot hon khi:

- client dong request som
- stream MinIO bi ngat
- proxy gap `ECONNRESET`

### 3. Media circuit breaker timeout da tang

- mac dinh media timeout: `180000ms`
- phu hop hon cho upload video + HLS transcode

## Swagger va health check

- Gateway health: `GET http://localhost:8080/health`
- Swagger UI tap trung: `GET http://localhost:8080/api-docs`

## Chay local

### 1. Khoi dong ha tang

```bash
docker compose up -d
```

### 2. Chay tung service local

```bash
cd services/user-service && npm install && npm run dev
cd services/friend-service && npm install && npm run dev
cd services/post-service && npm install && npm run dev
cd services/chat-service && npm install && npm run dev
cd services/media-service && npm install && npm run dev
cd services/notification-service && npm install && npm run dev
cd gateway && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Neu dung Docker Compose cho ca backend, xem them trong `docker-compose.yml`.

## REST nhanh theo nhom

### Auth va user

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `GET /api/users/search`

### Friend

- `POST /api/friends/request`
- `GET /api/friends/requests`
- `PUT /api/friends/requests/:requestId/accept`
- `PUT /api/friends/requests/:requestId/reject`
- `GET /api/friends`
- `GET /api/friends/suggestions`
- `GET /api/friends/mutual/:userId`
- `DELETE /api/friends/:friendId`

### Post va reel

- `POST /api/posts`
- `GET /api/posts/:postId`
- `PUT /api/posts/:postId`
- `DELETE /api/posts/:postId`
- `GET /api/posts/user/:userId`
- `GET /api/feed`
- `POST /api/posts/:postId/like`
- `DELETE /api/posts/:postId/like`
- `GET /api/posts/:postId/comments`
- `POST /api/posts/:postId/comments`
- `DELETE /api/posts/:postId/comments/:commentId`
- `POST /api/posts/:postId/share`
- `POST /api/reels` (Tạo Reel mới)
- `GET /api/reels` (Bảng tin Reels)
- `GET /api/reels/user/:userId` (Reels của người dùng)
- `GET /api/reels/:id` (Chi tiết Reel)
- `POST /api/reels/:id/view` (Tăng lượt xem Reel)
- `PUT /api/reels/:id` (Chỉnh sửa Reel - Chỉ tác giả)
- `DELETE /api/reels/:id` (Xóa Reel - Chỉ tác giả)
- `POST /api/reels/:id/like` (Thích Reel)
- `DELETE /api/reels/:id/like` (Bỏ thích Reel)
- `GET /api/reels/:id/comments` (Bình luận Reel)
- `POST /api/reels/:id/comments` (Tạo bình luận Reel)

### Media

- `POST /api/media/upload`
- `POST /api/media/batch-urls`
- `GET /api/media/file/:id`
- `GET /api/media/hls/:id/index.m3u8`
- `GET /api/media/hls/:id/:segment`
- `GET /api/media/:id`
- `GET /api/media/:id/url`
- `DELETE /api/media/:id`

### Chat va notification

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id/messages`
- `GET /api/conversations/ice-servers`
- `POST /api/groups`
- `GET /api/notifications`
- `GET /api/notifications/unread-count`

## Video Call + TURN Server tren VM Cloud

He thong goi video/audio dung WebRTC:

- `chat-service` chi lam signaling server
- media audio/video di truc tiep P2P neu co the
- khi NAT / firewall lam peer-to-peer that bai, client se relay qua TURN server

### Luong hien tai

1. frontend mo chat socket qua Gateway
2. frontend goi `GET /api/conversations/ice-servers`
3. chat-service tra ve STUN + TURN tu bien moi truong
4. frontend dung danh sach nay de tao `RTCPeerConnection`
5. signaling dung cac event:
   - `call:initiate`
   - `call:incoming`
   - `call:accept`
   - `call:reject`
   - `call:end`
   - `webrtc:offer`
   - `webrtc:answer`
   - `webrtc:ice-candidate`

### Bien moi truong TURN

Trong `.env` hien co:

- `TURN_URL`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

### Tai lieu chi tiet

- [docs/video-call-turn-server.md](./docs/video-call-turn-server.md)
- [README_CONFIG_TURN_SERVER_GOOGLE_CLOUD.md](./README_CONFIG_TURN_SERVER_GOOGLE_CLOUD.md)
- [README_CONFIG_TURN_SERVER_ORACLE.md](./README_CONFIG_TURN_SERVER_ORACLE.md)

## Tai lieu theo service

- [gateway/readme.md](./gateway/readme.md)
- [services/user-service/readme.md](./services/user-service/readme.md)
- [services/friend-service/readme.md](./services/friend-service/readme.md)
- [services/post-service/readme.md](./services/post-service/readme.md)
- [services/chat-service/readme.md](./services/chat-service/readme.md)
- [services/media-service/readme.md](./services/media-service/readme.md)
- [services/notification-service/readme.md](./services/notification-service/readme.md)
- [frontend/readme.md](./frontend/readme.md)

## Luu y hien tai

- Quá trình upload video được xử lý bất đồng bộ (asynchronous HLS transcoding) giúp API trả về mã `201 Created` ngay lập tức để không gây tắc nghẽn luồng request.
