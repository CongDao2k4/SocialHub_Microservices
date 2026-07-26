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

---

## 🚀 5. Quy tắc Bảo vệ Các Tối ưu hóa Xử lý Media (Upload & Video Playback)

Tất cả các tối ưu hóa dưới đây là bắt buộc để duy trì tính năng upload video nhanh và xem video mượt mà (không gián đoạn) trên môi trường Local cũng như Product (như Vercel). Các tác vụ AI/coding agent sau này **TUYỆT ĐỐI không được sửa đổi, xóa bỏ hoặc làm mất hiệu lực** của các phần mã nguồn này:

*   **Không block request khi upload video (Asynchronous Transcoding)**: 
    *   Trong [media.service.js](/services/media-service/src/services/media.service.js) hàm `uploadMedia`, quá trình chuyển mã video sang định dạng HLS (`hlsService.processVideoToHLS`) phải luôn được chạy bất đồng bộ (background process/job). 
    *   API phải trả về mã phản hồi `201 Created` ngay lập tức sau khi lưu trữ thành công file video gốc lên MinIO. Nghiêm cấm sử dụng từ khóa `await` chặn dòng xử lý này.
*   **Cấm truy vấn cơ sở dữ liệu lặp lại cho từng HLS segment (Media Owner Cache)**:
    *   Trong [media.service.js](/services/media-service/src/services/media.service.js) hàm `getHlsSegment`, bắt buộc phải sử dụng bộ nhớ đệm trong RAM (`mediaOwnerCache` Map) để lưu trữ cặp `mediaId -> uploadedBy` nhằm lấy đường dẫn MinIO cho các file phân đoạn `.ts`. 
    *   Chỉ truy vấn MongoDB khi cache bị hụt (miss). Nghiêm cấm xóa bộ nhớ đệm này để tránh làm quá tải database và gây lag/buffer giật cục cho video HLS.
*   **Tối ưu hóa Reels Lazy-Loading & Socket Release (Client-Side)**:
    *   Trong [HlsVideoPlayer.jsx](/frontend/src/components/HlsVideoPlayer.jsx), chỉ được phép nạp danh sách phát HLS (playlist) và phân đoạn `.ts` khi Reel card đang thực sự được hiển thị active (`isActive === true` và `isReel === true`).
    *   Khi người dùng cuộn Reel sang trang khác hoặc khi Player bị unmount, bắt buộc phải dừng video, hủy thực thể Hls (`hls.destroy()`), gỡ bỏ thuộc tính `src` và gọi `videoNode.load()` để buộc trình duyệt giải phóng bộ nhớ đệm và đóng kết nối HTTP. Điều này giúp ngăn chặn cạn kiệt socket connection (cổ chai tối đa 6 socket của trình duyệt).
*   **Không download toàn bộ file MP4 thành Blob ở Local**:
    *   Trong [HlsVideoPlayer.jsx](/frontend/src/components/HlsVideoPlayer.jsx) hàm `loadFallbackMp4`, đối với các kết nối không chứa `ngrok` (như localhost), bắt buộc phải gán trực tiếp URL video gốc vào `video.src` để trình duyệt tự động stream thông qua HTTP Range requests thay vì tải toàn bộ file về dưới dạng Blob vào RAM.
*   **Cấu hình CORS Range trên Gateway**:
    *   Trong Gateway [app.js](/gateway/src/app.js) phần cấu hình CORS, bắt buộc phải cho phép header `Range` và expose các header `Accept-Ranges`, `Content-Range`. Nghiêm cấm xóa các cấu hình này vì sẽ làm lỗi/chặn trình duyệt từ origin ngoài (như Vercel) stream video.

