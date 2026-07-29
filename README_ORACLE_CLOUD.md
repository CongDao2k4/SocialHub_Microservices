# Hướng Dẫn Triển Khai SocialHub Microservices trên Oracle Cloud Infrastructure (OCI)

Tài liệu này hướng dẫn chi tiết từ A-Z cách thiết lập máy ảo, phân vùng lưu trữ (Block Volume), cài đặt Docker, mở cổng tường lửa mạng, và chạy hệ thống bằng Docker Compose trên gói **Always Free Tier** của Oracle Cloud (áp dụng cho máy ảo **6GB RAM**).

---

## 📐 1. Kiến Trúc Triển Khai (Single-VM Deployment)

Thay vì sử dụng Kubernetes (OKE/GKE) đắt đỏ và phức tạp, toàn bộ hệ thống được chạy gọn gàng bằng **Docker Compose** trên 1 máy ảo duy nhất. Frontend được lưu trữ trên **Vercel** và kết nối an toàn về VM thông qua **Cloudflare Tunnel** (đường hầm không cần mở port public của Gateway, giảm thiểu nguy cơ bị tấn công DDoS/Brute Force).

```mermaid
flowchart TD
    subgraph Client ["Client Browser (WebRTC)"]
        A[Frontend Web App - Vercel]
    end

    subgraph CF_Network ["Cloudflare Network"]
        Tunnel["Cloudflare Tunnel (Zero Trust)"]
        CF_DNS["turn.yourdomain.com (DNS Only)"]
    end

    subgraph OCI_VM ["Oracle Cloud VM (6GB RAM)"]
        subgraph Docker_Network ["Docker app-network"]
            C_Tunnel["Docker: cloudflared"]
            Gateway["gateway (8000)"]
            Media["media-service (5000)"]
            Chat["chat-service (5000)"]
            PG["pg (PostgreSQL 16)"]
            Mongo["mongo (MongoDB 7)"]
            Redis["redis (Redis 7)"]
            MinIO["minio (9000/9001)"]
            RabbitMQ["rabbitmq (5672)"]
        end

        subgraph Host_Storage ["Storage (Block Volume - XFS/ext4)"]
            Data["/mnt/socialhub-storage/docker-data/"]
        end
        
        Coturn["Docker: coturn (host port 3478)"]
    end

    A -->|1. Gọi API / Stream Media| Tunnel
    Tunnel -->|Chuyển tiếp mã hóa| C_Tunnel
    C_Tunnel -->|Forward nội bộ| Gateway
    C_Tunnel -->|Direct Bypass Reels| Media

    A -.->|2. Hỏi DNS TURN| CF_DNS
    CF_DNS -.->|Trỏ trực tiếp về IP tĩnh VM| A
    A -->|3. Kết nối STUN/TURN (UDP 3478)| Coturn
    A -->|4. Truyền tải Media (UDP 49152-49200)| Coturn

    PG & Mongo & Redis & MinIO & RabbitMQ -->|Ghi dữ liệu liên tục| Data
```

---

## ☁️ 2. Thiết Lập Máy Ảo (Compute Instance) & IP Tĩnh

