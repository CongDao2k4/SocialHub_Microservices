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
2. Tại trang chủ Dashboard (phần Launch Resources / Quick Starts), nhấp trực tiếp vào thẻ **`AMD Compute Instance`** có nhãn xanh **`ALWAYS FREE`** (như trong ảnh chụp màn hình của bạn).
   * *Ưu điểm*: OCI sẽ tự động mở trang khởi tạo máy ảo và chọn sẵn cấu hình shape miễn phí **`VM.Standard.E2.1.Micro`** cho bạn.
3. Trong trang cấu hình máy ảo:
   - **Name**: `socialhub-coturn-oracle-vm`
   - **Placement**: Giữ mặc định Availability Domain.
   - **Image and shape**:
     - Shape đã được chọn mặc định sẵn là **`VM.Standard.E2.1.Micro`** (Always Free Eligible).
     - Nhấp nút **Change image** ở mục Image -> Chọn hệ điều hành **Ubuntu** (Phiên bản `Ubuntu 22.04` hoặc `Ubuntu 24.04` Canonical) để dễ cài đặt Docker và cấu hình tường lửa.
   - **Networking**:
     - Chọn **Create new virtual cloud network (VCN)** hoặc dùng VCN sẵn có.
     - Chọn **Create new public subnet**.
     - Đảm bảo mục **Assign a public IPv4 address** được chọn là **Yes** (Hoặc *Automatically assign public IP*).
   - **Add SSH keys**: Chọn **Save private key** để tải file `.key` về máy tính (dùng để SSH vào máy ảo).
   - **Boot volume**: Giữ mặc định 50 GB.

   > [!WARNING]
   > **XỬ LÝ LỖI "Out of capacity for shape VM.Standard.E2.1.Micro" (Hết tài nguyên miễn phí AMD):**
   > Đây là lỗi cực kỳ phổ biến trên Oracle Cloud do số lượng tài khoản Free Tier quá đông khiến dải máy ảo AMD E2 Micro bị hết cổng trống tạm thời. Bạn có 2 cách khắc phục:
   > 
   > **Cách 1: Đổi Availability Domain (Vùng khả dụng)**:
   > Ở phần **Placement** (Vị trí) -> Click **Edit** -> Chọn đổi sang **AD-2** hoặc **AD-3** (nếu khu vực của bạn hỗ trợ nhiều AD) và thử nhấn **Create** lại.
   > 
   > **Cách 2: Chuyển sang máy ảo ARM Ampere A1 (Khuyên dùng - Dung lượng lớn)**:
   > Máy chủ ARM Ampere (`VM.Standard.A1.Flex`) cũng nằm trong diện **Always Free** với dung lượng cung cấp lớn hơn rất nhiều:
   > 1. Quay lại trang chủ Dashboard, click vào thẻ **`Arm Compute Instance`** (Always Free).
   > 2. Hoặc nhấp **Edit** ở phần **Image and shape** -> Nhấp **Change shape** -> Chọn **Ampere** -> **VM.Standard.A1.Flex** -> Thiết lập **1 OCPU** và **6 GB RAM** (Cấu hình này hoàn toàn miễn phí 100%).
   > 3. Chọn **Image** là **Ubuntu** (Ubuntu hỗ trợ kiến trúc ARM64 cực tốt).
   > 4. *Lưu ý*: Docker image của `coturn/coturn` hỗ trợ đa kiến trúc (Multi-arch), nên các bước cài đặt Docker và cấu hình tiếp theo cho máy ảo ARM hoàn toàn giống hệt 100% so với máy ảo AMD.

4. Nhấp **Create** để khởi tạo máy ảo.

---

### Bước 4.2: Tạo và Gắn Địa chỉ IP Tĩnh Công Cộng (Reserved Public IPv4)
Để đảm bảo IP của máy ảo không bị thay đổi khi khởi động lại, ta cần chuyển IP công cộng tạm thời thành IP Tĩnh giữ nguyên cố định:

1. Trên thanh tìm kiếm OCI Console, tìm và truy cập **Reserved Public IPs**.
2. Nhấp nút **Reserve Public IP Address**:
   - **Name**: `socialhub-coturn-reserved-ip`
   - **Compartment**: Chọn Compartment của bạn.
3. Nhấp **Reserve Public IP Address**.
4. Để gắn IP tĩnh vừa tạo vào máy ảo, bạn hãy truy cập vào menu **Compute** -> **Instances** -> Nhấp vào tên máy ảo `socialhub-coturn-oracle-vm`.
5. Chọn tab **Networks** -> kéo xuống chọn **Attached VNICs**.
6. Nhấp vào tên VNIC chính hiển thị trong danh sách.
7. Ở trang chi tiết VNIC, vào tab **IP administrator** -> chọn **IPv4 Addresses** mình cần .
8. Nhấp vào dấu 3 chấm ở cuối dòng địa chỉ Private IP hiện tại -> Chọn **Edit**.
9. Làm việc để tạo **Reserved Public IP** rồi hoàn thành.
10. Nhấn **Update** để lưu cấu hình. Copy địa chỉ IP công cộng tĩnh vừa được gắn (Ví dụ: `140.238.xx.xx`) ở giao diện tab **Networks** của VM.

---

### Bước 4.3: Mở cổng Tường lửa trên Web Dashboard (OCI Security List)
Mặc định Oracle Cloud khóa toàn bộ cổng kết nối đi vào ngoại trừ cổng 22 (SSH). Bạn phải mở các cổng kết nối cho Coturn trên Security List của Subnet:

1. Vào chi tiết Máy ảo `socialhub-coturn-oracle-vm` -> Nhấp vào tab **Networks** để tìm tên **Subnet** trong phần thông tin Networking -> Ấn vào tên subnet đó.
2. Tại giao diện **subnet** của **Vituarl Cloud Network**, nhấp vào tab **Security** -> Chọn **Default Security List for...**. -> tab **Security Rule**
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

### Bước 4.4: SSH vào Máy ảo & Mở Tường lửa Nội bộ Oracle Linux (IPTables)

> [!WARNING]
> **ĐÂY LÀ LỖI 99% NGUYÊN NHÂN KHIẾN TURN TRÊN ORACLE CLOUD BỊ TIMEOUT**: 
> Các bản OS Oracle Linux cung cấp bởi Oracle Cloud có tích hợp sẵn một lớp tường lửa nhân Linux (`iptables`) mặc định **REJECT (Chặn)** tất cả các cổng lưu lượng mạng đi vào ngoại trừ cổng 22, dù bạn đã mở cổng ở OCI Web Console!

1. Mở Terminal / CMD dưới máy tính của bạn và SSH vào máy ảo Oracle bằng file Private Key đã tải ở Bước 4.1:

   - SSH key cần bảo mật quyền 400 để tránh 0777 vì chỉ owner đọc được key mới đúng chuẩn:

   ```bash
   # 1. Copy key vào thư mục home của WSL (nằm trên ext4, không phải NTFS)
   cp key_oracle/ssh-key-2026-07-22.key ~/.ssh/oracle-key.pem

   # 2. Set quyền đúng
   chmod 400 ~/.ssh/oracle-key.pem

   # 3. SSH dùng key từ Linux filesystem
   ssh -i ~/.ssh/oracle-key.pem opc@<IP_TĨNH_ORACLE_VM>
   ```

   Nếu không muốn dùng WSL, mở PowerShell và chạy:

   ```powershell
   # Xóa quyền thừa, chỉ giữ quyền cho user hiện tại
   icacls "key_oracle\ssh-key-2026-07-22.key" /inheritance:r /grant:r "%USERNAME%:R"

   # SSH bằng PowerShell native
   ssh -i key_oracle\ssh-key-2026-07-22.key opc@<IP_TĨNH_ORACLE_VM>
   ```

