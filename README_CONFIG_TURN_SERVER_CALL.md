# Hướng dẫn Thiết lập Coturn Server (STUN/TURN) bằng Docker

Tài liệu này hướng dẫn bạn chi tiết cách thiết lập máy chủ STUN/TURN bằng hai phương pháp tối ưu nhất hiện nay: **Cách 1: Tự host miễn phí trên Oracle Cloud (Always Free)** và **Cách 2: Sử dụng dịch vụ đám mây miễn phí của Metered.ca**.

---

## PHƯƠNG ÁN A: Tự Host Coturn trên Oracle Cloud (Always Free Tier)

Oracle Cloud Infrastructure (OCI) là nhà cung cấp cloud hào phóng nhất hiện nay với chương trình **Always Free Tier**. Đây là lựa chọn hoàn hảo để chạy Coturn Server trọn đời mà không tốn một đồng chi phí nào.

### 1. Hạn mức (Quota) miễn phí của Oracle Cloud và Khả năng đáp ứng
Chương trình **Always Free** cung cấp:
- **Máy ảo AMD (VM.Standard.E2.1.Micro)**: 2 máy ảo, mỗi máy có 1/8 OCPU (tương đương 1 thread CPU Intel/AMD) và **1 GB RAM**.
- **Máy ảo ARM Ampere (VM.Standard.A1.Flex)**: Tối đa 4 OCPU và **24 GB RAM** (có thể chia nhỏ tối đa thành 4 máy ảo).
- **Băng thông miễn phí (Outbound Data Transfer)**: **10 TB/tháng** (thoải mái cho hàng ngàn cuộc gọi).

#### Máy ảo AMD Standard.E2.1.Micro (1 GB RAM) có đủ chạy Coturn không?
> [!TIP]
> **HOÀN TOÀN ĐỦ và RẤT MẠNH MẼ**.
> Coturn là dịch vụ được viết bằng ngôn ngữ C/C++, cực kỳ tối ưu hóa hiệu năng và tiêu tốn rất ít tài nguyên.
> - **RAM tiêu thụ**: Chỉ khoảng **20MB - 50MB RAM** khi hoạt động.
> - **CPU tiêu thụ**: Gần như 0% khi nhàn rỗi, và chỉ khoảng 5% - 10% CPU khi có 20-30 cuộc gọi đồng thời.
> - Do đó, bạn nên để dành cấu hình máy ảo ARM mạnh mẽ cho các tác vụ khác (như Deploy Kubernetes GKE/Docker app) và sử dụng máy ảo AMD Micro (1GB RAM) này để chạy riêng Coturn.

---

### 2. Các bước triển khai Coturn trên Oracle Cloud

#### Bước 2.1: Tạo máy ảo (Compute Instance)
1. Đăng ký/Đăng nhập vào Oracle Cloud Console.
2. Tạo một Compute Instance mới:
   - **Image**: Chọn **Ubuntu** (phiên bản mới nhất, ví dụ Ubuntu 22.04 LTS).
   - **Shape**: Chọn **VM.Standard.E2.1.Micro** (Always Free Eligible).
   - **Network**: Tạo một Virtual Cloud Network (VCN) mới và Subnet công cộng mặc định. Đảm bảo chọn **Assign a public IPv4 address** để lấy IP công cộng.
   - **SSH Keys**: Tải file private key về máy để SSH.

---

#### Bước 2.2: Cấu hình mở cổng (Ingress Rules) trên Web Dashboard
Mặc định, Oracle Cloud khóa toàn bộ cổng kết nối đi vào ngoại trừ cổng 22 (SSH). Bạn phải mở cổng cho Coturn trên OCI:
1. Vào chi tiết Máy ảo -> Click vào Subnet của máy ảo -> Click vào **Default Security List**.
2. Chọn **Add Ingress Rules** để thêm các luật cho phép đi vào:
   
   * **Rule 1 (Cổng STUN/TURN chính)**:
     - **Source Type**: `CIDR`
     - **Source CIDR**: `0.0.0.0/0` (Tất cả nguồn)
     - **IP Protocol**: `UDP`
     - **Destination Port Range**: `3478`
   
   * **Rule 2 (Cổng STUN/TURN phụ hoặc dự phòng)**:
     - **Source Type**: `CIDR`
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `TCP`
     - **Destination Port Range**: `3478`

   * **Rule 3 (Dải cổng chuyển tiếp Media)**:
     - **Source Type**: `CIDR`
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `UDP`
     - **Destination Port Range**: `49152-49200` *(Chúng ta thu hẹp dải cổng này lại thành 50 cổng để dễ quản lý và bảo mật thay vì dải mặc định quá rộng).*

---

#### Bước 2.3: SSH vào máy ảo và mở cổng tường lửa trong hệ điều hành (Ubuntu Firewall)
> [!IMPORTANT]
> **ĐÂY LÀ LỖI PHỔ BIẾN NHẤT**: Oracle Cloud có sẵn một lớp tường lửa mặc định bên trong hệ điều hành (IPTables/UFW). Bạn phải mở các cổng này trong Ubuntu nữa thì máy ảo mới nhận được traffic.
> Hãy chạy các lệnh sau sau khi SSH thành công:

