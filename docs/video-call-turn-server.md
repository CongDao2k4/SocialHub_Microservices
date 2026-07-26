# Video Call va TURN Server tren VM Cloud

Tai lieu nay mo ta dung tinh nang goi audio/video trong SocialHub va cach no ket noi voi TURN server tu host tren mot VM cloud.

## Muc tieu

Tinh nang call can hoat dong on dinh trong cac mang:

- cung LAN / NAT de mo
- NAT doi xung
- 4G / Wi-Fi doanh nghiep
- mang bi chan P2P truc tiep

De lam duoc viec do:

- frontend su dung WebRTC
- `chat-service` chi lam signaling
- TURN server relay media khi peer-to-peer that bai

## Kien truc

```text
Frontend -> Gateway (/chat/socket.io/) -> chat-service
Frontend -> Gateway (/api/conversations/ice-servers) -> chat-service
Frontend <-> TURN VM (UDP/TCP 3478, media relay port range)
```

## Thanh phan trong repo

### Frontend

File chinh:

- [frontend/src/components/CallWindow.jsx](../frontend/src/components/CallWindow.jsx)
- [frontend/src/components/IncomingCallModal.jsx](../frontend/src/components/IncomingCallModal.jsx)
- [frontend/src/components/ChatWidget.jsx](../frontend/src/components/ChatWidget.jsx)

Frontend:

- mo socket chat
- xin `iceServers` tu backend
- tao `RTCPeerConnection`
- gui nhan offer / answer / ICE candidate
- ho tro ca 1-1 call va group call

### chat-service

File chinh:

- [services/chat-service/src/controllers/conversation.controller.js](../services/chat-service/src/controllers/conversation.controller.js)
- [services/chat-service/src/socket/call.handler.js](../services/chat-service/src/socket/call.handler.js)

chat-service:

- tra ve `iceServers` qua `GET /api/conversations/ice-servers`
- forward signaling event giua cac user
- quan ly room cho group call

## REST endpoint lien quan

### `GET /api/conversations/ice-servers`

Response hien tai chua:

- STUN public Google
- TURN server tu:
  - `TURN_URL`
  - `TURN_USERNAME`
  - `TURN_CREDENTIAL`

Frontend goi endpoint nay truoc khi bat dau call. Neu API loi, frontend fallback ve danh sach STUN local duoc hardcode trong `CallWindow.jsx`.

## Socket events lien quan

### Call lifecycle

- `call:initiate`
- `call:incoming`
- `call:accept`
- `call:rejected`
- `call:ended`

### WebRTC signaling

- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`

### Group call

- `group-call:join`
- `group-call:joined-room`
- `group-call:user-joined`
- `group-call:user-left`
- `group-call:leave`

## Bien moi truong

Can set tren backend `chat-service`:

| Variable | Vi du |
| --- | --- |
| `TURN_URL` | `turn:turn.socialhubzz.cloud:3478` |
| `TURN_USERNAME` | `socialhub_user` |
| `TURN_CREDENTIAL` | `socialhub_secret_pass` |

Trong repo hien tai, cac bien nay da xuat hien trong `.env`.

## Yeu cau TURN server

TURN server can:

- co public IP co dinh
- mo port `3478` cho UDP va TCP
- mo dai media relay UDP, vi du `49152-49200`
- khong di qua Cloudflare proxy mau cam
- DNS phai de `DNS only`

## Vi sao Cloudflare van dung duoc

Cloudflare free plan khong proxy duoc UDP/TURN theo cach thong thuong. Cach dung dung la:

- tao A record cho `turn.yourdomain.com`
- tat proxy
- chi dung Cloudflare lam DNS resolver

Khi do browser se noi truc tiep toi VM TURN.

## Lua chon cloud da co tai lieu san

- Google Cloud VM:
  - [README_CONFIG_TURN_SERVER_GOOGLE_CLOUD.md](../README_CONFIG_TURN_SERVER_GOOGLE_CLOUD.md)
- Oracle Cloud VM:
  - [README_CONFIG_TURN_SERVER_ORACLE.md](../README_CONFIG_TURN_SERVER_ORACLE.md)

Neu muon mot ban huong dan ngan:

1. tao VM co public IP
2. cai Coturn
3. mo port `3478` va dai relay UDP
4. tao DNS `turn.<domain>` o che do DNS only
5. cap nhat `.env` / secret backend
6. restart `chat-service`

## Checklist debug nhanh

Neu call khong len media:

1. kiem tra `GET /api/conversations/ice-servers` co tra dung TURN khong
2. kiem tra browser devtools xem ICE candidate co type `relay` khong
3. kiem tra DNS `turn.<domain>` co resolve dung public IP khong
4. kiem tra firewall VM va cloud security rule
5. kiem tra Coturn logs
6. kiem tra Cloudflare co dang proxy record TURN khong

## Luu y bao mat

- khong hardcode TURN credential trong frontend production
- frontend nen lay `iceServers` tu backend
- credential nen dua vao `.env`, Kubernetes Secret, hoac secret manager

## Luu y kien truc

- TURN server chi relay media, khong thay the signaling
- signaling van di qua `chat-service`
- Gateway khong sinh TURN config, no chi forward request REST va WebSocket
