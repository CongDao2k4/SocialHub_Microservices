# API Gateway

Gateway la diem vao duy nhat cho frontend va cac client khac cua SocialHub. Service nay lam 4 viec chinh:

- xac thuc JWT va inject `x-user-id`, `x-user-jti` cho downstream service
- routing `/api/*` den dung microservice
- gioi han request theo IP
- proxy stream media va proxy WebSocket cho chat / notification

## Runtime

- Internal port: `8000`
- Host port trong `docker-compose.yml`: `8080`
- Health check: `GET /health`
- Swagger UI tap trung: `GET /api-docs`

## Routing matrix

Tat ca REST request cua frontend di qua `http://localhost:8080/api`.

| Gateway route | Downstream | Rewrite |
| --- | --- | --- |
| `/api/auth/*` | `user-service` | giu nguyen `/api/auth/*` |
| `/api/users/*` | `user-service` | giu nguyen `/api/users/*` |
| `/api/friends/*` | `friend-service` | giu nguyen `/api/friends/*` |
| `/api/posts/*` | `post-service` | bo prefix `/api` |
| `/api/feed/*` | `post-service` | bo prefix `/api` |
| `/api/reels/*` | `post-service` | bo prefix `/api` |
| `/api/conversations/*` | `chat-service` | bo prefix `/api` |
| `/api/groups/*` | `chat-service` | bo prefix `/api` |
| `/api/notifications/*` | `notification-service` | bo prefix `/api` |
| `/api/media/upload` | `media-service` | bo prefix `/api` |
| `/api/media/batch-urls` | `media-service` | bo prefix `/api` |
| `/api/media/file/:id` | `media-service` | bo prefix `/api` |
| `/api/media/hls/:id/index.m3u8` | `media-service` | bo prefix `/api` |
| `/api/media/hls/:id/:segment` | `media-service` | bo prefix `/api` |
| `/api/media/:id` | `media-service` | bo prefix `/api` |
| `/api/media/:id/url` | `media-service` | bo prefix `/api` |

## Auth va security

- Public routes:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET /api/media/file/:id`
  - `GET /api/media/hls/:id/index.m3u8`
  - `GET /api/media/hls/:id/:segment`
- Protected routes dung `protectRoute` de verify bearer token.
- Sau khi verify thanh cong, Gateway tu them:
  - `x-user-id`
  - `x-user-jti` neu co trong token

## Rate limit

- Middleware duoc gan tai `app.use('/api', rateLimiter(100, 60), gatewayRoutes)`
- Muc mac dinh: `100 requests / 60s / IP`
- Luong stream public `/media/file/*` va `/media/hls/*` duoc middleware rate limiter xu ly theo logic rieng trong `rate-limiter.middleware.js`

## Media proxy va streaming

Gateway khong tu xu ly file media. No chi stream lai tu `media-service`.

Trang thai hien tai:

- media upload video duoc xu ly bat dong bo (asynchronous) giup API tra ve HTTP status `201` ngay lap tuc sau khi luu video goc, giam thieu treo request.
- public HLS playlist va segment di qua:
  - `/api/media/hls/:id/index.m3u8`
  - `/api/media/hls/:id/:segment`
- stream proxy dung `pipeline(...)` thay vi `pipe(...)` de giam loi:
  - `ECONNRESET`
  - `ERR_STREAM_PREMATURE_CLOSE`
- media circuit breaker timeout mac dinh da tang len `180000ms` de du cho upload video + FFmpeg HLS
- CORS Gateway duoc cau hinh de cho phep header `Range` va expose cac header `Accept-Ranges`, `Content-Range`. Dieu nay cho phep cac client o domain ngoai (nhu Vercel) co the gui request phan doan va stream video muot ma ma khong bi chan CORS.

## Circuit breaker

Gateway dung `opossum` cho tung downstream service.

Gia tri hien tai:

- default timeout: `5000ms`
- media timeout: `180000ms`
- error threshold: `50%`
- reset timeout: `10000ms`

Khi stream bi client dong som, Gateway bo qua cac loi abort/reset thay vi co gang ghi de response.

## WebSocket proxy

Gateway tach rieng 2 duong Socket.IO:

- Notification socket: `/notification/socket.io/`
- Chat socket: `/chat/socket.io/`

Trong do chat socket phuc vu ca:

- messaging
- typing / presence
- call signaling
- WebRTC offer / answer / ICE candidate

## Video call + TURN

Gateway khong sinh `iceServers`, nhung la diem vao cho frontend goi:

- `GET /api/conversations/ice-servers`

Route nay duoc forward sang `chat-service`, service se tra ve:

- danh sach STUN public
- TURN server tu bien moi truong:
  - `TURN_URL`
  - `TURN_USERNAME`
  - `TURN_CREDENTIAL`

Xem them tai lieu chi tiet:

- [docs/video-call-turn-server.md](../docs/video-call-turn-server.md)
- [README_CONFIG_TURN_SERVER_GOOGLE_CLOUD.md](../README_CONFIG_TURN_SERVER_GOOGLE_CLOUD.md)
- [README_CONFIG_TURN_SERVER_ORACLE.md](../README_CONFIG_TURN_SERVER_ORACLE.md)

## Bien moi truong quan trong

| Variable | Default |
| --- | --- |
| `PORT` | `8000` |
| `USER_SERVICE_URL` | `http://user-service:5000` |
| `FRIEND_SERVICE_URL` | `http://friend-service:5000` |
| `POST_SERVICE_URL` | `http://post-service:5000` |
| `CHAT_SERVICE_URL` | `http://localhost:5004` |
| `MEDIA_SERVICE_URL` | `http://media-service:5000` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service:5000` |
| `REDIS_URL` | `redis://redis:6379` |
| `JWT_SECRET` | app secret dung chung |
| `CIRCUIT_BREAKER_TIMEOUT` | `5000` |
| `MEDIA_CIRCUIT_BREAKER_TIMEOUT` | `180000` neu khong set |
| `CIRCUIT_BREAKER_ERROR_THRESHOLD` | `50` |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | `10000` |

## Kiem tra nhanh

```bash
cd gateway
npm install
npm run dev
```

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api-docs
```