```bash
# Cập nhật và cài đặt Docker
sudo apt update && sudo apt install -y docker.io docker-compose

# Mở cổng UFW (nếu Ubuntu đang bật UFW)
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:49200/udp

# Mở cổng IPTables (Bắt buộc với mạng Oracle Cloud)
sudo iptables -I INPUT 6 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 6 -p udp --dport 49152:49200 -j ACCEPT

# Lưu lại cấu hình IPTables để không bị mất khi restart máy ảo
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

---

#### Bước 2.4: Khởi chạy Coturn bằng Docker
Tạo file `/opt/coturn/turnserver.conf` trên máy ảo:
```ini
listening-port=3478
fingerprint
lt-cred-mech
realm=api-local.socialhubzz.cloud
user=socialhub_user:socialhub_secret_pass
min-port=49152
max-port=49200 # Khớp với dải cổng đã mở trên Firewall
no-cli
no-multicast-peers
```

Khởi chạy bằng Docker Command:
```bash
sudo docker run -d \
  --name coturn-server \
  --network host \
  --restart always \
  -v /opt/coturn/turnserver.conf:/etc/coturn/turnserver.conf \
  coturn/coturn
```

---

#### Bước 2.5: Cấu hình DNS trên Cloudflare
1. Đăng nhập vào Cloudflare.
2. Tại tên miền `socialhubzz.cloud`, tạo một bản ghi **A Record**:
   - **Name**: `turn` (để tạo tên miền phụ `turn.socialhubzz.cloud`)
   - **IPv4 Address**: Nhập IP công cộng của máy ảo Oracle Cloud.
   - **Proxy status**: **TẮT ĐÁM MÂY MÀU CAM** (chuyển sang màu xám - **DNS Only**). Điều này bắt buộc để Cloudflare không can thiệp và chặn các gói tin UDP.

---

## PHƯƠNG ÁN B: Sử dụng dịch vụ TURN Server của Metered.ca (Free 50GB/Tháng)

Nếu bạn không muốn thiết lập máy chủ và quản lý cổng mạng phức tạp, bạn có thể sử dụng dịch vụ đám mây miễn phí chất lượng cao của **Metered.ca**.

### 1. Đăng ký tài khoản
1. Truy cập trang web: [https://www.metered.ca/](https://www.metered.ca/)
2. Đăng ký một tài khoản miễn phí (chọn gói **Free Tier** có sẵn 50 GB băng thông hàng tháng - rất thoải mái cho môi trường phát triển và thử nghiệm).
3. Đăng nhập vào Dashboard của Metered.

### 2. Lấy thông tin cấu hình
1. Tại Dashboard, click vào **App Settings** hoặc **WebRTC TURN Servers**.
2. Click **Create Application** (nếu chưa có).
3. Hệ thống sẽ hiển thị một danh sách các máy chủ ICE bao gồm cả STUN và TURN với thông tin đăng nhập tự động. Nó sẽ trông tương tự như sau:
   - **STUN**: `stun:global.turn.metered.ca:80`
   - **TURN (UDP)**: `turn:global.turn.metered.ca:8678` (hoặc cổng 443)
   - **Username**: `được tạo tự động`
   - **Password (Credential)**: `được tạo tự động`

---

## Tích hợp cấu hình vào Source Code Frontend

Mở file [CallWindow.jsx](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/components/CallWindow.jsx) trong source code frontend của bạn và thay thế biến `ICE_SERVERS` tương ứng với phương án bạn chọn:

### Cấu hình cho máy chủ tự host Oracle Cloud (Phương án A):
```javascript
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Cấu hình máy chủ Coturn tự host trên Oracle Cloud:
        {
            urls: "turn:turn.socialhubzz.cloud:3478",
            username: "socialhub_user",
            credential: "socialhub_secret_pass"
        }
    ]
};
```

### Cấu hình cho dịch vụ Metered.ca (Phương án B):
```javascript
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:global.turn.metered.ca:80" },
        {
            urls: "turn:global.turn.metered.ca:8678?transport=udp",
            username: "dien_username_tu_metered_vao_day",
            credential: "dien_password_tu_metered_vao_day"
        },
        {
            urls: "turn:global.turn.metered.ca:443?transport=tcp",
            username: "dien_username_tu_metered_vao_day",
            credential: "dien_password_tu_metered_vao_day"
        }
    ]
};
```

---

## Cách kiểm tra (Test) xem TURN có chạy được hay không
1. Mở trang WebRTC test: [Trickle ICE Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
2. Nhập thông tin TURN Server của bạn vào biểu mẫu trên trang web.
3. Bấm **Add Server** -> **Gather candidates**.
4. Kiểm tra cột **Type** ở bảng kết quả: Nếu xuất hiện bản ghi có type là **`relay`**, chúc mừng bạn, TURN Server của bạn đang hoạt động cực kỳ hoàn hảo!
