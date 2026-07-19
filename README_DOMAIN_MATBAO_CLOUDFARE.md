# 📞 Hướng Dẫn Tích Hợp HTTPS & Khắc Phục Lỗi Mic/Camera Cho Tính Năng Gọi Video (Cập nhật 2026)

Tài liệu này hướng dẫn chi tiết cách cấu hình tên miền và kích hoạt HTTPS thông qua **Cloudflare (Free Plan)** cho cả 2 môi trường: **Vercel (Frontend local debug)** và **Google Kubernetes Engine (GKE)**.

---

## 🔍 Nguyên Nhân Lỗi
Trình duyệt web hiện đại (Chrome, Safari, Firefox, Edge) áp dụng chính sách bảo mật nghiêm ngặt đối với các API đa phương tiện (`getUserMedia` - nền tảng của WebRTC). Trình duyệt **chỉ cho phép** trang web yêu cầu quyền truy cập Camera và Microphone trong một **Ngữ cảnh bảo mật (Secure Context)**, bao gồm:
1. Địa chỉ `localhost` hoặc `127.0.0.1` (phục vụ lập trình viên chạy local).
2. Các trang web chạy qua giao thức bảo mật **`https://`**.

Truy cập web trực tiếp qua địa chỉ IP dạng `http://35.x.y.z` là ngữ cảnh **không bảo mật**, nên trình duyệt sẽ tự động chặn hoàn toàn và báo lỗi thiết bị.

---

## 🛠️ PHẦN CHUNG: Chuẩn bị Tên miền & Đưa về Cloudflare (Chỉ làm 1 lần)

Để có HTTPS miễn phí và ổn định, bạn cần sở hữu một tên miền thật và quản lý DNS qua Cloudflare:

1. **Mua tên miền**: 
   - Đăng ký 1 tên miền tại các nhà cung cấp uy tín như **Mắt Bão**, **Spaceship**, **Porkbun**, hoặc **Namecheap**.
   - Nên dùng các đuôi giá rẻ như `.click`, `.xyz`, `.online` (khoảng $1.00 - $2.00 cho năm đầu) để thử nghiệm.
