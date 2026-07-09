# Hướng Dẫn Từng Bước Thiết Lập Dự Án Trên Google Cloud Platform (GCP)

Tài liệu này hướng dẫn chi tiết từ số 0 để thiết lập môi trường, cấp quyền API và khởi tạo toàn bộ tài nguyên cần thiết cho hệ thống **SocialHub Microservices** trên dự án GCP của bạn.

---

## ⚙️ Thông Số Cấu Hình Mặc Định (Default Parameters)
-   **Project ID**: `socialhub-micro-service-1`
-   **Vùng địa lý (Region)**: `asia-east1` (Đài Loan - Vùng có độ trễ thấp nhất về Việt Nam)
-   **Mạng VPC**: `socialhub-vpc`
-   **Subnet**: `socialhub-subnet-asia`

---

## 🛠️ Bước 1: Cài Đặt & Cấu Hình Google Cloud CLI (gcloud)

Để điều khiển toàn bộ tài nguyên GCP từ dòng lệnh của máy tính cá nhân:
1.  **Tải xuống gcloud CLI**:
    *   Tải bản cài đặt tại: [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) và tiến hành cài đặt vào máy tính.
2.  **Đăng nhập tài khoản Google Cloud**:
    *   Mở Terminal/PowerShell và gõ lệnh:
        ```bash
        gcloud auth login
        ```
    *   Trình duyệt sẽ tự động mở ra. Đăng nhập bằng tài khoản Google mà bạn đã tạo dự án GCP.
3.  **Đặt Project mặc định cho các phiên làm việc**:
    ```bash
    gcloud config set project socialhub-micro-service-1
    ```
4.  **Đặt Region mặc định**:
    ```bash
    gcloud config set compute/region asia-east1
    ```

---

## 🔌 Bước 2: Kích Hoạt Các API Của Google Cloud (Enable APIs)

Mặc định, các dự án GCP mới tạo sẽ bị tắt toàn bộ API dịch vụ. Chạy lệnh sau để kích hoạt tất cả các API cần dùng cùng một lúc:

```bash
gcloud services enable \
    compute.googleapis.com \
    container.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    clouddeploy.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    secretmanager.googleapis.com \
    servicenetworking.googleapis.com
```
*(Đợi 2 - 3 phút để hệ thống GCP kích hoạt xong các cổng dịch vụ)*

---

## 🌐 Bước 3: Thiết Lập Mạng Nội Bộ Bảo Mật (VPC, NAT Gateway)

Để các pod của GKE và cơ sở dữ liệu có thể liên lạc nội bộ với nhau một cách an toàn và không bị lộ ra ngoài internet.

### 1. Tạo mạng VPC riêng:
```bash
gcloud compute networks create socialhub-vpc --subnet-mode=custom
```

### 2. Tạo Subnet nội bộ tại vùng `asia-east1`:
```bash
gcloud compute networks subnets create socialhub-subnet-asia \
    --network=socialhub-vpc \
    --region=asia-east1 \
    --range=10.0.0.0/20 \
    --enable-private-ip-google-access
```

### 3. Tạo Cloud NAT (Để các Pod private có thể tải thư viện ngoài internet nhưng không bị bên ngoài truy cập vào):
-   Tạo Cloud Router:
    ```bash
    gcloud compute routers create socialhub-router \
        --network=socialhub-vpc \
        --region=asia-east1
    ```
-   Tạo NAT Gateway:
    ```bash
    gcloud compute routers nats create socialhub-nat \
        --router=socialhub-router \
        --region=asia-east1 \
        --auto-allocate-nat-external-ips \
        --nat-all-subnet-ip-ranges
    ```

---

## 💾 Bước 4: Khởi Tạo Các Dịch Vụ Cơ Sở Dữ Liệu Managed

### 1. Cấp dải IP private cho kết nối Database (VPC Peering):
```bash
# Đăng ký dải IP nội bộ cho dịch vụ GCP
gcloud compute addresses create socialhub-private-ip-alloc \
    --global \
    --purpose=VPC_PEERING \
    --addresses=10.128.0.0 \
    --prefix-length=16 \
    --network=socialhub-vpc

# Tạo kết nối Peer tới hạ tầng Database Google
gcloud services vpc-peerings connect \
    --service=servicenetworking.googleapis.com \
    --ranges=socialhub-private-ip-alloc \
    --network=socialhub-vpc
```