2. Mở cổng trong `iptables` của hệ điều hành **Oracle Linux**:

   **Bước 2a**: Xem cấu trúc chain INPUT hiện tại để biết vị trí của rule REJECT:
   ```bash
   sudo iptables -L INPUT --line-numbers -n
   ```

   Kết quả mặc định của Oracle Linux trông như sau:
   ```
   num  target   prot  source      destination
   1    ACCEPT   all   ...         (RELATED,ESTABLISHED)
   2    ACCEPT   icmp  ...
   3    ACCEPT   all   ...
   4    ACCEPT   tcp   ...         tcp dpt:22
   5    REJECT   all   ...         ← Chặn tất cả traffic còn lại
   ```

   **Bước 2b**: Chèn rule ACCEPT vào **vị trí 5** (ngay TRƯỚC dòng REJECT):
   ```bash
   # Chèn vào vị trí 5 = đẩy REJECT xuống, rule mới nằm trước REJECT
   sudo iptables -I INPUT 5 -p udp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 5 -p tcp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 5 -p udp --dport 49152:49200 -j ACCEPT
   ```

   **Bước 2c**: Kiểm tra lại — 3 rule mới phải xuất hiện TRƯỚC dòng REJECT:
   ```bash
   sudo iptables -L INPUT --line-numbers -n
   # Kết quả đúng:
   # 5    ACCEPT   udp  ...  udp dpt:3478
   # 6    ACCEPT   tcp  ...  tcp dpt:3478
   # 7    ACCEPT   udp  ...  udp dpts:49152:49200
   # 8    REJECT   all  ...  ← REJECT phải ở CUỐI
   ```

   **Bước 2d**: Lưu cấu hình vĩnh viễn (Oracle Linux dùng `dnf`, **không** dùng `apt-get`):
   ```bash
   # Cài iptables-services nếu chưa có
   sudo dnf install -y iptables-services

   # Bật dịch vụ iptables tự khởi động cùng hệ thống
   sudo systemctl enable iptables
   sudo systemctl start iptables

   # Lưu các rule hiện tại vào file cấu hình vĩnh viễn
   sudo service iptables save
   ```

   > [!WARNING]
   > **Bẫy phổ biến**: Rule `-I INPUT 1` chèn vào **đầu** chain, trông có vẻ đúng nhưng thực tế **không hiệu quả** nếu rule số 3 `ACCEPT all` đang match trước (các gói tin đã được ACCEPT trước khi tới rule của bạn). Luôn xem `iptables -L INPUT --line-numbers -n` trước để biết chính xác vị trí REJECT và chèn ngay trước nó.

---

### Bước 4.5: Cài đặt Docker & Cấu hình Coturn

