# 🌐 Hướng Dẫn Kiểm Thử API & Triển Khai Website Frontend (Vercel / GKE Nginx)

Tài liệu này hướng dẫn chi tiết cách kiểm tra tính hoạt động của cụm Microservices thông qua API Gateway trên GCP và các bước để triển khai giao diện người dùng (Frontend Website) kết nối với hệ thống Backend.

---

## 🔍 PHẦN 1: Kiểm Thử Hệ Thống Microservices (API Health Checks)

Sau khi toàn bộ 9 Pod đã ở trạng thái `Running`, API Gateway là cửa ngõ duy nhất để chúng ta giao tiếp với Backend. Bạn có thể sử dụng `curl` trên Cloud Shell hoặc Postman ở máy cá nhân để kiểm tra:

### 1. Lấy địa chỉ IP Public của API Gateway:
Chạy lệnh sau trên Cloud Shell:
```bash
kubectl get service gateway -n default
```
*Kết quả mẫu:*
```bash
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)          AGE
gateway   LoadBalancer   10.8.12.155   35.221.161.252   8080:31252/TCP   5m
```
👉 Lưu lại địa chỉ **`EXTERNAL-IP`** (ví dụ ở đây là `35.221.161.252`). Cổng kết nối công khai của Gateway được cấu hình là **`8080`**.

### 2. Các Endpoint Kiểm Thử Nhanh:

*   **Kiểm tra kết nối API Gateway (Health Check)**:
    ```bash
    curl http://<GATEWAY_EXTERNAL_IP>:8080/health
    # Kết quả mong đợi: {"status":"ok","service":"gateway","timestamp":"..."}
    ```
*   **Xem tài liệu API tự động (Swagger)**:
    Mở trình duyệt trên máy của bạn và truy cập:
    `http://<GATEWAY_EXTERNAL_IP>:8080/api-docs`

*   **Kiểm thử đăng ký tài khoản (Đoạn này sẽ gọi tới user-service & ghi Postgres)**:
    ```bash
    curl -X POST -H "Content-Type: application/json" \
      -d '{"username":"congtest","email":"congtest@gmail.com","password":"Password123"}' \
      http://<GATEWAY_EXTERNAL_IP>:8080/api/auth/register
    ```
*   **Kiểm thử đăng nhập (Lấy JWT Token)**:
    ```bash
    curl -X POST -H "Content-Type: application/json" \
      -d '{"email":"congtest@gmail.com","password":"Password123"}' \
      http://<GATEWAY_EXTERNAL_IP>:8080/api/auth/login
    ```

---

## ⚡ PHẦN 2: Triển Khai Frontend Lên Vercel (Cách Nhanh Nhất)

Vercel là nền tảng máy chủ Serverless hoàn hảo để chạy ứng dụng React/Vite Frontend vì nó miễn phí, tự cấp phát SSL/HTTPS và tốc độ CDN cực nhanh.

