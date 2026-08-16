# Giai Đoạn 4: Khởi Chạy Dự Án & Giám Sát Hoạt Động

Tài liệu này hướng dẫn các bước chạy Docker Compose, định tuyến tên miền bằng Cloudflare Tunnel và giám sát tài nguyên của hệ thống trên máy ảo Oracle Cloud VM.

---

## 🚀 1. Khởi Chạy Các Dịch Vụ Microservices Bằng Docker Compose

### Bước 1.1: Chuẩn bị thư mục dữ liệu trên Block Volume
Để dữ liệu của cơ sở dữ liệu PostgreSQL và MinIO ghi trực tiếp vào ổ cứng Block Volume 100GB đã mount ở Giai đoạn 1:
1. Đăng nhập SSH vào máy ảo bằng user `opc`.
2. Tạo thư mục dữ liệu trên ổ cứng Block Volume:
   ```bash
   sudo mkdir -p /mnt/socialhub-storage/docker-data
   sudo chown -R opc:opc /mnt/socialhub-storage/docker-data
   ```
3. Clone mã nguồn dự án về thư mục home của user `opc`:
   ```bash
   cd ~
   git clone https://github.com/<your-username>/SocialHub_Microservices.git
   cd SocialHub_Microservices
   ```
4. Tạo một liên kết mềm (Symlink) từ thư mục dự án trỏ vào ổ Block Volume để Docker tự ghi dữ liệu sang đó:
   ```bash
   ln -s /mnt/socialhub-storage/docker-data ./docker-data
   ```

### Bước 1.2: Chuẩn bị tệp cấu hình `.env`
1. Tạo tệp `.env` từ tệp ví dụ:
   ```bash
   cp .env.example .env
   ```
2. Mở file và điền cấu hình Production của bạn (Xem lại **Giai đoạn 2** để biết cách mã hóa Base64 cho các secrets kết nối):
   ```bash
   nano .env
   ```
   *(Nhập thông tin kết nối PostgreSQL, MongoDB Atlas, MinIO, JWT, và TURN Server. Bấm Ctrl+O để lưu, Ctrl+X để thoát).*

### Bước 1.3: Chạy hệ thống
Chạy lệnh pull các image mới nhất và khởi động hệ thống dưới chế độ chạy nền:
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## 🌐 2. Định Tuyến Tên Miền Bằng Cloudflare Tunnel (Zero Trust)

Dự án đã tích hợp sẵn thư mục `cloudfare-tunnel` chứa tệp cấu hình và docker-compose riêng cho Cloudflared. Chúng ta sẽ chạy container này để kết nối mạng ứng dụng Docker nội bộ của VM với Cloudflare Zero Trust.

### Bước 2.1: Lấy Token Đường Hầm
1. Đăng nhập vào [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com).
2. Vào **Access** -> **Tunnels** -> Nhấp **Create a tunnel**.
3. Chọn loại **Cloudflared (Docker)**, đặt tên đường hầm (ví dụ: `socialhub-tunnel`) và lưu.
4. Hệ thống sẽ cấp một đoạn mã chạy Docker. Hãy copy chuỗi **Token mã hóa** ở cuối câu lệnh đó (ví dụ: `eyJhIjoi...`).

### Bước 2.2: Kích hoạt Tunnel trên VM
1. Trên VM, di chuyển vào thư mục tunnel của dự án:
   ```bash
   cd ~/SocialHub_Microservices/cloudfare-tunnel
   ```
2. Cập nhật Token bí mật của bạn vào tệp `.env` bên trong thư mục này (Lưu ý: Tệp `.env` này được quản lý riêng và không đẩy lên Git):
   ```bash
   echo "CLOUDFLARE_TUNNEL_TOKEN=dán_token_của_bạn_vào_đây" > .env
   ```
3. Khởi tạo mạng Docker external (nếu chưa có):
   ```bash
   docker network create socialhub_app-network || true
   ```
4. Chạy container Cloudflared Tunnel:
   ```bash
   docker compose up -d
   ```

### Bước 2.3: Định tuyến tên miền con (Public Hostnames) trên Cloudflare web
Quay lại trang cấu hình Tunnel trên web Cloudflare Zero Trust, chọn **Public Hostname** -> Click **Add a public hostname** để định tuyến:

1. **API Gateway**:
   - Subdomain: `api`
   - Domain: `yourdomain.com` (chọn tên miền của bạn)
   - Service: **`HTTP`**
   - URL: **`gateway:8000`**
2. **Media Service (Direct Route cho Reels)**:
   - Subdomain: `media`
   - Domain: `yourdomain.com`
   - Service: **`HTTP`**
   - URL: **`media-service:5000`**

---

## 🛠️ 3. Kiểm Tra & Giám Sát Tài Nguyên

### Kiểm tra trạng thái các Container
```bash
docker compose -f docker-compose.prod.yml ps
```

### Xem mức độ tiêu thụ CPU / RAM thực tế
```bash
docker stats
```
*(Nếu thấy RAM của dịch vụ nào tăng đột biến, hãy kiểm tra logs dịch vụ đó).*

### Xem logs lỗi hệ thống
Do tuân thủ quy tắc tối ưu logs ở production để tiết kiệm dung lượng đĩa, các log info đã bị tắt. Để giám sát lỗi phát sinh thực tế:
```bash
docker compose -f docker-compose.prod.yml logs -f | grep -i error
```
