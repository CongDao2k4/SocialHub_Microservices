# Hướng Dẫn Thiết Lập CI/CD Tự Động Cập Nhật Lên Oracle Cloud VM

Tài liệu này hướng dẫn cách cấu hình quy trình **CI/CD tự động** bằng **GitHub Actions** và **GitHub Container Registry (GHCR)**. Mỗi khi bạn push code lên nhánh **`feature/oracle_deploy`**, mã nguồn mới sẽ được tự động build, push lên registry và cập nhật tức thì lên máy ảo Oracle Cloud.

---

## 🏗️ 1. Nguyên Lý Hoạt Động (RAM-Optimized)

1. **Push Event**: Lập trình viên push code lên nhánh `feature/oracle_deploy`.
2. **GitHub Build (Tối ưu RAM)**: GitHub Actions chạy song song 7 tiến trình build Docker cho 7 dịch vụ (Gateway & 6 Microservices), sau đó push ảnh đã đóng gói lên **GHCR** (`ghcr.io`).
3. **SSH Deploy**: GitHub Actions SSH trực tiếp vào VM Oracle và chạy các lệnh:
   - Pull code mới từ git (để cập nhật cấu hình file `docker-compose.prod.yml`).
   - Đăng nhập GHCR và pull các ảnh Docker mới nhất.
   - Chạy lệnh `docker compose -f docker-compose.prod.yml up -d` để áp dụng bản cập nhật.
   - Dọn dẹp ảnh cũ (`docker image prune`) để tránh đầy dung lượng ổ cứng của VM.

---

## 🛠️ 2. Các Bước Thiết Lập Chi Tiết

### Bước 2.1: Tạo Khóa SSH Để Deploy (SSH Deploy Key)
Ta cần tạo một cặp khóa SSH riêng biệt để GitHub Actions có quyền kết nối vào máy ảo Oracle Cloud.

1. Đăng nhập vào VM Oracle Cloud của bạn qua SSH hiện tại.
2. Tạo một cặp khóa mới trên máy ảo (không đặt mật khẩu/passphrase):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_actions_deploy -N ""
   ```
3. Thêm khóa công khai vừa tạo vào danh sách truy cập được phép của máy ảo:
   ```bash
   cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
4. Lấy nội dung **Khóa tư nhân (Private Key)** để cấu hình vào GitHub Secrets:
   ```bash
   cat ~/.ssh/github_actions_deploy
   ```
   *(Hãy copy toàn bộ nội dung hiển thị từ `-----BEGIN OPENSSH PRIVATE KEY-----` đến `-----END OPENSSH PRIVATE KEY-----`)*.

---

### Bước 2.2: Cấu Hình Secrets Trên Kho Lưu Trữ GitHub (GitHub Repository Secrets)
1. Truy cập kho lưu trữ dự án của bạn trên GitHub (Ví dụ: `https://github.com/minhtuan1102/SocialHub_Microservices`).
2. Vào mục **Settings** -> **Secrets and variables** -> Chọn **Actions**.
3. Nhấp nút **New repository secret** và thêm lần lượt 3 biến sau:

| Tên Secret | Giá trị | Mô tả |
| :--- | :--- | :--- |
| **`VM_HOST`** | `140.238.xx.xx` | Địa chỉ IP Tĩnh Công Cộng của máy ảo Oracle |
| **`VM_USER`** | `ubuntu` | Tên người dùng SSH (mặc định của Oracle Ubuntu VM là `ubuntu`) |
| **`VM_SSH_KEY`** | *(Nội dung Private Key)* | Dán toàn bộ nội dung tệp `github_actions_deploy` đã copy ở Bước 2.1 |

---

### Bước 2.3: Bật Quyền Kéo Ảnh Docker Từ GHCR Cho Máy Ảo
Mặc định, các gói ảnh Docker đẩy lên GitHub Container Registry (GHCR) sẽ ở chế độ **Private**. Để máy ảo của bạn có thể kéo ảnh về mà không gặp lỗi `repository does not exist or may require 'docker login'`:

#### Cách A: Chuyển Packages Sang Chế Độ Public (Khuyên Dùng - Đơn Giản)
1. Sau khi workflow chạy lần đầu tiên, hãy truy cập trang cá nhân GitHub của bạn -> Chọn tab **Packages** (ở góc phải trang cá nhân bên cạnh Repositories).
2. Bạn sẽ thấy 7 package mới có tên dạng `socialhub-gateway`, `socialhub-user-service`, v.v.
3. Click vào từng Package -> Chọn **Package Settings** (ở cột bên phải dưới cùng).
4. Kéo xuống mục **Danger Zone** -> Click **Change visibility** -> Chọn **Public** và xác nhận.
5. Thực hiện việc này cho cả 7 packages. Máy ảo sẽ có thể tự do pull ảnh về mà không cần xác thực token phức tạp.

#### Cách B: Liên kết Packages với Repository
1. Vào trang quản trị từng Package trên GitHub -> Chọn **Package Settings**.
2. Tại mục **Manage Actions access**, đảm bảo package được liên kết trực tiếp với repository `minhtuan1102/SocialHub_Microservices` của bạn với quyền **Read**.

---

## 🚀 3. Kích Hoạt & Kiểm Tra Quy Trình

### Bước 3.1: Commit Cấu Hình Lên Nhánh `feature/oracle_deploy`
Chạy các lệnh dưới máy local của bạn để đẩy cấu hình CI/CD lên GitHub:
```bash
git add .github/workflows/deploy.yml docker-compose.prod.yml README_ORACLE_CLOUD_CICD.md
git commit -m "feat: setup github actions ci/cd pipeline for oracle vm"
git push origin feature/oracle_deploy
```

### Bước 3.2: Theo Dõi Quá Trình Build và Deploy
1. Truy cập vào repo của bạn trên GitHub -> Chọn tab **Actions**.
2. Click vào workflow **`CI/CD SocialHub Microservices - Oracle VM`** đang chạy.
3. Bạn sẽ thấy các job build chạy song song cực nhanh. Sau khi toàn bộ 7 service build xong, job **`Deploy to Oracle VM`** sẽ SSH vào máy ảo của bạn và thực thi cập nhật.
4. Trên máy ảo, bạn có thể kiểm tra xem hệ thống đã cập nhật chưa bằng lệnh:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

---

## 🛠️ 4. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 1. Lỗi `ssh: handshake failed: ssh: unable to authenticate`
- **Nguyên nhân**: Khóa SSH trong `VM_SSH_KEY` không đúng hoặc chưa được thêm vào file `~/.ssh/authorized_keys` trên máy ảo.
- **Cách sửa**: Thực hiện lại Bước 2.1, đảm bảo copy đầy đủ các ký tự đầu và cuối của file key. Thử test kết nối SSH bằng tay từ một máy khác sử dụng key đó để kiểm tra.

### 2. Lỗi `permission denied` khi chạy lệnh Docker trên máy ảo qua SSH
- **Nguyên nhân**: Người dùng `ubuntu` trên máy ảo chưa được cấp quyền chạy docker mà không cần sudo.
- **Cách sửa**: Chạy lệnh này trên máy ảo:
  ```bash
  sudo usermod -aG docker ubuntu
  newgrp docker
  ```
  Sau đó khởi động lại dịch vụ docker: `sudo systemctl restart docker`.

### 3. Lỗi đầy ổ cứng trên VM sau nhiều lần deploy
- **Nguyên nhân**: Mỗi lần deploy, các Docker Image cũ không được xóa tự động sẽ tích tụ chiếm dung lượng đĩa.
- **Cách sửa**: Job deploy trong file workflow đã được cấu hình tự động chạy lệnh `docker image prune -f` để dọn dẹp các tệp rác sau mỗi lần cập nhật. Bạn cũng có thể dọn dẹp thủ công trên VM bằng lệnh:
  ```bash
  docker system prune -a --volumes -f
  ```
