# Hướng Dẫn Chạy Local & Deploy Frontend Lên Vercel

Tài liệu này hướng dẫn chi tiết dành cho người mới bắt đầu để:
1. Chạy mã nguồn giao diện (Frontend React + Vite) dưới máy cục bộ (không dùng Docker).
2. Cấu hình và deploy giao diện này lên dịch vụ hosting đám mây **Vercel** miễn phí.

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

## 🌐 3. Kết Nối Frontend Trên Vercel Với Backend Chạy Cục Bộ (Sử Dụng Ngrok)

Khi deploy giao diện lên Vercel, ứng dụng của bạn sẽ chạy trên cloud công cộng. Tuy nhiên, API Gateway và các microservices của bạn lại đang chạy trên cổng `localhost:8080` của máy cá nhân. Giao diện chạy trên Vercel không thể gọi trực tiếp tới `localhost` của bạn được.

Để giải quyết vấn đề này, ta sẽ sử dụng công cụ **Ngrok** để tạo ra một đường hầm (tunnel) an toàn từ internet công cộng đi thẳng vào cổng local `8080` của bạn.

### Các bước thiết lập Ngrok chi tiết:

#### 1️⃣ Cài đặt Ngrok lên máy tính
Có hai cách đơn giản để cài đặt ngrok trên máy tính của bạn:

*   **Cách A: Cài đặt nhanh qua NPM (Khuyên dùng cho NodeJS developers)**
    Mở terminal (PowerShell hoặc CMD với quyền Administrator) và chạy lệnh cài đặt toàn cục sau:
    ```bash
    npm install -g ngrok
    ```
    *Ưu điểm: Ngrok sẽ tự động cấu hình đường dẫn hệ thống (Environment Path) để bạn có thể gõ lệnh `ngrok` ở bất kỳ đâu.*

*   **Cách B: Tải trực tiếp file chạy (Executable)**
    1. Truy cập [https://ngrok.com/download](https://ngrok.com/download) và tải phiên bản phù hợp với hệ điều hành (ví dụ: file zip cho Windows).
    2. Giải nén file tải về, bạn sẽ nhận được một tệp tin duy nhất là `ngrok.exe`.
    3. Bạn có thể kéo file `ngrok.exe` này vào thư mục dự án SocialHub (thư mục root chứa file `docker-compose.yml`) để tiện mở terminal và chạy trực tiếp bằng lệnh:
       - Trên Windows PowerShell: `./ngrok`
       - Trên Windows CMD hoặc macOS: `ngrok`

#### 2️⃣ Lấy và thiết lập Token xác thực (Auth Token)
Ngrok yêu cầu một Token xác thực miễn phí để cho phép tạo đường hầm HTTPS:
1. Đăng ký/Đăng nhập tài khoản của bạn tại website [ngrok.com](https://ngrok.com/).
2. Truy cập tab **Your Authtoken** ở menu bên trái để lấy mã token cá nhân (một dãy ký tự dài).
3. Chạy lệnh sau trong terminal để lưu token vào máy tính (chỉ cần làm một lần duy nhất):
   - **Nếu cài qua Cách A**: Hoặc tải ngrok từ Microsoft Store về
     ```bash
     ngrok config add-authtoken <mã-token-của-bạn>
     ```
   - **Nếu cài qua Cách B (chạy file trực tiếp trong thư mục dự án)**:
     ```bash
     ./ngrok config add-authtoken <mã-token-của-bạn>
     ```
3. **Mở đường hầm kết nối tới API Gateway (Cổng 8080)**:
   - Trong khi backend và gateway của bạn vẫn đang chạy bình thường, hãy mở một terminal mới và chạy lệnh tương ứng với cách cài đặt:
     - **Nếu cài qua Cách A**:
       ```bash
       ngrok http 8080
       ```
     - **Nếu cài qua Cách B**:
       ```bash
       ./ngrok http 8080
       ```
   - Ngrok sẽ hiển thị một bảng thông tin, trong đó có mục **Forwarding** hiển thị đường dẫn HTTPS công cộng dạng:
     `https://xxxx-xxxx.ngrok-free.app`
   - Copy đường dẫn HTTPS này lại (đây chính là địa chỉ API Gateway công cộng của bạn).

### Cấu hình biến môi trường trên Vercel:

1. Vào Dashboard của **Vercel** -> Chọn dự án `socialhub-frontend` của bạn.
2. Di chuyển sang tab **Settings** -> Chọn **Environment Variables** ở cột bên trái.
3. Thêm một biến môi trường mới:
   - **Key**: `VITE_API_URL` (Tên biến mà code frontend của bạn dùng để gọi api).
   - **Value**: Dán đường dẫn HTTPS ngrok của bạn vào (ví dụ: `https://xxxx-xxxx.ngrok-free.app/api`).
4. Click **Save**.
5. Di chuyển sang tab **Deployments**, tìm bản build gần nhất và click chọn **Redeploy** để Vercel build lại frontend với biến môi trường mới.

> [!IMPORTANT]
> **Lưu ý bỏ qua cảnh báo của Ngrok (Ngrok Browser Warning Bypass)**:
> Mặc định, Ngrok sẽ hiển thị một trang cảnh báo "You are about to connect to..." cho tất cả các request lần đầu qua trình duyệt. Điều này sẽ khiến các hàm fetch/axios từ frontend trên Vercel bị chặn và báo lỗi.
> 
> **Cách xử lý**:
> - **Cách nhanh nhất**: Truy cập link `https://xxxx-xxxx.ngrok-free.app` trực tiếp trên trình duyệt của bạn một lần đầu tiên và click nút **Visit Site**. Trình duyệt sẽ lưu cookie xác nhận và các cuộc gọi API từ frontend sau đó sẽ hoạt động bình thường.
> - **Cách triệt để (trong code)**: Cấu hình các request gọi API từ Axios/Fetch ở Frontend gửi kèm theo Header:
>   `"ngrok-skip-browser-warning": "any-value"`
>   Header này sẽ báo cho Ngrok bỏ qua trang cảnh báo và trả thẳng kết quả JSON về cho ứng dụng.