### 2. Tạo Google Cloud SQL for PostgreSQL (Cấu hình High Availability - HA):
Khởi tạo Postgres instance không gán IP công cộng, chỉ cho phép kết nối nội bộ từ VPC:
```bash
gcloud beta sql instances create socialhub-db-postgres \
    --database-version=POSTGRES_16 \
    --tier=db-custom-2-7680 \
    --region=asia-east1 \
    --availability-type=REGIONAL \
    --network=projects/socialhub-micro-service-1/global/networks/socialhub-vpc \
    --no-assign-ip \
    --enable-private-path
```

### 3. Tạo Google Cloud Memorystore for Redis (HA Mode):
```bash
gcloud redis instances create socialhub-redis \
    --size=2 \
    --region=asia-east1 \
    --network=socialhub-vpc \
    --connect-mode=private-service-access
```

### 4. Tạo Google Cloud Storage Bucket (Thay thế MinIO):
```bash
gcloud storage buckets create gs://socialhub-media-bucket-1 \
    --location=asia-east1 \
    --uniform-bucket-level-access
```

---

## ☸️ Bước 5: Khởi Tạo Cụm GKE Autopilot (Google Kubernetes Engine)

Dựng cụm Kubernetes chạy ở chế độ Autopilot và chế độ Node Private hoàn toàn bảo mật:
```bash
gcloud container clusters create-auto socialhub-gke-cluster \
    --region=asia-east1 \
    --network=socialhub-vpc \
    --subnetwork=socialhub-subnet-asia \
    --enable-private-nodes \
    --master-ipv4-cidr=172.16.0.0/28
```

---

## 🤖 Bước 6: Thiết Lập Kho Chứa Docker & Phân Quyền CI/CD (IAM Roles)

Để **Cloud Build** và **Cloud Deploy** có đủ quyền tự động đóng gói docker và triển khai bản cập nhật lên cụm GKE:

### 1. Tạo kho chứa Docker (Google Artifact Registry):
```bash
gcloud artifacts repositories create socialhub-repo \
    --repository-format=docker \
    --location=asia-east1 \
    --description="Docker repository for SocialHub"
```

### 2. Cấp quyền cho Tài khoản Dịch vụ Cloud Build (Cloud Build Service Account):
Lấy số ID dự án của bạn để xác định địa chỉ email Service Account mặc định:
```bash
# Lấy Project Number của dự án
PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")

# Email Service Account Cloud Build có cấu trúc: [PROJECT_NUM]@cloudbuild.gserviceaccount.com
BUILD_SA="${PROJECT_NUM}@cloudbuild.gserviceaccount.com"

# A. Cấp quyền ghi ảnh Docker vào Artifact Registry
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/artifactregistry.writer"

# B. Cấp quyền chạy Pipeline Google Cloud Deploy
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/clouddeploy.releaser"

# C. Cấp quyền deploy ứng dụng vào cụm Kubernetes GKE
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/container.developer"

# D. Cấp quyền đọc cấu hình/mật khẩu trong Secret Manager
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/secretmanager.secretAccessor"

# E. Cấp quyền thao tác lưu trữ log và build artifacts trong Cloud Storage
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/storage.admin"
```

---

## 🔐 Bước 7: Tạo Và Cấu Hình Khóa Bảo Mật (Secret Manager)

Tránh lưu các thông tin nhạy cảm như mật khẩu database, JWT_SECRET trực tiếp trong code:

1.  **Tạo khóa bí mật cho JWT**:
    ```bash
    # Khởi tạo Secret
    gcloud secrets create socialhub-jwt-secret --replication-policy="automatic"
    
    # Ghi đè giá trị bí mật
    echo -n "chuoi-bi-mat-jwt-an-toan-cua-ban" | gcloud secrets versions add socialhub-jwt-secret --data-file=-
    ```
2.  **Tạo mật khẩu cơ sở dữ liệu Postgres**:
    ```bash
    # Khởi tạo Secret
    gcloud secrets create socialhub-db-password --replication-policy="automatic"
    
    # Ghi đè giá trị mật khẩu Postgres
    echo -n "mat-khau-database-socialhub" | gcloud secrets versions add socialhub-db-password --data-file=-
    ```

---

## 🚀 Hoàn Tất Thiết Lập!
Hạ tầng GCP của bạn đã sẵn sàng. Bước tiếp theo là cấu hình tệp pipeline `cloudbuild.yaml` trong mã nguồn và chạy lệnh kích hoạt build tự động để đẩy ứng dụng lên đám mây Google!
