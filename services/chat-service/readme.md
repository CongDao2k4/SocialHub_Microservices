# chat-service

`chat-service` quan ly conversation, message, group chat, realtime presence va signaling cho audio/video call.

## Chuc nang chinh

- conversation 1-1
- group chat
- luu lich su tin nhan trong MongoDB
- typing indicator, read receipt, online presence
- signaling cho WebRTC call 1-1 va group call
- tra ve `iceServers` de frontend lay STUN/TURN tu backend

## Runtime

- Internal port: `5000`
- Host port trong `docker-compose.yml`: `5004`
- Health check: `GET /health`

## REST endpoints

Tat ca route duoi day, tru `/health`, deu yeu cau auth.

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| `GET` | `/health` | health check |
| `GET` | `/conversations` | lay danh sach conversation |
| `POST` | `/conversations` | tao hoac lay conversation 1-1 |
| `GET` | `/conversations/ice-servers` | lay STUN/TURN config cho WebRTC |
| `GET` | `/conversations/:id` | lay chi tiet conversation |
| `GET` | `/conversations/:id/messages` | lay lich su tin nhan |
| `DELETE` | `/conversations/:id` | xoa conversation |
| `POST` | `/groups` | tao group |
| `GET` | `/groups/:id` | lay chi tiet group |
| `PUT` | `/groups/:id` | cap nhat group |
| `POST` | `/groups/:id/members` | them member |
| `DELETE` | `/groups/:id/members/:userId` | xoa member |
| `POST` | `/groups/:id/leave` | roi group |

## `GET /conversations/ice-servers`

Endpoint nay duoc frontend goi truoc khi bat dau call.

Response hien tai gom:

- STUN Google public
- TURN server tu bien moi truong:
  - `TURN_URL`
  - `TURN_USERNAME`
  - `TURN_CREDENTIAL`

Dieu nay giup frontend khong phai hardcode TURN credential trong code production.

## Socket.IO

Frontend thuong ket noi qua Gateway:

- `ws://localhost:8080/chat/socket.io/`

Neu ket noi truc tiep service:

- `ws://localhost:5004/socket.io/`

Auth truyen qua handshake token bearer.

## Socket events

### Messaging va presence

- `message:send`
- `message:read`
- `typing:start`
- `typing:stop`
- `presence:heartbeat`
- `message:received`
- `message:read:ack`
- `typing:indicator`
- `user:online`
- `user:offline`

### Call 1-1

Client -> server:

- `call:initiate`
- `call:accept`
- `call:reject`
- `call:end`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`

Server -> client:

- `call:incoming`
- `call:accepted`
- `call:rejected`
- `call:ended`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`

### Group call

Hien tai service ho tro room event cho group call:

- `group-call:join`
- `group-call:joined-room`
- `group-call:user-joined`
- `group-call:user-left`
- `group-call:leave`

Ngoai ra `call:initiate` cung ho tro payload group voi:

- `targetUserIds`
- `groupId`
- `groupName`
- `groupAvatar`
- `isGroup`

## Kien truc Video Call

- `chat-service` chi lam signaling
- media audio/video khong di qua backend nay
- frontend tao `RTCPeerConnection`
- neu P2P that bai, TURN server se relay media

Tai lieu chi tiet:

- [../../docs/video-call-turn-server.md](../../docs/video-call-turn-server.md)

## Redis events

Service publish len Redis:

- `message.sent`
- `group.member.added`

Muc dich chinh la de `notification-service` tieu thu va day thong bao.

## Bien moi truong quan trong

| Variable | Default / y nghia |
| --- | --- |
| `PORT` | `5000` |
| `MONGO_URI` | MongoDB cho chat |
| `REDIS_URL` | Redis cho presence + pub/sub |
| `JWT_SECRET` | dung verify JWT |
| `USER_SERVICE_URL` | REST sang user-service |
| `MEDIA_SERVICE_URL` | REST sang media-service |
| `TURN_URL` | URL TURN server |
| `TURN_USERNAME` | user TURN |
| `TURN_CREDENTIAL` | password / credential TURN |

## Chay local

```bash
cd services/chat-service
npm install
npm run dev
```

Kiem tra nhanh:

```bash
curl http://localhost:5004/health
curl -H "Authorization: Bearer <token>" http://localhost:5004/conversations/ice-servers
```

## File lien quan

- routes: [src/routes/conversation.routes.js](./src/routes/conversation.routes.js)
- controller: [src/controllers/conversation.controller.js](./src/controllers/conversation.controller.js)
- signaling: [src/socket/call.handler.js](./src/socket/call.handler.js)
- OpenAPI: [../../docs/api-specs/chat-service.yaml](../../docs/api-specs/chat-service.yaml)
