# Hướng dẫn Thiết lập Coturn Server (STUN/TURN) trên Google Cloud Platform & Cloudflare

Tài liệu này hướng dẫn chi tiết cách tự host một máy chủ STUN/TURN (Coturn) trên Google Cloud Platform (GCP) Compute Engine để phục vụ tính năng gọi Video và Voice call cho dự án **SocialHub Microservices** đang chạy trên cụm GKE. Đồng thời hướng dẫn cách cấu hình Cloudflare miễn phí mà không cần trả phí cho lưu lượng UDP.

---

## ☁️ 1. Giải đáp thắc mắc: Cloudflare và Gói dịch vụ hỗ trợ UDP

> [!IMPORTANT]
> **KHÔNG CẦN mua gói trả phí nào của Cloudflare để chạy UDP cho TURN Server!**
> - Mặc định, tính năng Proxy của Cloudflare (đám mây màu cam 🟠) chỉ hỗ trợ HTTP/HTTPS. Để chuyển tiếp UDP/TCP tùy ý qua mạng proxy của họ, Cloudflare yêu cầu dịch vụ **Cloudflare Spectrum** (chỉ có trên gói Enterprise hoặc các gói trả phí đắt đỏ).
> - **Tuy nhiên, đối với WebRTC (Video/Voice Call)**: Các trình duyệt của người dùng (WebRTC Client) cần kết nối trực tiếp đến IP của TURN Server bằng giao thức UDP/TCP nguyên bản để truyền tải hình ảnh/âm thanh mà không qua bất kỳ proxy trung gian nào (tránh làm tăng độ trễ cuộc gọi).
> - **Giải pháp tối ưu và miễn phí**: Ta chỉ cấu hình bản ghi DNS của TURN Server trên Cloudflare ở trạng thái **DNS Only (Đám mây màu xám 🔘)**. 
>   * Khi đó, Cloudflare chỉ đóng vai trò phân giải tên miền (ví dụ: `turn.yourdomain.com` -> IP của VM).
>   * Các gói tin UDP của cuộc gọi sẽ đi thẳng từ trình duyệt của người dùng tới VM trên Google Cloud.
>   * Việc này **hoàn toàn miễn phí 100%** và là cách thiết lập tiêu chuẩn cho tất cả các hệ thống WebRTC trên thế giới.

---

## 📐 2. Mô hình Kiến trúc Kết nối

```mermaid
flowchart TD
    subgraph Client ["Client Browser (WebRTC)"]
        A[Frontend Web App]
    end

    subgraph Cloudflare ["Cloudflare DNS Only"]
        B["turn.yourdomain.com (A Record - Gray Cloud)"]
    end

    subgraph GCP ["Google Cloud Platform (GCP)"]
        subgraph GKE ["GKE Cluster (SocialHub App)"]
            C[Frontend Service]
            D[Gateway / Backend Services]
        end
        subgraph GCE ["Compute Engine (Coturn VM)"]
            E[Docker: Coturn Container]
        end
    end

    A -->|1. Đăng nhập / Bắt đầu gọi| C
    A -.->|2. Hỏi DNS IP của TURN| B
    B -.->|Trỏ về IP của GCE VM| A
    A -->|3. Kết nối STUN/TURN (UDP port 3478)| E
    A -->|4. Truyền tải Media (UDP ports 49152-49200)| E
    E -->|Relay Media tới Peer khác| Client
```

---

## 🛠️ 3. Các Bước Thiết Lập Coturn Trên Google Cloud Platform (GCP)

