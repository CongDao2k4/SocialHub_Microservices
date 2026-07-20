# Hướng dẫn Thiết lập Coturn Server (STUN/TURN) trên Oracle Cloud Infrastructure (OCI) & Cloudflare (Cập nhật Quota 2026)

Tài liệu này hướng dẫn chi tiết từng bước cách tự host máy chủ STUN/TURN (Coturn) trên đám mây **Oracle Cloud Infrastructure (OCI)** thuộc gói **Always Free Tier (Hạn mức 2026 mới nhất)** để phục vụ tính năng gọi Video và Voice call cho dự án **SocialHub Microservices**. Đồng thời hướng dẫn cách cấu hình Cloudflare miễn phí mà không cần trả phí cho lưu lượng UDP.

---

## ☁️ 1. Giải đáp thắc mắc: Cloudflare và Gói dịch vụ hỗ trợ UDP

> [!IMPORTANT]
> **KHÔNG CẦN mua gói trả phí nào của Cloudflare để chạy UDP cho TURN Server!**
> - Mặc định, tính năng Proxy của Cloudflare (đám mây màu cam 🟠) chỉ hỗ trợ HTTP/HTTPS. Để chuyển tiếp UDP/TCP tùy ý qua mạng proxy của họ, Cloudflare yêu cầu dịch vụ **Cloudflare Spectrum** (chỉ có trên gói Enterprise đắt đỏ).
> - **Tuy nhiên, đối với WebRTC (Video/Voice Call)**: Các trình duyệt của người dùng (WebRTC Client) cần kết nối trực tiếp đến IP của TURN Server bằng giao thức UDP/TCP nguyên bản để truyền tải hình ảnh/âm thanh mà không qua bất kỳ proxy trung gian nào (tránh làm tăng độ trễ cuộc gọi).
> - **Giải pháp tối ưu và miễn phí**: Ta chỉ cấu hình bản ghi DNS của TURN Server trên Cloudflare ở trạng thái **DNS Only (Đám mây màu xám 🔘)**. 
>   * Khi đó, Cloudflare chỉ đóng vai trò phân giải tên miền (ví dụ: `turn.yourdomain.com` -> IP của Oracle VM).
>   * Các gói tin UDP của cuộc gọi sẽ đi thẳng từ trình duyệt của người dùng tới VM trên Oracle Cloud.
>   * Việc này **hoàn toàn miễn phí 100%** và là cách thiết lập tiêu chuẩn cho tất cả các hệ thống WebRTC trên thế giới.

---

## 📊 2. Hạn mức Miễn phí (Quota 2026) của Oracle Cloud cho AMD VM

Oracle Cloud Infrastructure (OCI) là nhà cung cấp đám mây hào phóng nhất hiện nay với chương trình **Always Free Tier**.

### Thông số kĩ thuật gói Miễn phí 2026:
- **Máy ảo AMD (VM.Standard.E2.1.Micro)**: 2 máy ảo miễn phí trọn đời, mỗi máy gồm **1 OCPU / 1 vCPU (AMD EPYC)** và **1 GB RAM**.
- **Băng thông truyền tải dữ liệu đi (Outbound Data Transfer)**: Miễn phí **10 TB/tháng** (thoải mái cho hàng trăm ngàn cuộc gọi thoại/video).
- **Dung lượng đĩa (Block Volume)**: Miễn phí tổng cộng **200 GB** storage cho toàn tài khoản.
- **Địa chỉ IP Tĩnh Công Cộng (Reserved Public IPv4)**: Miễn phí tối đa 2 địa chỉ IP tĩnh công cộng.

### Máy ảo AMD Micro (1 GB RAM) có đủ chạy Coturn cho ứng dụng không?
> [!TIP]
> **HOÀN TOÀN ĐỦ VÀ RẤT MẠNH MẼ**.
> Coturn được viết hoàn toàn bằng C/C++ cực kỳ tối ưu hóa hiệu năng:
> - **RAM tiêu thụ**: Chỉ khoảng **20 MB – 50 MB RAM** khi hoạt động.
> - **CPU tiêu thụ**: Gần như **0%** khi nhàn rỗi và chỉ khoảng **3% – 8%** CPU khi có 30-50 cuộc gọi đồng thời.
> - Do đó, máy ảo AMD Micro 1GB RAM của Oracle Cloud hoàn toàn gánh tốt hàng ngàn cuộc gọi truyền tải media liên tục mà không bao giờ gặp tình trạng quá tải.

---

## 📐 3. Mô hình Kiến trúc Kết nối

