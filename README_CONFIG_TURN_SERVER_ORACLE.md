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

   Kết quả sẽ thuộc **một trong hai trường hợp** dưới đây. Hãy xác định đúng trường hợp của bạn rồi làm theo hướng dẫn tương ứng:

   ---

   #### 🅰️ Trường hợp A: Chain INPUT có sẵn các rule mặc định và dòng REJECT ở cuối (Oracle Linux chuẩn)

   Kết quả trông như sau:
   ```
   num  target   prot  source      destination
   1    ACCEPT   all   ...         (RELATED,ESTABLISHED)
   2    ACCEPT   icmp  ...
   3    ACCEPT   all   ...
   4    ACCEPT   tcp   ...         tcp dpt:22
   5    REJECT   all   ...         ← Chặn tất cả traffic còn lại
   ```

   **Bước 2b (A)**: Chèn rule ACCEPT vào **vị trí 5** (ngay TRƯỚC dòng REJECT):
   ```bash
   # Chèn vào vị trí 5 = đẩy REJECT xuống, rule mới nằm trước REJECT
   sudo iptables -I INPUT 5 -p udp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 5 -p tcp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 5 -p udp --dport 49152:49200 -j ACCEPT
   ```

   **Bước 2c (A)**: Kiểm tra lại — 3 rule mới phải xuất hiện TRƯỚC dòng REJECT:
   ```bash
   sudo iptables -L INPUT --line-numbers -n
   # Kết quả đúng:
   # 5    ACCEPT   udp  ...  udp dpt:3478
   # 6    ACCEPT   tcp  ...  tcp dpt:3478
   # 7    ACCEPT   udp  ...  udp dpts:49152:49200
   # 8    REJECT   all  ...  ← REJECT phải ở CUỐI
   ```

   ---

   #### 🅱️ Trường hợp B: Chain INPUT hoàn toàn trống, policy ACCEPT (Một số image Oracle Linux / ARM Ampere)

   > [!IMPORTANT]
   > **Lỗi `iptables: Index of insertion too big`** xảy ra khi bạn chạy `-I INPUT 5` nhưng chain INPUT đang **trống hoàn toàn** (không có rule nào), nên vị trí 5 không tồn tại.

   Kết quả trông như sau:
   ```
   Chain INPUT (policy ACCEPT)
   num  target     prot opt source               destination
                    ← TRỐNG, KHÔNG CÓ RULE NÀO
   ```

   Vì không có dòng REJECT nào chặn traffic, policy `ACCEPT` mặc định đã cho phép tất cả lưu lượng đi vào. Tuy nhiên, bạn **vẫn nên thêm rule tường minh** để phòng trường hợp ai đó thêm rule DROP/REJECT sau này.

   **Bước 2b (B)**: Dùng `-A` (append) thay vì `-I` (insert) để thêm rule vào cuối chain:
   ```bash
   # Append rule vào cuối chain (không cần chỉ định vị trí)
   sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
   sudo iptables -A INPUT -p udp --dport 49152:49200 -j ACCEPT
   ```

   **Bước 2c (B)**: Kiểm tra lại — 3 rule mới phải xuất hiện trong chain:
   ```bash
   sudo iptables -L INPUT --line-numbers -n
   # Kết quả đúng:
   # 1    ACCEPT   udp  ...  udp dpt:3478
   # 2    ACCEPT   tcp  ...  tcp dpt:3478
   # 3    ACCEPT   udp  ...  udp dpts:49152:49200
   ```

   ---

   **Bước 2d** (Chung cho cả hai trường hợp): Lưu cấu hình vĩnh viễn.

   > [!CAUTION]
   > **VM AMD Free Tier thực tế chỉ có ~500 MB RAM** (không phải 1 GB — kernel và firmware chiếm nửa còn lại). Lệnh `dnf install` tiêu tốn ~500-700 MB RAM khi giải quyết dependencies → bị Linux OOM Killer giết chết (hiện thông báo `Killed`) ngay cả khi đã có Swap. **Bắt buộc phải tạo Swap trước** khi chạy bất kỳ lệnh `dnf` nào.

   **Bước 2d.1**: Tạo Swap File 2 GB (chạy **một lần duy nhất**, giữ vĩnh viễn):
   ```bash
   # Tạo file swap 2GB
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile

   # Ép Linux ưu tiên swap mạnh (mặc định = 30, tăng lên 100)
   sudo sysctl vm.swappiness=100
   # Lưu vĩnh viễn qua reboot
   echo 'vm.swappiness=100' | sudo tee -a /etc/sysctl.conf

   # Kiểm tra swap đã hoạt động
   free -h
   # Phải thấy dòng Swap: total ≥ 2.0Gi

   # Ghi vào fstab để swap tự kích hoạt khi reboot
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

   **Bước 2d.2** (✅ **Khuyên dùng**): Lưu rule thủ công **KHÔNG cần cài thêm package nào**:

   > [!IMPORTANT]
   > Trên VM chỉ ~500 MB RAM, `dnf install iptables-services` rất hay bị `Killed` dù đã có swap. Phương pháp dưới đây dùng `iptables-save` (có sẵn trong OS) + systemd service tự tạo, **không cần cài đặt gì thêm**:

   ```bash
   # Xả RAM cache trước khi thao tác
   sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'

   # Tạo thư mục lưu rule nếu chưa có
   sudo mkdir -p /etc/sysconfig

   # Lưu toàn bộ iptables rule hiện tại ra file
   sudo iptables-save | sudo tee /etc/sysconfig/iptables

   # Tạo systemd service để tự nạp lại rule khi VM khởi động
   sudo tee /etc/systemd/system/iptables-restore.service > /dev/null <<'EOF'
   [Unit]
   Description=Restore iptables rules on boot
   Before=network-pre.target
   Wants=network-pre.target

   [Service]
   Type=oneshot
   ExecStart=/usr/sbin/iptables-restore /etc/sysconfig/iptables
   RemainAfterExit=yes

   [Install]
   WantedBy=multi-user.target
   EOF

   # Kích hoạt service chạy tự động khi boot
   sudo systemctl daemon-reload
   sudo systemctl enable iptables-restore.service

   # Kiểm tra service đã enable thành công
   sudo systemctl is-enabled iptables-restore.service
   # Kết quả đúng: enabled
   ```

   > [!TIP]
   > **Phương án thay thế** — Nếu muốn thử cài `iptables-services` (cách truyền thống), hãy xả RAM + cache trước:
   > ```bash
   > # Xả cache và ép swap trước khi chạy dnf
   > sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
   > sudo sysctl vm.swappiness=100
   > sudo dnf install -y --setopt=install_weak_deps=False iptables-services
   >
   > # Nếu thành công:
   > sudo systemctl enable iptables
   > sudo systemctl start iptables
   > sudo service iptables save
   > ```


   > [!WARNING]
   > **Bẫy phổ biến**: Rule `-I INPUT 1` chèn vào **đầu** chain, trông có vẻ đúng nhưng thực tế **không hiệu quả** nếu rule số 3 `ACCEPT all` đang match trước (các gói tin đã được ACCEPT trước khi tới rule của bạn). Luôn xem `iptables -L INPUT --line-numbers -n` trước để biết chính xác vị trí REJECT và chèn ngay trước nó.

---

### Bước 4.5: Cài đặt & Cấu hình Coturn

> [!CAUTION]
> **Chọn đúng phương án cho VM của bạn:**
>
> | VM Type | RAM thực tế | Phương án |
> |---|---|---|
> | **AMD Micro** (VM.Standard.E2.1.Micro) | **~500 MB** | ✅ **Phương án A**: Cài trực tiếp (KHÔNG Docker) |
> | **ARM Ampere** (VM.Standard.A1.Flex — 6GB) | **~5.5 GB** | Phương án A hoặc B đều OK |
>
> **Tại sao VM AMD ~500 MB RAM không nên dùng Docker?**
>
> | Thành phần | Có Docker | Không Docker |
> |---|---|---|
> | Oracle Linux OS | ~150-200 MB | ~150-200 MB |
> | Docker daemon (chạy nền 24/7) | **~100-150 MB** | ❌ **0 MB** |
> | Coturn process | ~30-50 MB | ~20-40 MB |
> | **Tổng** | **~280-400 MB (56-80%)** | **~170-240 MB (34-48%)** |
>
> Docker daemon ngốn **100-150 MB RAM chỉ để quản lý container** — trên VM 500 MB đó là 20-30% RAM lãng phí hoàn toàn. Cài Coturn trực tiếp lên OS tiết kiệm hơn rất nhiều.

---

#### ✅ Phương án A: Cài Coturn trực tiếp lên OS (Khuyên dùng cho VM AMD ~500 MB RAM)

##### A1. Lấy địa chỉ IP nội bộ (Internal Private IP):

   ```bash
   hostname -I | awk '{print $1}'
   ```
   *(Ghi lại địa chỉ IP nội bộ này, ví dụ: `10.0.0.150`)*.

##### A2. Cài đặt Coturn:

   > [!CAUTION]
   > **VM AMD ~500 MB RAM KHÔNG THỂ chạy `dnf` trực tiếp** — `dnf` (Python) tiêu tốn ~400-700 MB RAM, vượt quá tổng RAM vật lý. Dù có 2.5 GB swap, OOM Killer sẽ giết `dnf` trước khi kernel kịp swap, hoặc nếu bảo vệ OOM thì **toàn bộ VM sẽ đơ** (thrash swap vô tận). **Phải dùng phương pháp tải RPM từ máy local rồi chuyển lên VM.**

   ---

   **✅ Phương pháp duy nhất hoạt động — Tải RPM trên máy local, SCP lên VM, cài offline:**

   > [!IMPORTANT]
   > Phương pháp này dùng máy tính cá nhân (có nhiều RAM) để tải RPMs, rồi chuyển file lên Oracle VM và cài bằng `rpm` (chương trình C, chỉ tốn ~10 MB RAM — không bao giờ bị OOM kill).

   **Bước 1** — Trên **máy tính cá nhân** (WSL OracleLinux, Docker, hoặc bất kỳ máy Linux nào có ≥ 2 GB RAM):

   ```bash
   # === CHẠY TRÊN MÁY LOCAL (WSL / máy tính cá nhân) ===

   # Cài EPEL repo (nếu chưa có)
   sudo dnf install -y oracle-epel-release-el9
   # Nếu dùng distro khác (CentOS/Rocky/Alma): sudo dnf install -y epel-release

   # Tải coturn + TẤT CẢ dependencies xuống thư mục local (KHÔNG cài lên máy local)
   # Dùng "dnf download" (KHÔNG phải "dnf install --downloadonly" vì lệnh đó bỏ qua package đã cài)
   mkdir -p ~/coturn-rpms
   sudo dnf download --resolve --destdir=$HOME/coturn-rpms coturn postgresql-libs
   # postgresql-libs cung cấp libpq.so.5 mà turnserver binary cần để khởi động
   
   ls -lh ~/coturn-rpms/
   # Phải thấy file coturn-*.rpm và các dependency RPMs
   ```

   **Bước 2** — Chuyển RPMs lên Oracle VM:

   ```bash
   # === VẪN CHẠY TRÊN MÁY LOCAL ===

   # SCP toàn bộ RPMs lên Oracle VM
   scp -i ~/.ssh/oracle-key.pem ~/coturn-rpms/*.rpm opc@<IP_ORACLE_VM>:/tmp/

   # Hoặc nếu dùng PowerShell trên Windows:
   # scp -i key_oracle\ssh-key-2026-07-22.key coturn-rpms\*.rpm opc@<IP_ORACLE_VM>:/tmp/
   ```

   **Bước 3** — Trên **Oracle VM** (SSH vào VM), cài offline:

   ```bash
   # === CHẠY TRÊN ORACLE VM ===

   # 3a. Kiểm tra file RPM đã nhận đủ chưa (BẮT BUỘC phải thấy coturn-*.rpm)
   ls -lh /tmp/*.rpm
   # Kết quả đúng phải có ít nhất:
   #   coturn-4.15.0-1.el9.x86_64.rpm    (~374K)
   #   hiredis-1.0.2-2.el9.x86_64.rpm    (~48K)
   #   libmicrohttpd-*.rpm                (~86K)
   #   mariadb-connector-c-*.rpm          (~206K)
   #
   # ⚠️ Nếu KHÔNG thấy file coturn-*.rpm → quay lại Bước 2 SCP lại toàn bộ ~/coturn-rpms/

   # 3b. Cài tất cả RPMs offline, bỏ qua dependency PostgreSQL (--nodeps)
   # --force: bỏ qua package đã cài sẵn (như info), vẫn cài nốt package mới (coturn)
   # --nodeps: bỏ qua dependency libpq/PostgreSQL (không cần vì dùng user tĩnh trong config)
   sudo rpm -ivh --nodeps --force /tmp/*.rpm

   # 3c. Kiểm tra coturn đã cài thành công
   which turnserver
   # Kết quả đúng: /usr/bin/turnserver

   turnserver --version
   # Kết quả đúng: Coturn-4.15.0 ...

   rpm -qa | grep coturn
   # Kết quả đúng: coturn-4.15.0-1.el9.x86_64

   # 3d. Dọn dẹp file RPM tạm
   rm -f /tmp/*.rpm
   ```

   > [!TIP]
   > **Không có WSL OracleLinux?** Bạn có thể dùng bất kỳ phương pháp nào để có môi trường RHEL 9/Oracle Linux 9 trên máy local:
   > - **Docker** (nhanh nhất): `docker run --rm -v ~/coturn-rpms:/out oraclelinux:9 bash -c 'dnf install -y oracle-epel-release-el9 && dnf download --resolve --destdir=/out coturn'`
   > - **Máy Linux khác** (Ubuntu/Debian): Dùng Docker command ở trên
   > - **Máy ảo thứ 2** trên Oracle Cloud (ARM Ampere 6 GB RAM): Chạy `dnf install` bình thường, rồi `scp` RPMs sang VM AMD

##### A3. Tạo tệp cấu hình `turnserver.conf` (đã tối ưu RAM):

   Coturn cài từ RPM (Bước A2) đặt file config mặc định tại `/etc/coturn/turnserver.conf`. Ta sẽ ghi đè bằng cấu hình tối ưu cho VM ~500 MB RAM:

   ```bash
   # Tạo thư mục log nếu chưa có
   sudo mkdir -p /var/log/coturn

   # Sao lưu config mặc định (nếu có)
   [ -f /etc/coturn/turnserver.conf ] && sudo cp /etc/coturn/turnserver.conf /etc/coturn/turnserver.conf.bak

   # Ghi đè config mới bằng tee (không cần mở nano)
   sudo tee /etc/coturn/turnserver.conf > /dev/null <<'EOF'
   # ============================================================
   # Coturn Server Configuration — Tối ưu cho Oracle Free Tier ~500MB RAM
   # Cài đặt qua RPM (Bước A2) — Config path: /etc/coturn/turnserver.conf
   # ============================================================

   # --- Cổng lắng nghe chính cho STUN/TURN ---
   listening-port=3478

   # --- Cơ chế bảo mật và xác thực ---
   fingerprint
   lt-cred-mech

   # --- Tên miền (Realm) ---
   realm=turn.socialhubzz.cloud

   # --- Tài khoản kết nối ---
   user=socialhub_user:socialhub_secret_pass

   # --- Giới hạn dải cổng truyền tải Media ---
   # (Trùng khớp với cổng đã mở trên OCI Security List & IPTables)
   min-port=49152
   max-port=49200

   # --- Cấu hình NAT ---
   # (Bắt buộc đối với Oracle Cloud VM vì VM nằm sau 1-to-1 NAT VCN)
   #     THAY THẾ 2 giá trị dưới đây bằng IP thực tế của VM:
   #   - IP_PUBLIC  = Reserved Public IP (xem ở OCI Console > VM > tab Networks)
   #   - IP_PRIVATE = Kết quả lệnh: hostname -I | awk '{print $1}'
   # Ví dụ: external-ip=140.238.12.34/10.0.0.173
   external-ip=<IP_PUBLIC_TĨNH_ORACLE>/<IP_PRIVATE_NỘI_BỘ_ORACLE>

   # --- Tắt CLI và Multicast ---
   no-cli
   no-multicast-peers

   # ============================================================
   # TỐI ƯU RAM CHO VM ~500 MB (BẮT BUỘC TRÊN FREE TIER AMD)
   # ============================================================

   # Giới hạn băng thông tối đa mỗi phiên TURN = 512 Kbps
   # (Đủ cho video call 720p, ngăn 1 phiên ngốn toàn bộ RAM buffer)
   max-bps=512000

   # Tổng băng thông cho TẤT CẢ các phiên cùng lúc = 10 Mbps
   # (Phù hợp với VM 1/4 vCPU, ngăn quá tải)
   total-quota=10000

   # Giới hạn số phiên relay đồng thời tối đa mỗi user
   user-quota=20

   # Tự động dọn dẹp nonce cũ sau 600 giây (giải phóng bộ nhớ)
   stale-nonce=600

   # Bật simple-log thay vì verbose log (giảm I/O và memory buffer)
   simple-log
   log-file=/var/log/coturn/turnserver.log

   # Không lưu log chi tiết từng packet (rất tốn RAM)
   # (Chỉ bật dòng dưới khi debug, TUYỆT ĐỐI KHÔNG bật trên production)
   # verbose
   EOF

   # ⚠️ THAY IP thực tế vào config (thay 2 giá trị trong lệnh sed dưới đây)
   sudo sed -i 's|<IP_PUBLIC_TĨNH_ORACLE>|161.118.222.40|; s|<IP_PRIVATE_NỘI_BỘ_ORACLE>|10.0.0.173|' /etc/coturn/turnserver.conf
   # ^ Thay 161.118.222.40 bằng Reserved Public IP thực tế của VM
   # ^ Thay 10.0.0.173 bằng kết quả lệnh: hostname -I | awk '{print $1}'
   ```

   Kiểm tra config hợp lệ trước khi chạy service:
   ```bash
   # Test thử config (sẽ in lỗi nếu config sai cú pháp)
   sudo turnserver -c /etc/coturn/turnserver.conf --check-origin-consistency
   # Nếu không có lỗi in ra → config OK

   # Kiểm tra file config đã lưu đúng
   cat /etc/coturn/turnserver.conf | grep external-ip
   # Phải thấy: external-ip=<IP_PUBLIC>/<IP_PRIVATE> (với IP thực tế, KHÔNG phải placeholder)
   ```

   > [!IMPORTANT]
   > **Giải thích các tham số tối ưu RAM quan trọng:**
   >
   > | Tham số | Mặc định | Đã set | Tác dụng |
   > |---|---|---|---|
   > | `max-bps` | Không giới hạn | `512000` (512 Kbps) | Giới hạn bandwidth mỗi phiên, ngăn 1 user ngốn hết RAM buffer |
   > | `total-quota` | Không giới hạn | `10000` (10 Mbps) | Tổng bandwidth tất cả phiên, ngăn quá tải CPU/RAM |
   > | `user-quota` | Không giới hạn | `20` | Tối đa 20 relay cùng lúc/user |
   > | `stale-nonce` | Không bật | `600` giây | Tự dọn nonce cũ, giải phóng memory |
   > | `no-cli` | CLI bật | Tắt | Tiết kiệm ~10 MB RAM (CLI server) |

##### A4. Tạo systemd service để Coturn chạy tự động 24/7:

   ```bash
   # Tạo systemd service cho Coturn
   sudo tee /etc/systemd/system/coturn.service > /dev/null <<'EOF'
   [Unit]
   Description=Coturn TURN/STUN Server
   After=network.target
   Documentation=https://github.com/coturn/coturn

   [Service]
   Type=simple
   ExecStart=/usr/bin/turnserver -c /etc/coturn/turnserver.conf
   Restart=always
   RestartSec=5
   LimitNOFILE=65536

   # Giới hạn RAM tối đa cho process Coturn = 256 MB
   # (Tương đương --memory=256m của Docker nhưng không cần Docker)
   MemoryMax=256M
   MemoryHigh=128M

   [Install]
   WantedBy=multi-user.target
   EOF

   # Kích hoạt và khởi động Coturn
   sudo systemctl daemon-reload
   sudo systemctl enable coturn
   sudo systemctl start coturn

   # Kiểm tra trạng thái
   sudo systemctl status coturn
   ```

   > [!NOTE]
   > **Coturn có tự chạy lại nếu crash không?** — **CÓ, hoàn toàn tự động!**
   > - `Restart=always` + `RestartSec=5`: Nếu Coturn crash vì bất kỳ lý do gì → systemd **tự khởi động lại** sau 5 giây.
   > - `MemoryMax=256M`: Nếu Coturn vượt 256 MB RAM → systemd tự kill và restart (tương đương `--memory` của Docker).
   > - `MemoryHigh=128M`: Systemd sẽ **throttle** (làm chậm) process khi vượt 128 MB, ép nó giải phóng bộ nhớ trước khi bị kill.
   > - Nếu VM reboot → systemd tự khởi động Coturn cùng OS nhờ `WantedBy=multi-user.target`.
   >
   > **Kết luận**: Hành vi tương đương `docker run --restart always --memory=256m` nhưng **tiết kiệm ~100-150 MB RAM** vì không cần Docker daemon.

##### A5. Cấu hình log rotation (tránh log phình to chiếm disk):

   ```bash
   sudo tee /etc/logrotate.d/coturn > /dev/null <<'EOF'
   /var/log/coturn/turnserver.log {
       daily
       rotate 3
       maxsize 5M
       compress
       missingok
       notifempty
       postrotate
           systemctl reload coturn > /dev/null 2>&1 || true
       endscript
   }
   EOF
   ```

##### A6. Kiểm tra hoạt động:

   ```bash
   # Xem trạng thái Coturn
   sudo systemctl status coturn

   # Xem log gần nhất
   sudo journalctl -u coturn --no-pager -n 20

   # Kiểm tra port 3478 đang lắng nghe
   sudo ss -tulnp | grep 3478

   # Kiểm tra RAM — Coturn chỉ nên chiếm ~20-40 MB
   free -h
   ps aux --sort=-%mem | head -10

   # Xem số lần Coturn đã bị restart (nếu có)
   sudo systemctl show coturn --property=NRestarts
   ```

---

#### 📦 Phương án B: Cài qua Docker (Dành cho VM có ≥ 1 GB RAM thực tế — ARM Ampere 6GB)

> [!WARNING]
> **KHÔNG khuyên dùng cho VM AMD ~500 MB RAM.** Docker daemon chiếm ~100-150 MB RAM chạy nền 24/7. Chỉ dùng phương án này nếu VM của bạn có ≥ 1 GB RAM thực tế (ví dụ ARM Ampere A1.Flex với 6 GB RAM).

<details>
<summary><strong>👉 Nhấp để mở hướng dẫn cài Docker + Coturn (cho VM ≥ 1GB RAM)</strong></summary>

##### B1. Cài đặt Docker:

   ```bash
   # Xả RAM cache
   sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'

   # Thêm Docker CE repository chính thức
   sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo

   # Cài đặt Docker CE
   sudo dnf install -y --setopt=install_weak_deps=False docker-ce docker-ce-cli containerd.io

   # Dọn cache dnf
   sudo dnf clean all
   ```

##### B2. Cấu hình Docker Daemon tiết kiệm RAM:

   ```bash
   sudo mkdir -p /etc/docker
   sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "5m",
       "max-file": "2"
     },
     "storage-driver": "overlay2"
   }
   EOF
   ```

##### B3. Khởi động Docker:

   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker opc
   newgrp docker
   ```

##### B4. Lấy IP nội bộ, tạo turnserver.conf:

   Giống hệt **Bước A1** và **Bước A3** ở Phương án A phía trên, nhưng đặt file config ở `/opt/coturn/turnserver.conf`:
   ```bash
   sudo mkdir -p /opt/coturn
   sudo nano /opt/coturn/turnserver.conf
   ```
   *(Dán nội dung cấu hình giống hệt Bước A3)*

##### B5. Chạy Docker container Coturn (có giới hạn RAM):

   ```bash
   sudo mkdir -p /opt/coturn/logs

   sudo docker run -d \
     --name coturn-server \
     --network host \
     --restart always \
     --memory=256m \
     --memory-swap=384m \
     --memory-reservation=128m \
     -v /opt/coturn/turnserver.conf:/etc/coturn/turnserver.conf \
     -v /opt/coturn/logs:/var/log/coturn \
     coturn/coturn
   ```

   > [!NOTE]
   > **Container tự restart nếu crash** nhờ `--restart always`. Docker có exponential backoff: 100ms → 200ms → ... → tối đa 1 phút, ngăn crash loop.

##### B6. Kiểm tra:

   ```bash
   sudo docker ps
   sudo docker logs coturn-server
   docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

   # Xem lịch sử restart
   docker inspect coturn-server --format='Restarts: {{.RestartCount}}, Last Start: {{.State.StartedAt}}'
   ```

##### B7. Dọn dẹp:

   ```bash
   docker system prune -f
   free -h
   ```

</details>

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

#### Fix iptables nếu thiếu rule:
   ```bash
   # Xem vị trí dòng REJECT hiện tại
   sudo iptables -L INPUT --line-numbers -n
   ```

   **Nếu chain có rule REJECT** (Oracle Linux chuẩn — REJECT thường ở dòng 5):
   ```bash
   # Chèn ACCEPT ngay TRƯỚC dòng REJECT (thay số 5 bằng vị trí thực tế của REJECT)
   sudo iptables -I INPUT 5 -p udp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 5 -p tcp --dport 3478 -j ACCEPT
   sudo iptables -I INPUT 5 -p udp --dport 49152:49200 -j ACCEPT
   ```

   **Nếu chain INPUT trống hoàn toàn** (policy ACCEPT, không có rule nào → lỗi `Index of insertion too big`):
   ```bash
   # Dùng -A (append) thay vì -I (insert) vì không có rule nào để chèn trước
   sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
   sudo iptables -A INPUT -p udp --dport 49152:49200 -j ACCEPT
   ```

   **Xác nhận và lưu kết quả:**
   ```bash
   # Xác nhận kết quả — REJECT (nếu có) phải ở CUỐI, ACCEPT ở trên
   sudo iptables -L INPUT --line-numbers -n

   # Lưu vĩnh viễn (Chọn lệnh tương ứng với cách lưu ở Bước 2d):
   # Cách A: Nếu bạn dùng systemd iptables-restore.service (Khuyên dùng/Không cần package):
   sudo mkdir -p /etc/sysconfig && sudo iptables-save | sudo tee /etc/sysconfig/iptables

   # Cách B: Nếu bạn đã cài đặt package iptables-services qua dnf thành công:
   # sudo service iptables save
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