1. Cài đặt Docker trên máy ảo **Oracle Linux** (dùng `dnf`, không phải `apt-get`):
   ```bash
   # Thêm Docker CE repository chính thức
   sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo

   # Cài đặt Docker CE và các thành phần liên quan
   sudo dnf install -y docker-ce docker-ce-cli containerd.io

   # Khởi động Docker và bật tự khởi động cùng hệ thống
   sudo systemctl start docker
   sudo systemctl enable docker

   # Thêm user opc vào nhóm docker để chạy docker không cần sudo (tuỳ chọn)
   sudo usermod -aG docker opc
   # Đăng xuất và đăng nhập lại để áp dụng quyền nhóm
   # hoặc # Áp dụng quyền nhóm docker ngay lập tức mà không cần thoát SSH
   newgrp docker
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

## 💻 6. Tích hợp cấu hình Bảo mật vào Source Code & OKE

Tuân thủ quy tắc bảo mật của dự án (Không hardcode secrets trong frontend và không commit secrets plain-text lên Git):

### Nếu chỉ dùng Backend local chạy qua Cloudfare tunnel -> Vercel thì

- Bước 6.3 (Backend Local) - Quan trọng nhất với kiến trúc của bạn

Vì không có OKE, backend đang chạy local, bạn chỉ cần cập nhật file .env của chat-service là xong — không cần động gì đến k8s/secrets.yaml.

Cập nhật file services/chat-service/.env (hoặc .env ở root nếu dùng Docker Compose):

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
TURN_URL=turn:turn.social....:3478
TURN_USERNAME=social....
TURN_CREDENTIAL=social....
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

### Lỗi 1: `code=701 STUN/TURN host lookup received error`
* **Nguyên nhân**: DNS chưa được cấu hình hoặc chưa propagate.
* **Cách kiểm tra** (chạy trên máy local):
  ```cmd
  nslookup turn.socialhubzz.cloud
  ```
  Kết quả đúng phải trả về IP `161.118.222.40`. Nếu không → Vào Cloudflare tạo/kiểm tra lại record `A` cho `turn` trỏ về IP Oracle VM, **Proxy status = DNS Only (màu xám)**.

### Lỗi 2: `TURN allocate request timed out` / `TcpTestSucceeded: False`
* **Nguyên nhân**: Cổng 3478 bị chặn — có thể do **iptables** chưa mở hoặc **OCI Security List** chưa có Ingress Rule.

#### Bước kiểm tra nhanh từ máy local (PowerShell):
```powershell
# Test TCP port 3478 có thông không
Test-NetConnection -ComputerName 161.118.222.40 -Port 3478
# Kết quả cần: TcpTestSucceeded : True
```

#### Bước kiểm tra bên trong Oracle VM (SSH vào):
```bash
# Kiểm tra Coturn có đang lắng nghe port 3478 không
sudo ss -tulnp | grep 3478
# Phải thấy dòng turnserver đang LISTEN/UNCONN trên port 3478

# Kiểm tra iptables chain INPUT
sudo iptables -L INPUT --line-numbers -n
# Phải thấy rule ACCEPT cho port 3478 (udp+tcp) NẰM TRƯỚC dòng REJECT
```

#### Fix iptables nếu thiếu rule (Oracle Linux mặc định có REJECT ở dòng 5):
```bash
# Xem vị trí dòng REJECT hiện tại
sudo iptables -L INPUT --line-numbers -n

# Chèn ACCEPT ngay TRƯỚC dòng REJECT (thường là vị trí 5)
sudo iptables -I INPUT 5 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 5 -p udp --dport 49152:49200 -j ACCEPT

# Xác nhận kết quả — REJECT phải ở CUỐI, ACCEPT ở trên
sudo iptables -L INPUT --line-numbers -n

# Lưu vĩnh viễn
sudo service iptables save
```

#### Kiểm tra OCI Security List nếu iptables đã đúng mà vẫn không thông:
- Vào OCI Console → Instance → Tab **Networking** → **Subnet** → **Security Lists** → **Default Security List**
- Đảm bảo có đủ 3 **Ingress Rules**:

| Protocol | Destination Port | Source CIDR |
|---|---|---|
| TCP | 3478 | 0.0.0.0/0 |
| UDP | 3478 | 0.0.0.0/0 |
| UDP | 49152-49200 | 0.0.0.0/0 |

### Lỗi 3: Chính sách thu hồi VM nhàn rỗi của Oracle Cloud
* Oracle Cloud thu hồi máy ảo Always Free nếu trong **7 ngày liên tục** CPU < 10% và Network < 10%.
* **Cách khắc phục**: Coturn xử lý các cuộc gọi sẽ tạo traffic tự nhiên. Nếu lo ngại, thêm crontab ping định kỳ:
  ```bash
  # Ping định kỳ mỗi 5 phút để tránh bị thu hồi
  (crontab -l 2>/dev/null; echo "*/5 * * * * ping -c 1 8.8.8.8 > /dev/null 2>&1") | crontab -
  ```

---

## 🚀 9. Các bước triển khai lên cụm Production OKE

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