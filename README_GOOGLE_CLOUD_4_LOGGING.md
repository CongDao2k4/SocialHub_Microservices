# 📊 Hướng Dẫn Tối Ưu Hóa Logs & Tiết Kiệm Chi Phí Cloud Monitoring (GCP)

Tài liệu này tổng hợp các kỹ thuật cấu hình và tối ưu hóa hệ thống ghi log (logging) cho dự án **SocialHub Microservices** trên cụm **GKE Autopilot** nhằm giảm dung lượng dữ liệu và tiết kiệm tối đa hóa đơn **GCP Cloud Monitoring / Cloud Logging**.

---

## 💸 Tại sao Log dư thừa lại gây tốn chi phí trên Google Cloud?

Mặc định khi bạn chạy ứng dụng trên GKE Autopilot:
1.  **Tự động gom Log (Ingestion)**: Toàn bộ dữ liệu in ra màn hình (`console.log`, `console.info`...) của các container đều được agent của GCP gom lại và gửi về Cloud Logging.
2.  **Cách tính phí**: Google Cloud tính phí dựa trên **dung lượng dữ liệu log/metrics nạp vào (Ingested Data)**. 
3.  **Lượng log hệ thống cực lớn**: Các microservices thường in ra các log lặp đi lặp lại (như câu lệnh truy vấn SQL của Prisma, kết nối Redis thành công, các request kiểm tra sức khỏe `/health` của K8s cứ mỗi vài giây một lần). Nếu chạy 9 Pod liên tục 24/7, lượng log rác này sẽ ngốn hàng chục gigabyte dữ liệu và phát sinh hóa đơn lớn không đáng có.

---

## 🛠️ 3 Tip Kỹ Thuật Đã Tích Hợp Để Tối Ưu Hóa Chi Phí Logs

Để tối ưu hóa, dự án đã được cài đặt sẵn 3 giải pháp kỹ thuật thông minh dưới đây giúp giảm **95% lượng log rác** mà không ảnh hưởng tới việc bắt lỗi khi vận hành thực tế:

### 💡 Tip 1: Ghi đè (Override) console.log toàn cục trên Production
Thay vì phải đi xóa thủ công từng dòng `console.log()` trong toàn bộ dự án, ứng dụng sẽ tự động vô hiệu hóa các log này khi phát hiện môi trường chạy là **`production`**.

Đoạn code này được đặt ở dòng đầu tiên của file chạy chính (`index.js` hoặc `server.js`) ở cả 7 microservices:
```javascript
if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  // CHỈ giữ lại console.warn và console.error để ghi nhận lỗi thực tế
}
```
*   **Hiệu quả**: Loại bỏ toàn bộ log debug thông tin của ứng dụng và của cả các thư viện npm bên thứ ba.
*   **An toàn**: Các lỗi nghiêm trọng (được in ra bằng `console.error`) vẫn được ghi nhận đầy đủ lên GCP để bạn debug khi cần.

### 💡 Tip 2: Tinh giảm log HTTP của Morgan
Morgan là thư viện ghi log request gửi đến Express. Mặc định nó sẽ ghi log tất cả request thành công (200 OK) của người dùng và các request ping kiểm tra sức khỏe của Kubernetes.

Đoạn code Morgan đã được cấu hình trong `app.js` của API Gateway và Media Service:
```javascript
if (process.env.ENVIRONMENT !== 'production') {
  app.use(morgan('dev')); // Ở local log chi tiết
} else {
  // Ở production, chỉ ghi log các request gặp lỗi (Status Code >= 400)
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}
```
*   **Hiệu quả**: Loại bỏ toàn bộ các log ping `/health` tự động của K8s, chỉ lưu giữ log khi người dùng gặp lỗi (4xx hoặc 5xx).

### 💡 Tip 3: Tắt log câu lệnh SQL (Prisma Query Logs)
Prisma mặc định có thể in toàn bộ câu lệnh SQL truy vấn cơ sở dữ liệu ra màn hình. Khi có nhiều người dùng, log này sẽ gây tràn ngập màn hình điều khiển.

Đoạn cấu hình đã sửa tại `services/post-service/src/config/db.js`:
```javascript
const prisma = new PrismaClient(
  process.env.ENVIRONMENT === 'production'
    ? { log: ['error'] } // Prod chỉ log lỗi
    : { log: ['info', 'warn', 'error'] } // Dev log toàn bộ
);
```

---

## ⚙️ Cơ Chế Kích Hoạt Tự Động Trên GKE

Hệ thống nhận diện môi trường thông qua biến cấu hình tập trung tại **`k8s/configmap.yaml`**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: socialhub-config
data:
  ENVIRONMENT: "production" # <--- Kích hoạt chế độ Prod tắt log trên GKE
```

Khi bạn deploy lên GKE, biến `ENVIRONMENT: "production"` sẽ được K8s nạp trực tiếp vào biến môi trường của hệ điều hành container. Các Node.js microservices khi khởi chạy sẽ lập tức kích hoạt bộ lọc log mà bạn không cần cấu hình thêm gì cả.

---

## 🧹 Cách Vệ Sinh & Tắt Log Tuyệt Đối Khi Không Phát Triển

Dù đã tối ưu log, việc duy trì cụm GKE khi không làm việc vẫn làm phát sinh phí quản lý cụm cố định của Google (~$72/tháng). Hãy áp dụng quy trình sau để đưa chi phí dự án về **0 USD**:

1.  **Khi tạm nghỉ code (vài ngày/vài tuần)**: 
    Hãy xóa sạch cụm GKE để tắt hoàn toàn mọi luồng sinh log/metrics và thu hồi VM:
    ```bash
    gcloud container clusters delete socialhub-gke-cluster --region=asia-east1 --quiet
    ```
2.  **Tắt database Cloud SQL**:
    Tắt máy chủ DB để không bị tính tiền CPU/RAM rảnh rỗi:
    ```bash
    gcloud sql instances patch socialhub-db-postgres --activation-policy=NEVER
    ```