```mermaid
flowchart TD
    subgraph Client ["Client Browser (WebRTC)"]
        A[Frontend Web App]
    end

    subgraph Cloudflare ["Cloudflare DNS Only"]
        B["turn.yourdomain.com (A Record - Gray Cloud)"]
    end

    subgraph GCP ["Google Cloud Platform (Production)"]
        subgraph GKE ["GKE Cluster (SocialHub App)"]
            C[Frontend Service]
            D[Gateway / Backend Services]
        end
    end

    subgraph OCI ["Oracle Cloud Infrastructure (Always Free)"]
        subgraph OCI_VM ["Compute Instance (VM.Standard.E2.1.Micro)"]
            E[Docker: Coturn Container]
        end
    end

    A -->|1. Đăng nhập / Khởi tạo cuộc gọi| C
    A -.->|2. Hỏi DNS IP của TURN| B
    B -.->|Trỏ về Reserved Public IP của Oracle VM| A
    A -->|3. Kết nối STUN/TURN (UDP/TCP port 3478)| E
    A -->|4. Truyền tải Media (UDP ports 49152-49200)| E
    E -->|Relay Media tới Peer khác| Client
```

---

## 🛠️ 4. Các Bước Thiết Lập Coturn Trên Oracle Cloud (OCI)

### Bước 4.1: Tạo Compute Instance (Máy ảo AMD Micro)
1. Đăng nhập vào [Oracle Cloud Console](https://cloud.oracle.com/).
2. Trên menu góc trái, truy cập **Compute** -> **Instances**.
3. Nhấp vào **Create Instance**:
   - **Name**: `socialhub-coturn-oracle-vm`
   - **Placement**: Giữ mặc định Availability Domain.
   - **Image and shape**:
     - Nhấp **Change image** -> Chọn **Ubuntu** (Phiên bản `Ubuntu 22.04` hoặc `Ubuntu 24.04` Canonical).
     - Nhấp **Change shape**:
       - Chọn **Specialty and previous generation** -> Chọn **VM.Standard.E2.1.Micro** (Luôn có nhãn *Always Free Eligible*).
   - **Networking**:
     - Chọn **Create new virtual cloud network (VCN)** hoặc dùng VCN sẵn có.
     - Chọn **Create new public subnet**.
     - Đảm bảo mục **Assign a public IPv4 address** được chọn là **Yes** (Hoặc *Automatically assign public IP*).
   - **Add SSH keys**: Chọn **Save private key** để tải file `.key` về máy tính (dùng để SSH vào máy ảo).
   - **Boot volume**: Giữ mặc định 50 GB.
4. Nhấp **Create** để khởi tạo máy ảo.

---

### Bước 4.2: Tạo và Gắn Địa chỉ IP Tĩnh Công Cộng (Reserved Public IPv4)
Để đảm bảo IP của máy ảo không bị thay đổi khi khởi động lại, ta cần chuyển IP công cộng tạm thời thành IP Tĩnh giữ nguyên cố định:

1. Trên thanh tìm kiếm OCI Console, tìm và truy cập **IP Management** -> **Reserved Public IPs**.
2. Nhấp nút **Reserve Public IP Address**:
   - **Name**: `socialhub-coturn-reserved-ip`
   - **Compartment**: Chọn Compartment của bạn.
3. Nhấp **Reserve Public IP Address**.
4. Sau khi IP được tạo, nhấp vào dấu 3 chấm ở cuối dòng IP đó -> Chọn **Edit**.
5. Tại mục **Asset type**, chọn **VNIC**.
6. Chọn VNIC thuộc máy ảo `socialhub-coturn-oracle-vm` của bạn và nhấn **Update**.
7. Copy địa chỉ IP công cộng tĩnh vừa được cấp (Ví dụ: `140.238.xx.xx`).

---

### Bước 4.3: Mở cổng Tường lửa trên Web Dashboard (OCI Security List)
Mặc định Oracle Cloud khóa toàn bộ cổng kết nối đi vào ngoại trừ cổng 22 (SSH). Bạn phải mở các cổng kết nối cho Coturn trên Security List của Subnet:

1. Vào chi tiết Máy ảo `socialhub-coturn-oracle-vm` -> Nhấp vào tên **Subnet** trong phần thông tin Networking.
2. Nhấp vào **Security Lists** -> Chọn **Default Security List for...**.
3. Nhấp nút **Add Ingress Rules** và thêm lần lượt các quy tắc sau:

   * **Rule 1 (Cổng STUN/TURN UDP 3478)**:
     - **Source Type**: `CIDR`
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `UDP`
     - **Destination Port Range**: `3478`
   
   * **Rule 2 (Cổng STUN/TURN TCP 3478)**:
     - **Source Type**: `CIDR`
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `TCP`
     - **Destination Port Range**: `3478`

   * **Rule 3 (Dải cổng truyền tải Media UDP 49152-49200)**:
     - **Source Type**: `CIDR`
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `UDP`
     - **Destination Port Range**: `49152-49200`

4. Nhấp **Add Ingress Rules** để lưu quy tắc.

---

### Bước 4.4: SSH vào Máy ảo & Mở Tường lửa Nội bộ Ubuntu (IPTables)

> [!WARNING]
> **ĐÂY LÀ LỖI 99% NGUYÊN NHÂN KHIẾN TURN TRÊN ORACLE CLOUD BỊ TIMEOUT**: 
> Các bản OS Ubuntu cung cấp bởi Oracle Cloud có tích hợp sẵn một lớp tường lửa nhân Linux (`iptables`) mặc định **REJECT (Chặn)** tất cả các cổng lưu lượng mạng đi vào ngoại trừ cổng 22, dù bạn đã mở cổng ở OCI Web Console!

1. Mở Terminal / CMD dưới máy tính của bạn và SSH vào máy ảo Oracle bằng file Private Key đã tải ở Bước 4.1:
   ```bash
   ssh -i /path/to/your-private-key.key ubuntu@<IP_TĨNH_ORACLE_VM>
   ```
2. Mở cổng trong `iptables` của hệ điều hành Ubuntu:
   ```bash
   # Thêm quy tắc cho phép UDP/TCP 3478 và UDP Media 49152-49200 vào đầu bảng IPTables
   sudo iptables -I INPUT 6 -p udp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 6 -p udp --dport 49152:49200 -j ACCEPT

   # Mở UFW nếu Ubuntu đang kích hoạt ufw
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw allow 49152:49200/udp

   # Cài đặt công cụ lưu cấu hình IPTables vĩnh viễn (không bị mất khi restart máy ảo)
   sudo apt-get update
   sudo apt-get install -y iptables-persistent netfilter-persistent
   sudo netfilter-persistent save
   sudo netfilter-persistent reload
   ```

---

### Bước 4.5: Cài đặt Docker & Cấu hình Coturn

1. Cài đặt Docker trên máy ảo Ubuntu Oracle:
   ```bash
   sudo apt-get install -y docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   ```
2. Lấy địa chỉ IP nội bộ (Internal Private IP) của máy ảo trong giao diện mạng VNIC:
   ```bash
   hostname -I | awk '{print $1}'
   ```
   *(Ghi lại địa chỉ IP nội bộ này, ví dụ: `10.0.0.150`)*.

3. Tạo thư mục và tệp cấu hình `turnserver.conf`:
   ```bash
   sudo mkdir -p /opt/coturn
   sudo nano /opt/coturn/turnserver.conf
   ```
4. Dán nội dung cấu hình sau vào tệp:
   ```ini
   # Cổng lắng nghe chính cho STUN/TURN
   listening-port=3478

   # Cơ chế bảo mật và xác thực
   fingerprint
   lt-cred-mech

   # Tên miền của bạn (Realm)
   realm=turn.socialhubzz.cloud

   # Tài khoản kết nối (Định dạng: username:password)
   user=socialhub_user:socialhub_secret_pass

   # Giới hạn dải cổng truyền tải Media (Trùng khớp với cổng đã mở trên OCI Security List & IPTables)
   min-port=49152
   max-port=49200

   # Cấu hình NAT (Bắt buộc đối với Oracle Cloud VM vì VM nằm sau 1-to-1 NAT VCN)
   # Định dạng: external-ip=<IP_PUBLIC_TĨNH_ORACLE>/<IP_PRIVATE_NỘI_BỘ_ORACLE>
   # Ví dụ: external-ip=140.238.12.34/10.0.0.150
   external-ip=<IP_PUBLIC_TĨNH_ORACLE>/<IP_PRIVATE_NỘI_BỘ_ORACLE>

   # Tắt CLI và Multicast để tăng hiệu năng và bảo mật
   no-cli
   no-multicast-peers
   ```
   *Nhấn `Ctrl + O` -> `Enter` để lưu, và `Ctrl + X` để thoát.*

5. Chạy Docker container khởi tạo Coturn Server:
   ```bash
   sudo docker run -d \
     --name coturn-server \
     --network host \
     --restart always \
     -v /opt/coturn/turnserver.conf:/etc/coturn/turnserver.conf \
     coturn/coturn
   ```

6. Kiểm tra nhật ký container xem Coturn đã sẵn sàng chưa:
   ```bash
   sudo docker ps
   sudo docker logs coturn-server
   ```

---

## 🌐 5. Cấu hình DNS trên Cloudflare

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) và chọn tên miền của bạn (`socialhubzz.cloud`).
2. Vào mục **DNS** -> **Records**.
3. Nhấp **Add record** và cấu hình:
   - **Type**: `A`
   - **Name**: `turn` (Tạo sub-domain `turn.socialhubzz.cloud`)
   - **IPv4 address**: Nhập địa chỉ **Reserved Public IP** của Oracle VM đã gắn ở Bước 4.2.
   - **Proxy status**: 🔘 **DNS Only** (Tắt đám mây màu cam, chuyển sang màu xám).