### Các bước thực hiện:
1.  **Đẩy code lên GitHub**: Đảm bảo toàn bộ dự án của bạn đã được push lên GitHub.
2.  **Đăng nhập Vercel**: Truy cập [Vercel](https://vercel.com) và đăng nhập bằng tài khoản GitHub của bạn.
3.  **Import Dự Án**: 
    *   Click **Add New** -> **Project** -> Chọn repository `SocialHub_Microservices`.
    *   Tại mục **Root Directory**, click **Edit** và chọn thư mục **`frontend`** (thay vì root dự án).
4.  **Cấu hình Biến Môi Trường (Environment Variables)**:
    *   Cuộn xuống phần **Environment Variables**, điền biến sau:
        *   **Key**: `VITE_API_URL`
        *   **Value**: `http://<GATEWAY_EXTERNAL_IP>:8080` (Thay bằng IP thật của API Gateway lấy ở Phần 1).
5.  **Deploy**: Click nút **Deploy**. 
    *   Vercel sẽ tự động build ứng dụng React/Vite và cấp cho bạn một domain HTTPS miễn phí (ví dụ: `https://socialhub-frontend.vercel.app`).
    *   Mở link này trên trình duyệt là bạn có thể trải nghiệm đăng ký/đăng nhập và chat trực tiếp!

---

## 🐳 PHẦN 3: Triển Khai Frontend Lên GKE Autopilot (Nginx - Chuẩn Cloud-Native)

Nếu bạn muốn đóng gói và quản lý Frontend trực tiếp trong cụm Kubernetes để phục vụ cho các bài toán nâng cao sau này (như load balancing, circuit breakers, CDN tích hợp, hoặc reverse proxy), hệ thống đã được chuẩn bị sẵn cấu hình chạy Frontend bằng **Nginx trên Spot VMs** tiết kiệm chi phí.

### Các bước thực hiện:

#### Bước 1: Khởi chạy build Frontend qua Cloud Build (Có truyền IP Gateway động):
Vì Frontend được biên dịch tĩnh, biến môi trường `VITE_API_URL` phải được nạp vào lúc build Docker. Hãy chạy lệnh thông minh sau trên **Cloud Shell** để tự động lấy IP Gateway và trigger Cloud Build:

```bash
# 1. Lấy IP Gateway đang chạy trên cụm
GATEWAY_IP=$(kubectl get service gateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# 2. Trigger Cloud Build đóng gói và deploy Frontend lên GKE
gcloud builds submit . \
    --config=cloudbuild.yaml \
    --substitutions=_VITE_API_URL="http://${GATEWAY_IP}:8080"
```

*Lệnh trên sẽ:*
*   Tự lấy IP LoadBalancer của Gateway.
*   Đưa vào làm `--build-arg` để build Docker Frontend React.
*   Push ảnh lên Artifact Registry.
*   Deploy tài nguyên [k8s/frontend.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s/frontend.yaml) lên GKE.

#### Bước 2: Kiểm tra trạng thái Pod Frontend:
Chạy lệnh:
```bash
kubectl get pods -l app=frontend -n default
```
Khi Pod ở trạng thái `Running`, hãy lấy IP Public của trang Web:
```bash
kubectl get service frontend -n default
```
*Kết quả mẫu:*
```bash
NAME       TYPE           CLUSTER-IP   EXTERNAL-IP     PORT(S)        AGE
frontend   LoadBalancer   10.8.5.210   34.80.125.99    80:30000/TCP   2m
```
👉 Mở trình duyệt và truy cập trực tiếp địa chỉ **`http://34.80.125.99`** (cổng 80 mặc định) để vào giao diện mạng xã hội SocialHub!

---

## 🛠️ PHẦN 4: Hướng Phát Triển Nâng Cao (Circuit Breakers & Load Balancing)

Khi bạn chạy Frontend bằng Nginx trực tiếp trong cụm GKE (Phần 3), bạn có thể dễ dàng mở rộng hạ tầng này trong tương lai:

1.  **Cấu hình Nginx làm Reverse Proxy**:
    Bạn có thể sửa file cấu hình Nginx trong Dockerfile để Frontend điều hướng trực tiếp các request `/api/*` về `http://gateway:8000` (sử dụng DNS nội bộ của Kubernetes). Điều này giúp trình duyệt gọi API qua cùng một Domain của Frontend, loại bỏ hoàn toàn lỗi CORS và không cần lộ IP Gateway ra ngoài.
2.  **Tích hợp Service Mesh (Istio / Linkerd)**:
    Khi chạy trong GKE, bạn có thể cài đặt Istio để tự động áp dụng các cơ chế:
    *   **Circuit Breaker (Ngắt mạch)**: Nếu `chat-service` bị lỗi quá 5 lần, GKE sẽ tạm ngắt kết nối gửi tới dịch vụ này để bảo vệ hệ thống không bị quá tải.
    *   **Rate Limiting**: Giới hạn số lượt gọi API trên từng Pod.
    *   **Canary Deployment (Triển khai Canary)**: Điều hướng 10% lượng traffic của người dùng sang giao diện Frontend mới để thử nghiệm trước khi phát hành chính thức.
