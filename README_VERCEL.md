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