### Bước 2.1: Khởi tạo Compute Instance
1. Đăng nhập vào [Oracle Cloud Console](https://cloud.oracle.com/).
2. Chọn **Compute** -> **Instances** -> Chọn **Create Instance**.
3. Cấu hình máy ảo như sau:
   - **Name**: `socialhub-production-vm`
   - **Image**: Chọn **Ubuntu** (Khuyên dùng bản LTS mới nhất như `Ubuntu 22.04` hoặc `Ubuntu 24.04`).
   - **Shape**: Chọn **Ampere (ARM)** -> **VM.Standard.A1.Flex** -> Chọn **1 OCPU** và **6 GB RAM** (nằm trong hạn mức Always Free miễn phí trọn đời).
   - **Networking**:
     - Chọn *Create a new Virtual Cloud Network (VCN)*.
     - Chọn *Create a new public subnet*.
     - Đảm bảo chọn **Yes** tại mục *Assign a public IPv4 address*.
   - **SSH Keys**: Click **Save private key** để tải tệp khóa `.key` về máy tính của bạn (rất quan trọng để SSH vào máy ảo).
   - **Boot Volume**: Giữ mặc định.
4. Click **Create** để khởi tạo máy ảo.

### Bước 2.2: Gắn Địa Chỉ IP Tĩnh Công Cộng (Reserved Public IP)
Để IP của máy chủ không bị thay đổi khi bạn restart máy ảo, ta cần chuyển IP tạm thời thành IP tĩnh cố định:
1. Trên thanh tìm kiếm OCI Console, tìm và truy cập **Reserved Public IPs**.
2. Click **Reserve Public IP Address**:
   - **Name**: `socialhub-reserved-ip`
   - Chọn Compartment của bạn.
3. Nhấp **Reserve**.
4. Gắn IP này vào máy ảo của bạn bằng cách:
   - Vào chi tiết máy ảo mới tạo -> Chọn **Attached VNICs** (ở menu bên trái dưới cùng).
   - Click vào VNIC chính hiển thị trong danh sách.
   - Vào tab **IPv4 Addresses** -> Click dấu 3 chấm bên cạnh Private IP hiện tại -> Chọn **Edit**.
   - Tại mục **Public IP Type**, chọn **No Public IP** -> Nhấn **Update** (để gỡ IP động cũ).
   - Làm lại bước Edit trên -> Chọn **Authorized Public IP** -> Chọn **Reserved Public IP** vừa tạo ở danh sách -> Chọn đúng tên `socialhub-reserved-ip` -> Nhấn **Update** để gắn IP tĩnh cố định.

---

## 💾 3. Cấu Hình Ổ Cứng Lưu Trữ (Block Volume)

Gói Always Free cấp cho bạn **200GB** dung lượng lưu trữ miễn phí. Để đảm bảo dữ liệu (đặc biệt là tệp phân đoạn video HLS `.ts` từ MinIO và dữ liệu cơ sở dữ liệu) được an toàn và không làm nghẽn đĩa boot hệ thống:

### Bước 3.1: Tạo Block Volume trên OCI Console
1. Chọn **Storage** -> **Block Volumes** -> Nhấn **Create Block Volume**.
2. Thiết lập:
   - **Name**: `socialhub-database-volume`
   - **Size**: `50 GB` đến `100 GB` (tùy nhu cầu của bạn).
3. Nhấn **Create Block Volume**.

### Bước 3.2: Gắn Block Volume vào Máy Ảo
1. Vào chi tiết máy ảo của bạn -> Kéo xuống menu bên trái chọn **Attached Block Volumes**.
2. Nhấp **Attach Block Volume**.
3. Cấu hình:
   - **Volume**: Chọn đúng tên `socialhub-database-volume`.
   - **Attachment Type**: Chọn **Paravirtualized** (để hệ điều hành tự động nhận diện mà không cần cấu hình lệnh iSCSI phức tạp).
   - **Access Type**: `Read/Write`.
4. Nhấn **Attach**. Đợi trạng thái chuyển sang màu xanh lá (**Attached**).

### Bước 3.3: Định Dạng và Mount Ổ Cứng Trên Máy Ảo
1. SSH vào máy ảo của bạn bằng file key đã tải về:
   ```bash
   ssh -i <path-to-key-file> ubuntu@<IP_TINH_VM>
   ```
2. Kiểm tra tên phân vùng ổ cứng mới được gắn vào bằng lệnh:
   ```bash
   lsblk
   ```
   *Bạn sẽ thấy một ổ cứng mới có dung lượng khớp với Block Volume vừa tạo (thường tên là `/dev/sdb` hoặc `/dev/oracleoci/oraclevdb`).*
3. Tiến hành định dạng phân vùng ổ cứng bằng hệ thống tệp **ext4** hoặc **XFS** (XFS rất mạnh mẽ khi xử lý hàng triệu file nhỏ như HLS segment `.ts` của video Reels):
   ```bash
   # Định dạng bằng ext4
   sudo mkfs.ext4 /dev/sdb
   ```
4. Tạo thư mục mount và mount ổ cứng:
   ```bash
   sudo mkdir -p /mnt/socialhub-storage
   sudo mount /dev/sdb /mnt/socialhub-storage
   ```
5. Cấu hình mount tự động khi khởi động lại máy ảo:
   - Lấy mã UUID của ổ cứng mới bằng lệnh:
     ```bash
     sudo blkid /dev/sdb
     ```
     *(Copy đoạn chuỗi UUID="..." lại)*
   - Mở file cấu hình fstab:
     ```bash
     sudo nano /etc/fstab
     ```
   - Thêm dòng sau vào cuối file (thay UUID bằng chuỗi bạn vừa copy):
     ```text
     UUID=chuoi-uuid-cua-ban /mnt/socialhub-storage ext4 defaults,noatime,_netdev 0 2
     ```
   - Nhấn `Ctrl + O` để lưu, và `Ctrl + X` để thoát. Kiểm tra cấu hình mount bằng cách chạy:
     ```bash
     sudo mount -a
     ```
     Nếu không xuất hiện lỗi gì nghĩa là cấu hình mount tự động đã thành công!

---

## 🐳 4. Cài Đặt Docker, Docker Compose & Tạo RAM Ảo (Swap)

### Bước 4.1: Tạo Swap Space 4GB (Bắt buộc)
Với máy ảo 6GB RAM, khi chạy đồng thời 12 containers cùng với các tác vụ ffmpeg convert video nặng, RAM vật lý có thể bị quá tải. Swap space đóng vai trò là RAM ảo giúp hệ thống chạy ổn định 24/7 mà không bị lỗi treo máy (OOM):

```bash
# 1. Tạo file swap dung lượng 4GB
sudo fallocate -l 4G /swapfile

# 2. Phân quyền chỉ cho tài khoản root
sudo chmod 600 /swapfile

# 3. Định dạng phân vùng swap
sudo mkswap /swapfile

# 4. Kích hoạt swap
sudo swapon /swapfile

# 5. Lưu cấu hình tự động bật swap khi khởi động lại máy ảo
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 6. Kiểm tra lại phân vùng swap hoạt động chưa
free -h
```

### Bước 4.2: Cài Đặt Docker & Docker Compose
Chạy chuỗi lệnh sau để cài đặt Docker Engine chính thức trên Ubuntu:

```bash
# Cập nhật danh sách gói
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Thêm khóa GPG chính thức của Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Cài đặt kho lưu trữ Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

# Cài đặt các gói Docker CE và Docker Compose plugin
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Khởi động dịch vụ Docker
sudo systemctl start docker
sudo systemctl enable docker

# Thêm user hiện tại vào nhóm docker để chạy không cần sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## 🔒 5. Cấu Hình Tường Lửa & IP Mạng (Security List & iptables)

Mặc định, Oracle Cloud chặn toàn bộ kết nối đi vào máy ảo ngoại trừ cổng 22 (SSH). Chúng ta cần mở các cổng mạng để phục vụ cho các kết nối trực tiếp đến TURN server (dùng cho Video/Voice call).

### Bước 5.1: Mở cổng trên trang web OCI Console (Security List)
1. Vào chi tiết Máy ảo -> Click vào tên **Subnet** trong phần thông tin **Networking**.
2. Click vào **Default Security List for...**.
3. Nhấp nút **Add Ingress Rules** và thêm lần lượt 3 quy tắc sau:

| Source CIDR | Protocol | Destination Port Range | Mô tả |
| :--- | :--- | :--- | :--- |
| `0.0.0.0/0` | **UDP** | `3478` | Cổng kết nối STUN/TURN |
| `0.0.0.0/0` | **TCP** | `3478` | Cổng kết nối STUN/TURN |
| `0.0.0.0/0` | **UDP** | `49152-49200` | Dải cổng truyền tải Media WebRTC (video/voice) |

4. Nhấn **Add Ingress Rules** để hoàn tất cấu hình.

### Bước 5.2: Mở cổng nội bộ hệ điều hành (Ubuntu UFW)
Hệ điều hành Ubuntu mặc định trên Oracle Cloud cũng khóa các cổng bằng tường lửa UFW tích hợp sẵn. Hãy mở các cổng này trên máy ảo:

```bash
# Mở cổng STUN/TURN
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp

# Mở cổng dải truyền tải WebRTC Media
sudo ufw allow 49152:49200/udp

# Bật UFW (nếu chưa bật)
sudo ufw enable
```

---

## 🚀 6. Triển Khai Source Code Bằng Docker Compose

### Bước 6.1: Chuẩn Bị Thư Mục Dữ Liệu
Để dữ liệu của Docker compose lưu trực tiếp vào Block Volume ta đã mount ở Bước 3:
1. Tạo thư mục dữ liệu trên Block Volume:
   ```bash
   mkdir -p /mnt/socialhub-storage/docker-data
   ```
2. Clone dự án SocialHub về máy ảo:
   ```bash
   cd ~
   git clone https://github.com/<your-username>/SocialHub_Microservices.git
   cd SocialHub_Microservices
   ```
3. Tạo một liên kết mềm (Symlink) từ thư mục dự án trỏ vào ổ Block Volume để Docker ghi thẳng dữ liệu sang đó:
   ```bash
   ln -s /mnt/socialhub-storage/docker-data ./docker-data
   ```

### Bước 6.2: Khởi tạo tệp cấu hình môi trường `.env`
1. Tạo file `.env` từ file ví dụ:
   ```bash
   cp .env.example .env
   ```
2. Chỉnh sửa file `.env` để phù hợp với môi trường Production của bạn:
   ```bash
   nano .env
   ```
   *Thiết lập các biến môi trường chính:*
   ```env
   ENVIRONMENT=production
   JWT_SECRET=thay-doi-mat-khau-jwt-khi-production-an-toan
   JWT_REFRESH_SECRET=thay-doi-mat-khau-refresh-jwt-an-toan

   # Thông tin kết nối TURN Server (đã tạo ở tài liệu TURN Oracle)
   TURN_URL=turn:turn.yourdomain.com:3478
   TURN_USERNAME=socialhub_user
   TURN_CREDENTIAL=socialhub_secret_pass
   ```

### Bước 6.3: Khởi chạy hệ thống Microservices
Chạy lệnh đóng gói và khởi chạy toàn bộ 12 dịch vụ:
```bash
docker compose up -d --build
```
Kiểm tra trạng thái hoạt động của các container:
```bash
docker compose ps
```
Xem log của một dịch vụ bất kỳ (ví dụ gateway):
```bash
docker compose logs -f gateway
```

---

## 🌐 7. Cấu Hình Cloudflare Tunnel Cho Frontend Trên Vercel

Chúng ta sử dụng **Cloudflare Tunnel** chạy trong Docker container để chuyển tiếp các truy vấn từ tên miền của bạn về đúng các dịch vụ tương ứng trên máy ảo mà không cần mở public cổng 8080 (Gateway) hay 5005 (Media Service) ra ngoài Internet.

### Bước 7.1: Tạo Đường Hầm Trên Cloudflare Zero Trust
1. Truy cập vào trang quản trị [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com).
2. Chọn **Access** -> **Tunnels** -> Click **Create a tunnel**.
3. Đặt tên đường hầm (ví dụ: `socialhub-oracle-tunnel`) -> Click **Save tunnel**.
4. Tại phần cài đặt Connector:
   - Chọn **Docker**.
   - Hệ thống hiển thị một đoạn mã lệnh chứa token bí mật, trông như sau:
     ```bash
     docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <CHUOI_TOKEN_BI_MAT>
     ```
   - Hãy sao chép chuỗi **`<CHUOI_TOKEN_BI_MAT>`** này để thiết lập.

### Bước 7.2: Khởi Chạy Tunnel Trên Máy Ảo
1. Trên máy ảo Oracle VM, di chuyển vào thư mục tunnel của dự án:
   ```bash
   cd ~/SocialHub_Microservices/cloudfare-tunnel
   ```
2. Tạo file `.env` chứa token bí mật vừa lấy:
   ```bash
   echo "CLOUDFLARE_TUNNEL_TOKEN=<CHUOI_TOKEN_BI_MAT>" > .env
   ```
3. Khởi tạo mạng Docker external nếu chưa có:
   ```bash
   docker network create socialhub_app-network || true
   ```
4. Khởi chạy container tunnel:
   ```bash
   docker compose up -d
   ```
   *(Container tunnel này sẽ kết nối trực tiếp đến mạng `socialhub_app-network` và chuyển tiếp dữ liệu đến API Gateway)*.

### Bước 7.3: Định Tuyến Tên Miền (Public Hostnames) Trên Cloudflare
Quay lại trang cấu hình Tunnel trên giao diện web của Cloudflare Zero Trust, chọn **Public Hostname** -> Click **Add a public hostname** để định tuyến 2 tên miền con:

#### 1. Hostname cho API Gateway:
- **Subdomain**: `api` (hoặc `api-prod`)
- **Domain**: Chọn tên miền của bạn (ví dụ `yourdomain.com`)
- **Service**: Chọn loại **`HTTP`**
- **URL**: **`gateway:8000`** *(Docker DNS tự phân giải tên dịch vụ trong mạng)*
- Nhấn **Save**.

#### 2. Hostname cho Media Service (Direct Bypass - giúp Reels load cực mượt):
- **Subdomain**: `media` (hoặc `media-prod`)
- **Domain**: Chọn tên miền của bạn
- **Service**: Chọn loại **`HTTP`**
- **URL**: **`media-service:5000`** *(Direct bypass gateway giúp video không bị thắt nút cổ chai)*
- Nhấn **Save**.

### Bước 7.4: Thiết Lập Biến Môi Trường Trên Vercel
Khi deploy Frontend lên Vercel, bạn vào **Project Settings** -> **Environment Variables** và cấu hình 2 biến môi trường sau:
1. `VITE_API_URL` = `https://api.yourdomain.com/api`
2. `VITE_MEDIA_URL` = `https://media.yourdomain.com`

Tiến hành **Redeploy** lại ứng dụng trên Vercel để áp dụng cấu hình tên miền mới.

---

## 🛠️ 8. Kiểm Tra & Giám Sát Sau Triển Khai

1. **Kiểm tra tài nguyên sử dụng**:
   Xem mức độ CPU/RAM thực tế của từng microservices trên VM:
   ```bash
   docker stats
   ```
2. **Kiểm tra dung lượng đĩa còn trống**:
   Đảm bảo dữ liệu đang ghi chính xác vào Block Volume gắn ngoài (`/mnt/socialhub-storage`):
   ```bash
   df -h /mnt/socialhub-storage
   ```
3. **Xem Logs lỗi trên production**:
   Do tuân thủ quy tắc logs tối ưu chi phí, các log thông thường đã bị ẩn. Để xem các log lỗi thực tế phát sinh:
   ```bash
   docker compose logs -f | grep -i error
   ```
