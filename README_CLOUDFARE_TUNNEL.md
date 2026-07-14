# Hướng Dẫn Chạy Local & Deploy Frontend Lên Vercel Qua Cloudflare Tunnel

Tài liệu này hướng dẫn chi tiết dành cho người mới bắt đầu để:
1. Chạy mã nguồn giao diện (Frontend React + Vite) dưới máy cục bộ (không dùng Docker).
2. Cấu hình và deploy giao diện này lên dịch vụ hosting đám mây **Vercel** miễn phí.
3. Sử dụng **Cloudflare Tunnel** (`cloudflared`) để kết nối frontend trên Vercel tới backend chạy dưới local thay thế cho Ngrok.

---

## 💻 1. Hướng Dẫn Chạy Frontend Cục Bộ (Local)

Để chạy giao diện cục bộ trên máy tính của bạn, hãy làm theo các bước sau:

### Yêu cầu chuẩn bị
- Đã cài đặt **Node.js** (Khuyến nghị phiên bản 18 hoặc 20 trở lên).

### Các bước thực hiện:
1. Mở cửa sổ dòng lệnh (Terminal/Command Prompt) tại thư mục root của dự án.
2. Di chuyển vào thư mục giao diện `frontend`:
   ```bash
   cd frontend
   ```
3. Cài đặt các thư viện phụ thuộc (node_modules):
   ```bash
   npm install
   ```
4. Khởi chạy máy chủ giao diện ở chế độ nhà phát triển (Development mode):
   ```bash
   npm run dev
   ```
5. Mở trình duyệt web và truy cập địa chỉ được hiển thị ở terminal (thông thường là `http://localhost:5173`).

---

## 🚀 2. Hướng Dẫn Deploy Lên Vercel (Cho Người Mới Bắt Đầu)

Vì dự án SocialHub được tổ chức theo dạng Monorepo (chứa cả backend và frontend ở các thư mục con), ta cần cấu hình để Vercel hiểu và chỉ build riêng thư mục `frontend`.

Chúng tôi đã cấu hình sẵn file [vercel.json](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/vercel.json) bên trong thư mục `frontend` để xử lý cơ chế định tuyến (Client-side Routing) của React Router.

Bạn có thể lựa chọn 1 trong 2 phương pháp deploy sau:

### Phương Pháp 1: Deploy qua Giao Diện Website Vercel (Liên kết GitHub - Khuyên dùng)

Đây là phương pháp dễ nhất, tự động deploy lại mỗi khi bạn push code mới lên GitHub.

