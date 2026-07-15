# Quy tắc phát triển dự án SocialHub Microservices trên Google Cloud Platform (GCP)

Tài liệu này chứa các quy tắc thiết kế hệ thống, bảo mật, và tối ưu hóa chi phí mà tác vụ AI Antigravity bắt buộc phải đọc và tuân thủ mỗi khi thực hiện thay đổi mã nguồn hoặc triển khai tài nguyên trên GCP.

---

## 🔒 1. Quy tắc Bảo mật & Quản lý Secrets (Secrets Management)

*   **Không đẩy Secrets lên Git**: TUYỆT ĐỐI không commit các chuỗi kết nối chứa mật khẩu plain-text (ví dụ: `MONGO_URI` chứa mật khẩu Atlas, `PG_PASSWORD`, khóa `JWT_SECRET`, hoặc `MINIO_SECRET_KEY`) lên kho lưu trữ GitHub.
*   **Sử dụng Kubernetes Secrets**: 
    *   Tất cả các thông tin nhạy cảm phải được mã hóa dạng **Base64** và lưu trữ trong file `k8s/secrets.yaml`.
    *   Tệp `k8s/secrets.yaml` phải luôn nằm trong danh sách loại trừ của `.gitignore` để tránh bị đẩy lên GitHub.
*   **Triển khai thủ công một lần**: 
    *   File secret phải được nạp lên cụm GKE thủ công một lần duy nhất trực tiếp từ Cloud Shell bằng lệnh: `kubectl apply -f secrets.yaml -n default`.
    *   Các pipeline CI/CD (Cloud Build hoặc GitHub Actions) chỉ nạp các file config và deployment thông thường từ Git, các Pod sẽ tự động tham chiếu đến Secret đã nạp sẵn trong cụm bằng cú pháp `secretKeyRef`.

---

## 📊 2. Quy tắc Tối ưu hóa Logs & Tiết kiệm chi phí Cloud Monitoring

Khi chạy trên môi trường Production (GKE), Google Cloud tính phí theo dung lượng log nạp vào. Để tránh phát sinh hóa đơn lớn từ **Cloud Monitoring / Cloud Logging**, hãy áp dụng 3 quy tắc tối ưu hóa log sau:

*   **Quy tắc 1 (Console Logs)**: Tất cả các file chạy chính (entrypoint) như `index.js` hoặc `server.js` phải có bộ lọc ghi đè vô hiệu hóa `console.log`, `console.info`, và `console.debug` khi phát hiện `ENVIRONMENT === 'production'`. Chỉ giữ lại `console.warn` và `console.error` để giám sát lỗi.
*   **Quy tắc 2 (Morgan HTTP Logs)**: Đối với các logger HTTP (Morgan), chỉ ghi log khi xảy ra lỗi thực tế (Status Code >= 400) trên production bằng cách sử dụng cấu hình `skip: (req, res) => res.statusCode < 400`. Bỏ qua toàn bộ log của các request thành công (như ping `/health` tự động của K8s).
*   **Quy tắc 3 (Prisma SQL Logs)**: Đối với Prisma client, chỉ bật log `error` khi ở production (`log: ['error']`) để tránh in hàng ngàn câu lệnh truy vấn SQL ra console.

---

## 💸 3. Quy tắc Dọn dẹp Tài nguyên & Tiết kiệm chi phí vận hành (0 USD khi nghỉ)

*   **Dừng GKE triệt để**: GKE Autopilot tính phí duy trì cụm cố định là **$0.10/giờ (~$72/tháng)** kể cả khi không chạy Pod nào (replicas = 0). Do đó, khi tạm dừng phát triển (vài ngày hoặc vài tuần), phải **xóa sạch cụm GKE** bằng lệnh: `gcloud container clusters delete socialhub-gke-cluster --region=asia-east1`.
*   **Tắt database Cloud SQL**: Dừng máy chủ cơ sở dữ liệu để không bị tính tiền CPU/RAM bằng lệnh: `gcloud sql instances patch socialhub-db-postgres --activation-policy=NEVER`.
*   **Khôi phục nhanh**: Lập trình viên có thể dựng lại cụm bất kỳ lúc nào bằng lệnh tạo cluster, nạp lại secrets thủ công một lần, và nhấn Approve trên Cloud Build.

---

## ☸️ 4. Quy tắc Cấu hình Kubernetes Manifests

*   **Sử dụng Spot VMs**: Tất cả các tệp YAML triển khai dịch vụ (deployment) trong `k8s/` phải có cấu hình chạy trên node Spot VMs để tiết kiệm 60-90% chi phí chạy máy ảo:
    ```yaml
    nodeSelector:
      cloud.google.com/gke-spot: "true"
    tolerations:
    - key: "cloud.google.com/gke-spot"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
    ```
*   **Bật Extension Postgres UUID**: Khi tạo database mới trên Cloud SQL, bắt buộc phải kích hoạt extension `uuid-ossp` thông qua client tạm thời trước khi khởi động `post-service` để tránh lỗi thiếu hàm `uuid_generate_v4()`.
