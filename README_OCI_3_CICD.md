# Giai Đoạn 3: Thiết Lập Tự Động Cập Nhật (CI/CD GitHub Actions)

Tài liệu này hướng dẫn cách cấu hình quy trình **CI/CD tự động** bằng **GitHub Actions** và **GitHub Container Registry (GHCR)**. Mỗi khi bạn đẩy code (push) lên nhánh **`main`**, các microservices sẽ được tự động đóng gói và cập nhật trực tiếp lên máy ảo Oracle Cloud.

---

## 🏗️ 1. Quy Trình Hoạt Động (RAM-Optimized Build & Release)

1.  **Push Event**: Lập trình viên push code lên nhánh chính `main`.
2.  **GitHub Cloud Build**: GitHub Actions chạy song song 7 tiến trình build Docker cho 7 dịch vụ (Gateway & 6 Microservices). Ảnh Docker được đẩy lên **GHCR** (`ghcr.io`). *Quá trình này chạy trên hạ tầng của GitHub nên không tiêu tốn RAM hay CPU của máy ảo Oracle.*
3.  **SSH Deploy**: GitHub Actions kết nối SSH an toàn vào VM Oracle và tự động thực hiện:
    - Di chuyển vào thư mục dự án và `git pull origin main` để cập nhật tệp `docker-compose.prod.yml`.
    - Đăng nhập GHCR và kéo (pull) các Docker image mới nhất về máy ảo.
    - Khởi chạy lại các dịch vụ bằng lệnh: `docker compose -f docker-compose.prod.yml up -d`.
    - Dọn dẹp ảnh cũ rác (`docker image prune`) để tránh đầy bộ nhớ đĩa cứng VM.

---

## 🔑 2. Cấu Hình SSH Key Đăng Nhập VM Cho GitHub Actions

Để GitHub Actions có quyền kết nối và chạy lệnh trên máy ảo Oracle của bạn qua SSH:

1. Đăng nhập SSH vào máy ảo Oracle Cloud VM (với tư cách user `opc`).
2. Tạo một cặp khóa SSH mới (không đặt mật khẩu):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_actions_deploy -N ""
   ```
3. Thêm khóa công khai mới vào tệp authorized_keys để cấp quyền đăng nhập:
   ```bash
   cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
4. Lấy nội dung **Khóa tư nhân (Private Key)** để cấu hình vào GitHub:
   ```bash
   cat ~/.ssh/github_actions_deploy
   ```
   *(Hãy copy toàn bộ nội dung hiển thị từ `-----BEGIN OPENSSH PRIVATE KEY-----` đến `-----END OPENSSH PRIVATE KEY-----`)*.

---

## 🔒 3. Cấu Hình Secrets Trên Kho Lưu Trữ GitHub

1. Truy cập vào Repository của bạn trên GitHub -> Chọn **Settings** -> **Secrets and variables** -> Chọn **Actions**.
2. Nhấp nút **New repository secret** và thêm lần lượt 3 biến sau:

| Tên Secret | Giá trị | Mô tả |
| :--- | :--- | :--- |
| **`VM_HOST`** | `140.238.xx.xx` | Địa chỉ IP Tĩnh Công Cộng của máy ảo Oracle |
| **`VM_USER`** | `opc` | Tên người dùng SSH (mặc định của VM Oracle Linux là `opc`) |
| **`VM_SSH_KEY`** | *(Nội dung Private Key)* | Dán toàn bộ nội dung tệp `github_actions_deploy` vừa sao chép ở Bước 2 |

---

## 📦 4. Bật Quyền Kéo Ảnh Docker Công Khai (Visibility Public)

Để máy ảo OCI có thể kéo các Docker Image mới từ GitHub Container Registry về mà không cần nhập token đăng nhập phức tạp mỗi lần chạy:

1. Chạy quy trình CI/CD lần đầu tiên (bằng cách push code lên `main`).
2. Sau khi build xong, vào trang GitHub cá nhân của bạn -> chọn tab **Packages** (bên cạnh tab Repositories).
3. Bạn sẽ thấy 7 package mới được tải lên (ví dụ: `socialhub-gateway`, `socialhub-user-service`, v.v.).
4. Truy cập vào từng package -> Chọn **Package Settings** ở cột bên phải.
5. Kéo xuống dưới cùng tại mục **Danger Zone** -> Click **Change visibility** -> Đổi sang **Public** và xác nhận.
6. **Thực hiện thao tác này cho cả 7 packages**. Việc này giúp máy ảo pull ảnh về cực nhanh và dễ dàng.