4. Nhấp **Save**.

---

## 💻 6. Tích hợp cấu hình Bảo mật vào Source Code & GKE

Tuân thủ quy tắc bảo mật của dự án (Không hardcode secrets trong frontend và không commit secrets plain-text lên Git):

### Bước 6.1: Cấu hình Kubernetes Secrets (`k8s/secrets.yaml`)
Mã hóa Base64 thông tin kết nối và cập nhật vào `k8s/secrets.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: socialhub-secrets
type: Opaque
data:
  # Cấu hình TURN Server cho WebRTC
  TURN_URL: dHVybj.....=
  TURN_USERNAME: c29jaWFsaH....=
  TURN_CREDENTIAL: c29jaWFsaH....=
```

### Bước 6.2: Cấu hình biến môi trường cho Backend (`k8s/chat-service.yaml`)
Dịch vụ `chat-service` nạp thông số TURN từ Secret và cung cấp API `/api/conversations/ice-servers` cho Client:
```yaml
        env:
        - name: TURN_URL
          valueFrom:
            secretKeyRef:
              name: socialhub-secrets
              key: TURN_URL
        - name: TURN_USERNAME
          valueFrom:
            secretKeyRef:
              name: socialhub-secrets
              key: TURN_USERNAME
        - name: TURN_CREDENTIAL
          valueFrom:
            secretKeyRef:
              name: socialhub-secrets
              key: TURN_CREDENTIAL
```

