# Giai Đoạn 1: Thiết Lập Máy Ảo VM (Oracle Linux) & Block Volume

Tài liệu này hướng dẫn chi tiết cách khởi tạo VM, cấu hình phân vùng swap, gắn và định dạng Block Volume (hệ tệp XFS) và cấu hình tường lửa trên hệ điều hành **Oracle Linux 8 / 9** (Hệ điều hành mặc định, tối ưu nhất của Oracle Cloud).

---

## ☁️ 1. Khởi Tạo Máy Ảo (Compute Instance) & Gán IP Tĩnh

### Bước 1.1: Khởi tạo Compute Instance
1. Đăng nhập vào [Oracle Cloud Console](https://cloud.oracle.com/).
2. Chọn **Compute** -> **Instances** -> Chọn **Create Instance**.
3. Cấu hình máy ảo như sau:
   - **Name**: `socialhub-production-vm`
   - **Image**: Chọn **Oracle Linux** (Khuyên dùng phiên bản Oracle Linux 8 hoặc 9).
   - **Shape**: Chọn **Ampere (ARM)** -> **VM.Standard.A1.Flex** -> Thiết lập **1 OCPU** và **6 GB RAM** (Always Free).
   - **Networking**:
     - Tạo mới Virtual Cloud Network (VCN) và public subnet.
     - Chọn **Yes** ở mục *Assign a public IPv4 address*.
   - **SSH Keys**: Tải khóa riêng tư (`.key`) về máy local của bạn để dùng kết nối SSH.
   - **Boot Volume**: Giữ mặc định (thường là 47GB).
4. Click **Create** và đợi máy ảo chuyển sang trạng thái chạy (**Running**).

### Bước 1.2: Cố định địa chỉ IP Tĩnh (Reserved Public IP)
Để tránh IP bị thay đổi khi restart máy ảo:
1. Tìm kiếm cụm từ **Reserved Public IPs** trên thanh tìm kiếm của OCI.
2. Click **Reserve Public IP Address**: đặt tên `socialhub-reserved-ip` rồi nhấn **Reserve**.
3. Truy cập vào chi tiết máy ảo của bạn -> chọn **Attached VNICs** (dưới cùng bên trái).
4. Nhấp vào VNIC chính -> Tab **IPv4 Addresses** -> Nhấp vào dấu 3 chấm cạnh Private IP -> Chọn **Edit**.
5. Thay đổi mục **Public IP Type** thành **No Public IP** -> nhấn **Update** để gỡ IP động cũ.
6. Làm lại bước Edit trên -> Chọn **Authorized Public IP** -> Chọn đúng tên `socialhub-reserved-ip` -> nhấn **Update** để gán IP tĩnh cố định.

---

## 💾 2. Cấu Hình Ổ Cứng Lưu Trữ (Block Volume)

Gói Always Free cấp tối đa **200GB** Block Volume. Chúng ta sẽ tạo một Block Volume 100GB riêng để lưu trữ dữ liệu bền vững (database, media) của dự án.

### Bước 2.1: Tạo Block Volume trên OCI Console
1. Chọn **Storage** -> **Block Volumes** -> Nhấn **Create Block Volume**.
2. Thiết lập:
   - **Name**: `socialhub-database-volume`
   - **Size**: `100 GB`.
3. Nhấp **Create Block Volume**.

### Bước 2.2: Gắn Block Volume vào Máy Ảo
1. Vào chi tiết máy ảo -> Kéo xuống menu bên trái chọn **Attached Block Volumes**.
2. Nhấp **Attach Block Volume**.
3. Cấu hình:
   - **Volume**: Chọn đúng tên `socialhub-database-volume`.
   - **Attachment Type**: Chọn **Paravirtualized** (để HĐH tự nhận diện mà không cần lệnh cấu hình iSCSI phức tạp).
   - **Access Type**: `Read/Write`.
4. Nhấn **Attach** và đợi trạng thái chuyển sang màu xanh lá (**Attached**).

### Bước 2.3: Định Dạng XFS và Mount Ổ Cứng Trên Máy Ảo
1. Kết nối SSH vào máy ảo của bạn (Lưu ý: user mặc định của Oracle Linux là `opc`, không phải `ubuntu`):
   ```bash
   ssh -i <path-to-key-file> opc@<IP_TINH_VM>
   ```
2. Cập nhật hệ thống:
   ```bash
   sudo dnf update -y
   ```
3. Kiểm tra ổ cứng mới nhận diện bằng lệnh:
   ```bash
   lsblk
   ```
   *Bạn sẽ thấy một ổ cứng mới không chứa phân vùng, thường tên là `/dev/sdb` hoặc `/dev/oracleoci/oraclevdb` dung lượng 100G.*
4. Định dạng phân vùng ổ cứng bằng hệ thống tệp **XFS** (đặc biệt tối ưu cho hàng triệu file nhỏ như HLS segment `.ts` của Reels):
   ```bash
   sudo mkfs.xfs /dev/sdb
   ```
5. Tạo thư mục mount và tiến hành mount:
   ```bash
   sudo mkdir -p /mnt/socialhub-storage
   sudo mount /dev/sdb /mnt/socialhub-storage
   ```
6. Lấy mã UUID của ổ cứng mới:
   ```bash
   sudo blkid /dev/sdb
   ```
   *(Copy chuỗi dạng `UUID="..."` lại)*
7. Cấu hình mount tự động khi khởi động lại máy ảo:
   - Mở file cấu hình fstab:
     ```bash
     sudo nano /etc/fstab
     ```
   - Thêm dòng sau vào cuối file (thay UUID bằng chuỗi bạn vừa copy):
     ```text
     UUID=chuoi-uuid-cua-ban /mnt/socialhub-storage xfs defaults,noatime,_netdev 0 2
     ```
   - Lưu lại (`Ctrl + O`, `Enter`, `Ctrl + X`). Kiểm tra tính hợp lệ bằng lệnh:
     ```bash
     sudo mount -a
     ```
     *(Nếu không báo lỗi gì là cấu hình tự động mount đã chính xác).*

---

## 🐳 3. Cài Đặt Docker, Docker Compose & Tạo RAM Ảo (Swap)

### Bước 3.1: Tạo Swap Space 4GB (Bắt buộc)
Oracle Linux sử dụng bộ nhớ đệm. Với 6GB RAM vật lý, việc chạy các tác vụ ffmpeg convert video nặng hoặc nhiều container chạy song song có thể làm tràn bộ nhớ (Out-Of-Memory). Swap giúp hệ thống hoạt động ổn định 24/7.

```bash
# 1. Tạo file swap 4GB dùng dd (chuẩn cho Oracle Linux)
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096

# 2. Phân quyền chỉ cho root
sudo chmod 600 /swapfile

# 3. Thiết lập swap
sudo mkswap /swapfile

# 4. Bật swap
sudo swapon /swapfile

# 5. Cấu hình tự động kích hoạt swap khi khởi động lại máy ảo
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 6. Kiểm tra lại hoạt động của swap
free -h
```

### Bước 3.2: Cài Đặt Docker Engine trên Oracle Linux
Chạy chuỗi lệnh sau để cài đặt Docker:

```bash
# Thêm repository Docker CE
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Cài đặt các gói Docker CE & Docker Compose plugin
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Khởi động dịch vụ Docker và kích hoạt chạy cùng hệ thống
sudo systemctl start docker
sudo systemctl enable docker

# Thêm user opc vào nhóm docker để chạy lệnh không cần sudo
sudo usermod -aG docker opc

# Áp dụng nhóm mới ngay lập tức
newgrp docker
```

---

## 🔒 4. Cấu Tường Lửa (Security List & firewalld)

Oracle Linux chặn mặc định phần lớn lưu lượng truy cập đi vào. Chúng ta cần mở các cổng cho kết nối TURN (Video/Voice Call WebRTC).

### Bước 4.1: Mở cổng trên trang web OCI Console (Security List)
1. Chi tiết Máy ảo -> Click vào Subnet -> Click vào **Default Security List for...**.
2. Nhấn nút **Add Ingress Rules** và thêm các quy tắc sau:

| Source CIDR | Protocol | Destination Port Range | Mô tả |
| :--- | :--- | :--- | :--- |
| `0.0.0.0/0` | **UDP** | `3478` | Cổng kết nối STUN/TURN |
| `0.0.0.0/0` | **TCP** | `3478` | Cổng kết nối STUN/TURN |
| `0.0.0.0/0` | **UDP** | `49152-49200` | Dải cổng truyền tải Media WebRTC |

3. Nhấp **Add Ingress Rules**.

### Bước 4.2: Cấu hình tường lửa trên hệ điều hành (Oracle Linux firewalld)
Khác với Ubuntu dùng UFW, Oracle Linux sử dụng `firewalld` quản lý qua lệnh `firewall-cmd`:

```bash
# Mở cổng 3478 (TCP & UDP)
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=3478/udp

# Mở dải cổng truyền tải WebRTC Media 49152-49200 (UDP)
sudo firewall-cmd --permanent --add-port=49152-49200/udp

# Reload cấu hình tường lửa để áp dụng thay đổi
sudo firewall-cmd --reload

# Xem danh sách các cổng đã mở thành công
sudo firewall-cmd --list-ports
```