1. **Đẩy code lên GitHub**: Tạo một kho chứa (Repository) trên GitHub cá nhân và đẩy toàn bộ mã nguồn của dự án SocialHub lên đó.
2. **Đăng nhập Vercel**: Truy cập [https://vercel.com/](https://vercel.com/) và đăng nhập bằng tài khoản GitHub của bạn.
3. **Tạo Project mới**:
   - Tại màn hình Dashboard, click nút **Add New** -> chọn **Project**.
   - Tìm kho chứa GitHub bạn vừa đẩy lên và chọn **Import**.
4. **CẤU HÌNH THƯ MỤC ROOT (Quan trọng nhất)**:
   - Tại phần cấu hình dự án, tìm mục **Root Directory**.
   - Click nút **Edit** và chọn thư mục **`frontend`** (thay vì để mặc định ở thư mục ngoài cùng).
   - Hệ thống Vercel sẽ tự động phát hiện đây là dự án **Vite** và tự động điền các thông số:
     - *Framework Preset*: `Vite`
     - *Build Command*: `npm run build`
     - *Output Directory*: `dist`
5. **Tiến hành Deploy**:
   - Click nút **Deploy** và đợi khoảng 1 - 2 phút để Vercel tải mã nguồn, build và xuất bản giao diện.
   - Vercel sẽ cấp cho bạn một tên miền truy cập miễn phí (ví dụ: `socialhub-frontend.vercel.app`).

---

### Phương Pháp 2: Deploy qua Vercel CLI (Dòng lệnh trực tiếp từ máy tính)

Nếu bạn không muốn đẩy mã nguồn lên GitHub mà muốn deploy trực tiếp từ máy local:

1. **Cài đặt Vercel CLI**:
   Mở terminal và cài đặt Vercel toàn cục bằng lệnh:
   ```bash
   npm install -g vercel
   ```
2. **Di chuyển vào thư mục frontend**:
   ```bash
   cd frontend
   ```
3. **Chạy lệnh deploy**:
   ```bash
   vercel
   ```
4. **Trình hướng dẫn CLI sẽ hỏi bạn các câu hỏi, hãy điền như sau**:
   - *Set up and deploy?*: `Y` (Đồng ý)
   - *Which scope?*: (Chọn tài khoản cá nhân của bạn, nhấn Enter)
   - *Link to existing project?*: `N` (Chọn Không để tạo project mới)
   - *What’s your project’s name?*: Nhập tên dự án (ví dụ: `socialhub-frontend`) và nhấn Enter.
   - *In which directory is your code located?*: `./` (Giữ nguyên vì bạn đang đứng ở thư mục `frontend`)
   - *Want to modify build settings?*: `N` (Chọn Không để sử dụng cấu hình Vite mặc định)
5. **Xuất bản production**:
   Sau khi hoàn tất lệnh trên, dự án sẽ được deploy ở chế độ xem thử (Preview). Để deploy chính thức lên môi trường production, hãy chạy lệnh:
   ```bash
   vercel --prod
   ```

---

## 🌐 3. Kết Nối Frontend Trên Vercel Với Backend Chạy Cục Bộ (Sử Dụng Cloudflare Tunnel)

Khi deploy giao diện lên Vercel, ứng dụng sẽ chạy trên cloud công cộng. Tuy nhiên, API Gateway của bạn lại đang chạy trên cổng `localhost:8080` dưới máy cục bộ. 

Thay vì sử dụng **Ngrok** (bị giới hạn băng thông, giới hạn thời gian kết nối và hiển thị trang cảnh báo "Browser Warning" gây gián đoạn API fetch), chúng ta sẽ sử dụng **Cloudflare Tunnel** (`cloudflared`) - một công cụ miễn phí, mạnh mẽ, không bị giới hạn và không có màn hình cảnh báo trình duyệt.

Chúng ta có 2 phương pháp để thiết lập Cloudflare Tunnel:

### 1️⃣ Cài đặt `cloudflared` lên máy tính

Để sử dụng Cloudflare Tunnel, bạn cần cài đặt công cụ dòng lệnh `cloudflared` trên máy tính cá nhân của mình:

*   **Trên Windows**:
    *   **Cách A (Khuyên dùng)**: Sử dụng Windows Package Manager (`winget`) thông qua PowerShell/CMD:
        ```bash
        winget install Cloudflare.cloudflared
        ```
    *   **Cách B**: Tải trực tiếp file cài đặt `.msi` từ trang phát hành chính thức:
        Truy cập [GitHub Cloudflare Tunnel Releases](https://github.com/cloudflare/cloudflared/releases) -> Tải về file `cloudflared-windows-amd64.msi` và chạy để cài đặt.
*   **Trên macOS**:
    Cài đặt nhanh thông qua Homebrew:
    ```bash
    brew install cloudflared
    ```
*   **Trên Linux**:
    Tải bản phân phối phù hợp (.deb/.rpm) và cài đặt thông qua trình quản lý gói tương ứng.

Sau khi cài đặt thành công, hãy kiểm tra lại bằng lệnh:
```bash
cloudflared --version
```

---

### 2️⃣ Khởi tạo đường hầm (Tunnel) kết nối tới API Gateway (Cổng 8080)

Chọn một trong hai cách cấu hình sau đây tuỳ thuộc vào nhu cầu của bạn:

#### Cách A: Sử dụng TryCloudflare (Nhanh chóng, không cần tài khoản, miễn phí)
Đây là cách thiết lập nhanh giống như Ngrok, không cần đăng ký tài khoản Cloudflare hay cấu hình tên miền riêng.

1. Khởi chạy backend/gateway cổng `8080` của bạn dưới máy local bình thường.
2. Mở một terminal mới và chạy lệnh tạo đường hầm ẩn danh (TryCloudflare):
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
3. Cloudflare sẽ tạo ra một kết nối tunnel an toàn và hiển thị thông tin trong terminal. Hãy tìm dòng có chứa URL công cộng dạng:
   `https://xxxxx.trycloudflare.com`
4. Copy đường dẫn này lại để cấu hình cho Frontend.

> [!NOTE]
> **Hạn chế**: URL TryCloudflare là ngẫu nhiên và sẽ thay đổi mỗi khi bạn khởi động lại lệnh. Phương pháp này chỉ phù hợp để test nhanh.

---

#### Cách B: Sử dụng Cloudflare Zero Trust (Cố định, chuyên nghiệp, cần domain riêng)
Nếu bạn có một tên miền (domain) đã trỏ về Cloudflare (ví dụ: `yourdomain.com`), bạn có thể cấu hình một đường hầm cố định, chạy ngầm ổn định.

1. Truy cập trang quản trị [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com) và đăng nhập tài khoản Cloudflare của bạn.
2. Tại thanh menu bên trái, truy cập vào mục **Networks** > **Tunnels** (hoặc **Access** > **Tunnels** tùy giao diện).
3. Nhấp vào nút **Create a tunnel** -> Chọn loại **Cloudflared** -> Nhấn **Next**.
4. **Đặt tên cho Tunnel**: Nhập một tên dễ nhớ (ví dụ: `socialhub-backend-local`) -> Nhấn **Save tunnel**.
5. **Cài đặt và khởi chạy Connector**:
   - Chọn hệ điều hành máy local của bạn (ví dụ: Windows).
   - Sao chép lệnh cài đặt connector hiển thị trên màn hình (đã chứa sẵn token bí mật của tunnel) và chạy bằng quyền Administrator dưới máy local của bạn.
   - Khi trạng thái connector chuyển sang **Active** (màu xanh lá), nhấn **Next**.
6. **Cấu hình Public Hostname (Định tuyến API)**:
   - **Subdomain**: Nhập subdomain mong muốn (ví dụ: `api`).
   - **Domain**: Chọn tên miền của bạn từ danh sách (ví dụ: `yourdomain.com`).
   - **Path**: Để trống.
   - **Service**: 
     - *Type*: Chọn `HTTP`.
     - *URL*: Nhập `localhost:8080`.
   - Nhấp vào **Save tunnel**.
7. Bây giờ, mọi yêu cầu gửi tới `https://api.yourdomain.com` sẽ được Cloudflare định tuyến an toàn về API Gateway chạy tại `localhost:8080` trên máy tính của bạn. URL này là cố định và không thay đổi.

---

### 3️⃣ Cấu hình biến môi trường trên Vercel

Sau khi đã có đường hầm tunnel (ở Cách A hoặc Cách B):

1. Đăng nhập vào Dashboard của **Vercel** -> Chọn dự án `socialhub-frontend` của bạn.
2. Di chuyển sang tab **Settings** -> Chọn **Environment Variables** ở cột bên trái.
3. Thêm một biến môi trường mới:
   - **Key**: `VITE_API_URL`
   - **Value**: Dán đường dẫn tunnel của bạn vào kèm theo `/api` (ví dụ: `https://xxxxx.trycloudflare.com/api` hoặc `https://api.yourdomain.com/api`).
4. Click **Save**.
5. Di chuyển sang tab **Deployments**, tìm bản build gần nhất và click chọn **Redeploy** để Vercel rebuild lại frontend với biến môi trường mới.

---

## ⚡ So Sánh Ưu Điểm Của Cloudflare Tunnel So Với Ngrok

| Tính năng | Cloudflare Tunnel | Ngrok |
| :--- | :--- | :--- |
| **Cảnh báo trình duyệt (Browser Warning)** | **Không có**. API gọi trực tiếp mượt mờ. | Có màn hình cảnh báo, cần header bypass hoặc click thủ công. |
| **Giới hạn băng thông/Lượt gọi** | **Không giới hạn** ở gói miễn phí. | Bị giới hạn tốc độ và số lượng request đồng thời. |
| **Domain riêng miễn phí** | **Hỗ trợ** (qua Cloudflare Zero Trust). | Phải mua gói trả phí hoặc cấu hình phức tạp. |
| **Độ ổn định** | Rất cao, hỗ trợ chạy như một Background Service của Windows/macOS. | Bản miễn phí thỉnh thoảng bị ngắt kết nối tự động sau vài giờ. |

Tài liệu này bổ trợ cho tài liệu [README_VERCEL.md](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/README_VERCEL.md) giúp các nhà phát triển có thêm lựa chọn thiết lập môi trường phát triển linh hoạt.