2. **Đăng ký tài khoản Cloudflare**: Truy cập [cloudflare.com](https://www.cloudflare.com/) và đăng ký tài khoản miễn phí.
3. **Thêm tên miền vào Cloudflare**:
   - Truy cập trang Dashboard của Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com).
   - Chọn mục **Websites** (hoặc **Trang web**) ở menu thanh bên trái.
   - Nhấp vào nút **Add a site** (hoặc **Add site** / **Thêm trang web**) ở giữa màn hình (nếu tài khoản chưa có tên miền nào) hoặc ở góc trên bên phải.
     * *Mẹo:* Bạn cũng có thể truy cập trực tiếp qua link: [https://dash.cloudflare.com/?to=/:account/add-site](https://dash.cloudflare.com/?to=/:account/add-site) sau khi đã đăng nhập.
   - Nhập tên miền bạn vừa mua (ví dụ: `socialhubzz.cloud`) và nhấn **Continue**.
   - Chọn gói **Free** (0 USD - nằm ở dưới cùng) và nhấn **Continue**.
   - Ở trang quét các bản ghi DNS (nếu hiển thị bảng trống *No DNS records* do tên miền mới tinh), cuộn xuống dưới cùng và nhấn **Continue**.
4. **Trỏ Nameservers**:
   - Cloudflare sẽ hiển thị 2 địa chỉ Nameservers mới (ví dụ: `alan.ns.cloudflare.com` và `lucy.ns.cloudflare.com`).
   - Đăng nhập vào trang quản trị nơi bạn mua tên miền (ví dụ: Mắt Bão tại [id.matbao.net](https://id.matbao.net), Porkbun, Spaceship...).
   - Tìm đến mục quản trị tên miền của bạn, chuyển sang phần cấu hình **Name Server** (hoặc **Nameservers** / **Custom DNS**).
     * *Lưu ý (Đối với Mắt Bão):* Chọn tab **Name Server** (nằm ngay bên trái tab *Bản ghi DNS*) để chỉnh sửa.
   - Thay thế các dòng Nameservers mặc định cũ (ví dụ: `ns1.matbao.com` và `ns2.matbao.com`) bằng 2 địa chỉ Nameservers mới do Cloudflare cung cấp ở trên.
   - Nhấn **Lưu** hoặc **Cập nhật** để xác nhận thay đổi.
5. **Xác thực kết nối**:
   - Quay lại Cloudflare, nhấn **Done, check nameservers** (Đã xong, kiểm tra nameservers).
   - Đợi từ 5-15 phút để hệ thống Internet cập nhật DNS hoàn tất. Khi thành công, tên miền trên Cloudflare sẽ chuyển sang trạng thái **Active** (Hoạt động).

---

## 💻 CÁCH 1: Vận Hành Vercel (Frontend) + Local Backend (Cố định đường hầm)

Nếu bạn chạy frontend trên Vercel và muốn kết nối với API Gateway (`localhost:8080`) dưới máy local để phát triển và kiểm tra tính năng Video Call:

Thay vì dùng TryCloudflare sinh ra URL ngẫu nhiên mỗi lần chạy, ta sử dụng **Cloudflare Zero Trust** để tạo một đường hầm với tên miền cố định. Bạn không bao giờ phải redeploy lại Vercel nữa.

### Bước 1: Tạo Tunnel cố định trên Cloudflare Zero Trust (Giao diện mới 2026)
1. Trên Cloudflare Dashboard, tại menu bên trái chọn **Zero Trust**.
2. Tìm đến mục **Networks** -> **Tunnels & Mesh** -> Nhấn **Create a tunnel** (hoặc **Add a tunnel**).
3. Chọn **Cloudflared** -> Nhấn **Next**.
4. Đặt tên Tunnel là `local-backend` -> Nhấn **Save tunnel**.
5. **Cài đặt Connector**:
   - Chọn hệ điều hành máy tính local của bạn (ví dụ: `Windows`).
    - Mở PowerShell/Terminal dưới quyền Administrator trên máy tính và chạy câu lệnh vừa copy để cài đặt `cloudflared` làm Background Service. 
    - > [!WARNING]
      > **XỬ LÝ LỖI "service is already installed"**: Nếu PowerShell báo lỗi dịch vụ đã được cài đặt sẵn từ trước, hãy chạy 2 lệnh sau bằng quyền Administrator để gỡ bỏ dịch vụ cũ và cài lại dịch vụ mới:
      > 1. Gỡ bỏ dịch vụ cũ:
      >    ```powershell
      >    cloudflared service uninstall
      >    ```
      > 2. Chạy lại câu lệnh cài đặt service với token mới của bạn (câu lệnh copy trên Cloudflare Dashboard).
      > 3. Khởi động lại dịch vụ nếu cần:
      >    ```powershell
      >    Start-Service cloudflared
      >    ```
      > *Hoặc nếu bạn chỉ muốn chạy thử nhanh (không cài service ngầm), bạn có thể chạy trực tiếp bằng lệnh:*
      > ```powershell
      > cloudflared tunnel run --token <TOKEN_CỦA_BẠN>
      > ```
      > *Cài Service ngầm thì dùng lệnh:*
      > ```powershell
      > cloudflared service install <TOKEN_CỦA_BẠN>
      > ```
      > *Sau đó chạy*
      > ```cmd
      > net start Cloudflared
      > sc qc Cloudflared
      > ```
    - Khi connector hiển thị trạng thái `Active` (màu xanh) trên dashboard của Cloudflare, nhấn **Next**.

   - **Cách 2: Cài Docker Cloudfare**
    - Tạo file `docker-compose.yml` trong thư mục `root\cloudfare-tunnel`
    - Tạo `.env` trong thư mục `root\cloudfare-tunnel`
     - ```env
       CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
       ``` 
    - ```yaml
      version: '3.8'
      services:
        cloudflared:
          image: cloudflare/cloudflared:latest
          container_name: cloudflared
          restart: unless-stopped
          env_file:
            - .env
          environment:
            - CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
          command:
            - tunnel
            - --no-autoupdate
            - run
            - --token
            - ${CLOUDFLARE_TUNNEL_TOKEN}

          logging:
            driver: json-file
            options:
              max-size: "10m"
              max-file: "3"
      ``` 
    - Chạy lệnh: docker compose up -d

6. **Cấu hình định tuyến (Public Hostname)**:
   Bạn có thể cấu hình định tuyến này theo 2 cách trên giao diện mới:
   * **Cách 1 (Ngay khi tạo Tunnel)**: Sau khi chạy Connector ở bước trên và thấy trạng thái `Active`, nhấn **Next** để chuyển sang bước tiếp theo cấu hình Public Hostname.
   * **Cách 2 (Cấu hình sau/Sửa đổi)**: 
     * Vào **Zero Trust** -> **Networks** -> **Tunnels & Mesh** -> Tìm tunnel `local-backend` -> click **Configure** -> Chọn tab **Published application routes** (như trên hàng tab trong ảnh của bạn) -> Nhấn **Add a route** (hoặc **Add public hostname**).
     * *Lưu ý*: Tab **Hostname routes (Beta)** mà bạn đang mở ở ảnh trước là dành cho định tuyến nội bộ (Private Network), yêu cầu client WARP/Gateway nên không dùng cho web public.

    **Cấu hình chi tiết:**
    - **Subdomain**: Nhập `api-local`.
    - **Domain**: Chọn tên miền của bạn (ví dụ: `socialhub.click`).
    - **Path**: Để trống.
    - **Service**: 
      - *Type*: Chọn `HTTP`
      - *URL*: Chọn giá trị phù hợp với cách cài đặt `cloudflared` của bạn:
        * **Trường hợp 1 (Nếu chạy Docker cloudflared chung mạng `socialhub_app-network` - KHUYÊN DÙNG)**: Nhập **`http://gateway:8000`** (vì trong mạng Docker, `gateway` là tên service và chạy ở cổng `8000`).
        * **Trường hợp 2 (Nếu chạy Docker cloudflared nhưng không chung mạng)**: Nhập **`http://host.docker.internal:8080`** (để trỏ về cổng của host máy chính).
        * **Trường hợp 3 (Nếu cài cloudflared trực tiếp bằng file exe/service trên Windows/Mac)**: Nhập **`http://localhost:8080`**.
    - Nhấn **Save tunnel** hoặc **Save hostname**.

*Từ lúc này, đường dẫn `https://api-local.yourdomain.com` sẽ cố định và trỏ thẳng về backend local của bạn.*

### Bước 2: Cấu hình biến môi trường trên Vercel
1. Đăng nhập vào [Vercel Dashboard](https://vercel.com/) -> Chọn dự án `socialhub-frontend`.
2. Vào **Settings** -> **Environment Variables**.
3. Thêm hoặc cập nhật biến:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://api-local.yourdomain.com` (Thay `yourdomain.com` bằng tên miền thật của bạn).
4. Lưu lại, sang tab **Deployments** và chọn **Redeploy** bản build mới nhất của frontend.
5. **Vận hành thử nghiệm**: Mỗi khi code local, bạn chỉ cần khởi động backend cổng 8080 và chạy connector. Vercel (đang chạy trên HTTPS mặc định của Vercel) sẽ kết nối an toàn với máy local của bạn qua HTTPS. Tính năng Video Call hoạt động hoàn toàn bình thường.

---

## 📡 CÁCH 2: Triển Khai GKE Hoàn Chỉnh (Sử dụng Cloudflare DNS Proxy)

Nếu bạn đã deploy toàn bộ hệ thống lên cụm GKE trên Google Cloud. Khi cụm restart hoặc redeploy, các dịch vụ sẽ được cấp phát các địa chỉ IP Public mới. Bạn sẽ cập nhật thủ công các IP này lên DNS Cloudflare để chạy HTTPS.

### Bước 1: Lấy IP Public mới từ GKE
Mở Cloud Shell hoặc Terminal của bạn, chạy lệnh sau:
```bash
kubectl get svc
```
Tìm cột **`EXTERNAL-IP`** của 2 dịch vụ sau:
- **`frontend`** (ví dụ: `35.234.12.34`) - Giao diện người dùng.
- **`gateway`** (ví dụ: `34.124.56.78`) - API Gateway kết nối microservices.

### Bước 2: Cấu hình IP và bật Proxy trên Cloudflare DNS (Giao diện mới 2026)
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Chọn tên miền của bạn từ danh sách.
2. Tại menu bên trái, tìm và chọn mục **DNS** -> **Records** (ở giao diện mới, mục **DNS** sẽ hiển thị trực tiếp danh sách bản ghi DNS).
3. Nhấp vào nút **Add record** và thêm mới (hoặc chỉnh sửa) 2 bản ghi **A** sau:

#### 1. Bản ghi cho Giao diện GKE:
- **Type**: Chọn `A`
- **Name**: Nhập `gke`
- **IPv4 address**: Nhập IP của service **`frontend`** (ví dụ: `35.234.12.34`).
- **Proxy status**: 🟠 **Proxied** (Gạt nút bật đám mây màu cam).
- Nhấp **Save**.

#### 2. Bản ghi cho API Gateway GKE:
- **Type**: Chọn `A`
- **Name**: Nhập `api`
- **IPv4 address**: Nhập IP của service **`gateway`** (ví dụ: `34.124.56.78`).
- **Proxy status**: 🟠 **Proxied** (Gạt nút bật đám mây màu cam).
- Nhấp **Save**.

> [!NOTE]
> Bật trạng thái **Proxied** giúp Cloudflare tự động đứng ra làm trung gian SSL (HTTPS), mã hóa lưu lượng từ client đến Cloudflare và định tuyến về GKE mà không cần cấu hình TLS/Let's Encrypt thủ công trên Kubernetes.

> [!IMPORTANT]
> **CẤU HÌNH BẮT BUỘC ĐỂ TRÁNH LỖI TIMEOUT (ERROR 522) VÀ CHẠY HTTPS:**
> 1. **Chuyển SSL/TLS Mode sang Flexible**: Do dịch vụ chạy trên GKE mặc định lắng nghe ở cổng HTTP `80` hoặc `8080` (không cài chứng chỉ SSL trực tiếp trên GKE), bạn **bắt buộc** phải cấu hình SSL/TLS Mode trên Cloudflare Dashboard thành **`Flexible`** (thay vì *Full* hoặc *Full strict*). Nếu không, Cloudflare sẽ cố kết nối đến GKE qua cổng 443 và gây lỗi `Connection timed out (Error 522)`.
> 2. **Định tuyến Port cho Gateway bằng Cloudflare Origin Rules (Giữ Gateway chạy cổng `8080` trên GKE)**:
>    Vì Gateway chạy ở cổng `8080` trên Kubernetes, nhưng Frontend gọi API qua HTTPS cổng `443` ngầm định (`https://api.socialhubzz.cloud`), hãy cấu hình một **Origin Rule** trên Cloudflare để tự động đổi cổng:
>    - Vào Cloudflare Dashboard -> Chọn tên miền `socialhubzz.cloud`.
>    - Tại menu bên trái, tìm và chọn mục **Rules** (hoặc **Rules** -> **Overview**).
>    - Nhấp vào nút **`+ Create rule`** (màu xanh ở góc trên bên phải).
>    - Từ menu thả xuống, chọn **`Origin Rule`** (nằm trong nhóm *Modify Cloudflare configurations and behaviors*).
>    - Đặt tên quy tắc ở phần **Rule name**: ví dụ `Route API to Port 8080`.
>    - Ở mục **If incoming requests match...** (Nếu request khớp với điều kiện):
>      - *Field*: Chọn **Hostname**
>      - *Operator*: Chọn **equals**
>      - *Value*: Nhập **`api.socialhubzz.cloud`**
>    - Ở mục **Destination Port** (ở phía dưới cùng):
>      - Chọn **Rewrite to...** (Thay vì *Preserve*)
>      - Nhập giá trị: **`8080`**
>    - Nhấn **Deploy** (Triển khai).
>    *(Quy tắc này giúp Cloudflare nhận request HTTPS từ client ở cổng mặc định, sau đó tự chuyển tiếp đến cổng `8080` của IP LoadBalancer GKE).*

### Bước 3: Build và Deploy Frontend lên GKE
Khi build frontend để đẩy lên GKE thông qua Cloud Build, tệp cấu hình đã được thiết lập mặc định để nhận tên miền HTTPS:
1. Kiểm tra file `cloudbuild.yaml` đã trỏ đúng tên miền API Gateway của bạn ở phần substitutions:
  `socialhubzz.cloud` là tên miền thì điền
   ```yaml
   substitutions:
     _VITE_API_URL: "https://api.socialhubzz.cloud"
   ```
   
   Vì `api` là ứng với `gateway` ở step 2.
   
2. Thực hiện Trigger Cloud Build để đóng gói và triển khai lên cụm GKE.

### Bước 4: Kiểm tra và Vận hành
- Truy cập vào: `https://gke.socialhubzz.cloud` (Trình duyệt sẽ hiển thị ổ khóa xanh và cho phép yêu cầu Camera/Mic).
- Các API request của frontend sẽ gửi tới `https://api.socialhubzz.cloud/api` (Cũng chạy qua HTTPS và hoạt động đồng bộ).
- **Mỗi lần khởi chạy lại cụm GKE**: Chỉ cần vào tab DNS của Cloudflare và sửa lại giá trị **IPv4 address** của 2 bản ghi `gke` và `api` thành IP mới là xong. Hệ thống sẽ hoạt động ngay lập tức sau 1 phút mà không cần redeploy code.
