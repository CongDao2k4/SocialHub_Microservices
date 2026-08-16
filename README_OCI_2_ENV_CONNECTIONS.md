# Giai Đoạn 2: Thiết Lập Cấu Hình Môi Trường & Cơ Chế Mã Hóa Base64

Tài liệu này hướng dẫn cách chuẩn bị tệp cấu hình `.env` cho Production trên máy ảo OCI và hướng dẫn sử dụng cơ chế bảo mật mã hóa Base64 cho các secrets nhạy cảm.

---

## 🔒 1. Cơ Chế Tự Động Giải Mã Base64 (Hộp đen Secrets)

Để bảo mật các thông tin nhạy cảm (như mật khẩu cơ sở dữ liệu, URI kết nối Atlas, JWT secret) trong tệp `.env` trên máy ảo Production mà không cần cài đặt các công cụ Vault phức tạp, hệ thống hỗ trợ cơ chế giải mã tự động bằng tiền tố `base64:`.

### Cách hoạt động
Nếu một biến môi trường bất kỳ có giá trị bắt đầu bằng `base64:`, bộ tải cấu hình của dịch vụ sẽ tự động giải mã chuỗi Base64 phía sau thành văn bản thường (plain text) lúc khởi động.

**Ví dụ:**
- Nếu mật khẩu PostgreSQL của bạn là `my_secure_pass123`.
- Chuỗi mã hóa Base64 của mật khẩu là `bXlfc2VjdXJlX3Bhc3MxMjM=`.
- Bạn có thể điền vào `.env` như sau:
  ```env
  PG_PASSWORD=base64:bXlfc2VjdXJlX3Bhc3MxMjM=
  ```
- Các microservices sẽ tự động đọc được giá trị giải mã là `my_secure_pass123` mà không gặp bất cứ lỗi kết nối nào!

### Cách tạo chuỗi Base64 trên máy tính của bạn
- **Linux / macOS / Git Bash / OCI VM Shell**:
  ```bash
  echo -n "chuoi_can_ma_hoa" | base64
  ```
- **Windows PowerShell**:
  ```powershell
  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("chuoi_can_ma_hoa"))
  ```

---

## 🍃 2. Thiết Lập MongoDB Atlas (External DB)

Vì MongoDB 7 chiếm nhiều tài nguyên bộ nhớ, chúng ta sử dụng MongoDB Atlas miễn phí (Shared Cluster) bên ngoài:

1. Đăng nhập vào [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Tạo một Cluster Always Free (M0). Chọn nhà cung cấp (AWS/GCP/Azure) và Region gần bạn nhất (ví dụ: Singapore hoặc asia-east1).
3. Tại phần **Database Access**, tạo một User với quyền `Read and write to any database` (lưu lại mật khẩu).
4. Tại phần **Network Access**, nhấp **Add IP Address** -> Chọn **Allow Access From Anywhere** (`0.0.0.0/0`) hoặc điền đúng IP Tĩnh VM Oracle của bạn (khuyên dùng để bảo mật hơn).
5. Trở lại tab **Clusters** -> Chọn **Connect** -> Chọn **Drivers** (chọn Node.js bản mới nhất).
6. Sao chép chuỗi kết nối nhận được, dạng:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/socialhub?retryWrites=true&w=majority
   ```
7. Tiến hành mã hóa Base64 chuỗi kết nối trên, ví dụ thu được `bW9uZ29kYitzcnY6Ly8...`.
8. Thiết lập trong tệp `.env` trên VM:
   ```env
   MONGO_URI=base64:bW9uZ29kYitzcnY6Ly8...
   ```

---

## 📝 3. Mẫu Cấu Hình Tệp `.env` Trên VM Production

Tạo một tệp `.env` tại thư mục gốc dự án trên VM (`~/SocialHub_Microservices/.env`) và điền các cấu hình của bạn:

```env
# --- General ---
COMPOSE_PROJECT_NAME=socialhub
ENVIRONMENT=production

# --- JWT (Mã hóa Base64) ---
# Hãy tạo các JWT secrets thật bảo mật, mã hóa base64 và dán vào đây
JWT_SECRET=base64:c29jaWFsaHViX2p3dF9zZWNyZXRfZ2VuZXJhdGVkX2hlcmU=
JWT_REFRESH_SECRET=base64:c29jaWFsaHViX2p3dF9yZWZyZXNoX3NlY3JldF9nZW5lcmF0ZWQ=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# --- PostgreSQL (Docker Local) ---
PG_HOST=pg
PG_PORT=5432
PG_DATABASE=socialhub
PG_USER=socialhub
# Mật khẩu PG đã mã hóa Base64 (chuỗi gốc ví dụ: socialhub_secret_prod)
PG_PASSWORD=base64:c29jaWFsaHViX3NlY3JldF9wcm9k

# --- MongoDB (MongoDB Atlas External) ---
# Chuỗi URI kết nối Atlas đã mã hóa Base64
MONGO_URI=base64:bW9uZ29kYitzcnY6Ly91c2VyOnBhc3NAY2x1c3RlcjAuY29ubmVjdC5uZXQvc29jaWFsaHViP3JldHJ5V3JpdGVzPXRydWUmdz1tYWpvcml0eQ==

# --- Redis (Docker Local) ---
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

# --- MinIO (S3-compatible) ---
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=socialhub_minio
# Khóa bí mật MinIO đã mã hóa Base64
MINIO_SECRET_KEY=base64:c29jaWFsaHViX21pbmlvX3NlY3JldF9wcm9k
MINIO_BUCKET=socialhub-media
MINIO_USE_SSL=false
MINIO_PRESIGNED_URL_TTL=900

# --- RabbitMQ ---
RABBITMQ_USER=socialhub
# Mật khẩu RabbitMQ đã mã hóa Base64
RABBITMQ_PASSWORD=base64:c29jaWFsaHViX3JhYmJpdF9zZWNyZXQ=
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_URL=amqp://socialhub:socialhub_secret_prod@rabbitmq:5672

# --- Service Ports ---
GATEWAY_PORT=8080
USER_SERVICE_PORT=5001
FRIEND_SERVICE_PORT=5002
POST_SERVICE_PORT=5003
CHAT_SERVICE_PORT=5004
MEDIA_SERVICE_PORT=5005
NOTIFICATION_SERVICE_PORT=5006

# --- Service Internal URLs ---
USER_SERVICE_URL=http://user-service:5000
FRIEND_SERVICE_URL=http://friend-service:5000
POST_SERVICE_URL=http://post-service:5000
CHAT_SERVICE_URL=http://chat-service:5000
MEDIA_SERVICE_URL=http://media-service:5000
NOTIFICATION_SERVICE_URL=http://notification-service:5000

# --- API Gateway ---
# Gateway Secret đã mã hóa Base64
GATEWAY_SECRET=base64:Z2F0ZXdheV9zZWNyZXRfcHJvZF9wYXNz

# --- TURN Server (WebRTC) ---
# Thông tin kết nối TURN của bạn
TURN_URL=turn:turn.yourdomain.com:3478
TURN_USERNAME=socialhub_user
TURN_CREDENTIAL=base64:c29jaWFsaHViX3R1cm5fc2VjcmV0
```