### Bước 3.1: Tạo Máy ảo Compute Engine (GCE VM)
1. Đăng nhập vào [Google Cloud Console](https://console.cloud.google.com/).
2. Chọn dự án của bạn và tìm đến mục **Compute Engine** -> **VM instances**.
3. Nhấp vào **Create Instance** (Tạo máy ảo):
   - **Name**: `socialhub-coturn-vm`
   - **Region & Zone**: Chọn khu vực gần người dùng của bạn nhất (ví dụ: `asia-east1` - Đài Loan hoặc `asia-southeast1` - Singapore).
   - **Machine configuration**:
     - **Series**: `E2`
     - **Machine type**: `e2-micro` (2 vCPU, 1 GB RAM). 
       > [!TIP]
       > Cấu hình `e2-micro` cực kỳ rẻ (~$7-8/tháng) hoặc miễn phí nếu tài khoản của bạn nằm trong chương trình GCP Free Tier. Coturn được viết bằng C/C++ nên cực kỳ nhẹ, chỉ tiêu tốn khoảng 30MB-50MB RAM và 1-5% CPU cho các cuộc gọi thông thường.
   - **Boot disk**:
     - **Operating system**: `Ubuntu`
     - **Version**: `Ubuntu 22.04 LTS` hoặc `Ubuntu 24.04 LTS` (x86/64).
   - **Firewall**: Để trống (Chúng ta sẽ cấu hình Firewall ở mức VPC Network bên dưới).
4. Nhấp **Create** để khởi tạo máy ảo.

---

### Bước 3.2: Cấu hình Địa chỉ IP Tĩnh (Static External IP)
Mặc định, IP ngoại vi (External IP) của GCE VM là IP động (Ephemeral). Nếu máy ảo khởi động lại, IP này sẽ thay đổi, khiến DNS bị lỗi. Bạn cần chuyển nó thành IP tĩnh:
1. Trên GCP Console, vào **VPC Network** -> **IP addresses**.
2. Tìm địa chỉ IP ngoại vi của máy ảo `socialhub-coturn-vm`.
3. Tại cột **Type**, đổi trạng thái từ **Ephemeral** thành **Static**.
4. Nhập tên gợi nhớ (ví dụ: `socialhub-coturn-static-ip`) và nhấn **Reserve**.
5. Copy lại địa chỉ IP này để cấu hình DNS trên Cloudflare sau này.

---

### Bước 3.3: Mở cổng trên GCP VPC Firewall Rules
Bạn phải cho phép lưu lượng truy cập đi qua tường lửa của Google Cloud vào máy ảo:
1. Vào **VPC Network** -> **Firewall**.
2. Nhấp vào **Create Firewall Rule** (Tạo quy tắc tường lửa):
   - **Name**: `allow-coturn-media-relay`
   - **Network**: `default`
   - **Priority**: `1000`
   - **Direction of traffic**: `Ingress` (Lưu lượng đi vào)
   - **Action on match**: `Allow`
   - **Targets**: `All instances in the network` (Hoặc chọn `Specified target tags` và thêm tag `coturn-server` vào VM của bạn).
   - **Source filter**: `IPv4 ranges`
   - **Source IPv4 ranges**: `0.0.0.0/0` (Cho phép mọi địa chỉ IP kết nối)
   - **Protocols and ports**:
     - Chọn **Specified protocols and ports**.
     - Tích chọn **TCP**: Nhập `3478` (Cổng chính của STUN/TURN).
     - Tích chọn **UDP**: Nhập `3478,49152-49200` (Cổng chính STUN/TURN và dải cổng dùng để truyền tải Media Relay).
3. Nhấp **Create** để áp dụng quy tắc.

---

### Bước 3.4: Cài đặt và cấu hình Coturn bên trong VM
1. Tại danh sách VM instances, nhấp vào nút **SSH** bên cạnh máy ảo `socialhub-coturn-vm` để kết nối vào terminal của máy ảo.
2. Cập nhật hệ thống và cài đặt Docker:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   ```
3. Tạo thư mục chứa file cấu hình Coturn:
   ```bash
   sudo mkdir -p /opt/coturn
   ```
4. Tạo và chỉnh sửa file cấu hình `turnserver.conf`:
   ```bash
   sudo nano /opt/coturn/turnserver.conf
   ```
5. Dán nội dung sau vào file cấu hình (thay đổi thông tin tên miền và tài khoản theo ý muốn):
   ```ini
   # Cổng lắng nghe chính cho STUN/TURN
   listening-port=3478

   # Cơ chế bảo mật và xác thực
   fingerprint
   lt-cred-mech

   # Tên miền của bạn (Realm)
   realm=turn.yourdomain.com

   # Tài khoản kết nối (Định dạng: username:password)
   # Bạn có thể tạo nhiều dòng user nếu muốn cấp cho nhiều client khác nhau
   user=socialhub_user:socialhub_secret_pass

   # Giới hạn dải cổng truyền tải Media (Trùng khớp với cổng đã mở trên GCP Firewall)
   min-port=49152
   max-port=49200

   # Tắt CLI và Multicast để tăng hiệu năng và bảo mật
   no-cli
   no-multicast-peers
   ```
   *Nhấn `Ctrl + O` -> `Enter` để lưu, và `Ctrl + X` để thoát.*

6. Chạy Docker container để khởi động Coturn:
   ```bash
   sudo docker run -d \
     --name coturn-server \
     --network host \
     --restart always \
     -v /opt/coturn/turnserver.conf:/etc/coturn/turnserver.conf \
     coturn/coturn
   ```

7. Kiểm tra xem container đã chạy ổn định chưa:
   ```bash
   sudo docker ps
   sudo docker logs coturn-server
   ```

---

## 🌐 4. Cấu hình DNS trên Cloudflare

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) và chọn tên miền của bạn (ví dụ: `yourdomain.com`).
2. Vào mục **DNS** -> **Records**.
3. Nhấp **Add record** và cấu hình như sau:
   - **Type**: `A`
   - **Name**: `turn` (Điều này tạo ra sub-domain `turn.yourdomain.com`)
   - **IPv4 address**: Nhập địa chỉ **IP ngoại vi tĩnh** của GCE VM đã copy ở Bước 3.2.
   - **Proxy status**: 🔘 **DNS Only** (Gạt công tắc sang màu xám để tắt đám mây màu cam).
4. Nhấp **Save**.

---

## 💻 5. Tích hợp cấu hình vào Source Code Frontend

Mở file [CallWindow.jsx](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/components/CallWindow.jsx) trong dự án Frontend của bạn và cập nhật biến `ICE_SERVERS`.

Thay vì hardcode, cách tốt nhất là sử dụng biến môi trường. Chúng ta sẽ lấy từ `import.meta.env`:

```javascript
// frontend/src/components/CallWindow.jsx

const ICE_SERVERS = {
    iceServers: [
        // Các STUN server miễn phí của Google để giải quyết NAT thông thường
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Cấu hình TURN server vừa deploy trên Google Cloud
        {
            urls: import.meta.env.VITE_TURN_URL || "turn:turn.yourdomain.com:3478",
            username: import.meta.env.VITE_TURN_USERNAME || "socialhub_user",
            credential: import.meta.env.VITE_TURN_CREDENTIAL || "socialhub_secret_pass"
        }
    ]
};
```

### Cấu hình biến môi trường khi deploy cụm GKE:
Khi xây dựng và triển khai frontend lên cụm GKE thông qua Cloud Build, hãy thêm các cấu hình biến môi trường này vào file `cloudbuild.yaml` hoặc file cấu hình Deployment của K8s:

Trong file `k8s/frontend.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
...
spec:
  template:
    spec:
      containers:
      - name: frontend
        env:
        - name: VITE_TURN_URL
          value: "turn:turn.yourdomain.com:3478"
        - name: VITE_TURN_USERNAME
          value: "socialhub_user"
        - name: VITE_TURN_CREDENTIAL
          value: "socialhub_secret_pass"
```

---

## 🧪 6. Kiểm tra hoạt động (Verification)

Để chắc chắn TURN Server hoạt động chính xác trước khi đưa vào ứng dụng:
1. Truy cập công cụ test WebRTC chuẩn của Google: [Trickle ICE Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).
2. Xóa tất cả các server mặc định đang có sẵn trong danh sách.
3. Thêm TURN Server của bạn vào:
   - **STUN or TURN URI**: `turn:turn.yourdomain.com:3478`
   - **TURN username**: `socialhub_user`
   - **TURN password**: `socialhub_secret_pass`
4. Nhấn **Add Server**.
5. Nhấn **Gather candidates** ở bên dưới.
6. Quan sát bảng kết quả:
   - Nếu bạn thấy có dòng xuất hiện chữ **`relay`** ở cột **Type**, điều đó có nghĩa là dữ liệu đa phương tiện đã đi qua TURN server thành công. Bạn đã thiết lập hoàn hảo!