### Bước 6.3: Cấu hình môi trường Dev Local
Cập nhật tệp môi trường [.env](file:///.env) ở root hoặc [services/chat-service/.env](file:///services/chat-service/.env):
```env
# --- TURN Server (WebRTC) ---
TURN_URL=turn:turn.socialhubzz.cloud:3478
TURN_USERNAME=socialhub_user
TURN_CREDENTIAL=socialhub_secret_pass
```

---

## 🧪 7. Kiểm tra hoạt động (Verification via Trickle ICE Tool)

1. Truy cập công cụ test WebRTC chuẩn của Google: [Trickle ICE Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).
2. Xóa các server mặc định có sẵn.
3. Thêm TURN Server của Oracle Cloud vào:
   - **STUN or TURN URI**: `turn:turn.socialhubzz.cloud:3478`
   - **TURN username**: `socialhub_user`
   - **TURN password**: `socialhub_secret_pass`
4. Nhấn **Add Server** -> Nhấn **Gather candidates**.
5. Quan sát bảng kết quả:
   - Nếu xuất hiện dòng chứa từ **`relay`** ở cột **Type**, điều đó xác nhận gói tin media đã đi qua Coturn trên Oracle Cloud thành công 100%!

---

## 🛠️ 8. Hướng dẫn Xử lý Sự cố & Lưu ý Oracle Cloud (Troubleshooting)

### 1. Lỗi `TURN allocate request timed out` / `STUN binding request timed out`
* **Nguyên nhân**: Quên mở cổng `iptables` bên trong OS Ubuntu của Oracle Cloud.
* **Khắc phục**: SSH vào Oracle VM và chạy lại đoạn lệnh ở **Bước 4.4** để nạp quy tắc `ACCEPT` cho `iptables` và lưu lại bằng `netfilter-persistent save`.

### 2. Chính sách thu hồi VM nhàn rỗi của Oracle Cloud (Idle Instance Reclamation Policy)
* Oracle Cloud áp dụng chính sách thu hồi các máy ảo Always Free nhàn rỗi nếu trong **7 ngày liên tục**:
  - CPU utilization dưới 10%.
  - Network utilization dưới 10%.
* **Cách khắc phục**: Coturn chạy phục vụ ứng dụng SocialHub sẽ phát sinh network traffic thường xuyên khi gọi điện. Bạn cũng có thể cài một tiến trình crontab nhẹ hoặc container ping định kỳ để đảm bảo máy ảo không bị đánh dấu nhàn rỗi.

---

## 🚀 9. Các bước triển khai lên cụm Production GKE

1. Nạp Secret mới lên cụm GKE:
   ```bash
   kubectl apply -f k8s/secrets.yaml -n default
   ```
2. Triển khai cấu hình Pod mới cho `chat-service` và `frontend`:
   ```bash
   kubectl apply -f k8s/chat-service.yaml -n default
   kubectl apply -f k8s/frontend.yaml -n default
   ```
3. Mở tab Console trình duyệt (`F12`) thực hiện cuộc gọi để xác nhận dòng log:
   **`📡 [WEBRTC] Tải thành công ICE Servers động từ backend.`**