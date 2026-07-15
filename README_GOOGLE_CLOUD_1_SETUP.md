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
gcloud compute networks subnets create socialhub-subnet-asia --network=socialhub-vpc --region=asia-east1 --range=10.0.0.0/20 --enable-private-ip-google-access
```

### 3. Tạo Cloud NAT (Để các Pod private có thể tải thư viện ngoài internet nhưng không bị bên ngoài truy cập vào):
-   Tạo Cloud Router:
    ```bash
    gcloud compute routers create socialhub-router --network=socialhub-vpc --region=asia-east1
    ```
-   Tạo NAT Gateway:
    ```bash
    gcloud compute routers nats create socialhub-nat --router=socialhub-router --region=asia-east1 --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges
    ```

> ⚠️ **Lưu ý sửa lỗi (Troubleshooting - Lỗi 409 Already Exists)**:
> Nếu trước đó bạn đã lỡ tạo `socialhub-router` mà không chỉ định mạng (khiến nó nằm ở mạng `default`), bạn sẽ gặp lỗi `HTTPError 409`. Để dọn dẹp và đưa router về đúng mạng `socialhub-vpc`, hãy chạy chuỗi lệnh sau trước khi làm tiếp:
> ```bash
> # 1. Xóa NAT cũ bị gán sai
> gcloud compute routers nats delete socialhub-nat --router=socialhub-router --region=asia-east1 --quiet
> 
> # 2. Xóa Router cũ bị gán sai ở mạng default
> gcloud compute routers delete socialhub-router --region=asia-east1 --quiet
> 
> # 3. Tiến hành chạy lại 2 lệnh tạo Router và tạo NAT Gateway ở trên.
> ```

---


## 💾 Bước 4: Khởi Tạo Các Dịch Vụ Cơ Sở Dữ Liệu Managed

### 1. Cấp dải IP private cho kết nối Database (VPC Peering):
```bash
# Đăng ký dải IP nội bộ cho dịch vụ GCP
gcloud compute addresses create socialhub-private-ip-alloc --global --purpose=VPC_PEERING --addresses=10.128.0.0 --prefix-length=16 --network=socialhub-vpc

# Tạo kết nối Peer tới hạ tầng Database Google
gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com --ranges=socialhub-private-ip-alloc --network=socialhub-vpc
```

### 2. Tạo Google Cloud SQL for PostgreSQL (Tối ưu chi phí cho Dev):
Khởi tạo Postgres instance không gán IP công cộng, cấu hình đơn vùng (ZONAL) và tài nguyên vừa đủ để tiết kiệm chi phí:
```bash
gcloud beta sql instances create socialhub-db-postgres \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-custom-1-3840 \
    --region=asia-east1 \
    --availability-type=ZONAL \
    --network=projects/socialhub-micro-service-1/global/networks/socialhub-vpc \
    --no-assign-ip \
    --enable-google-private-path
```
*(Lưu ý: Nếu chạy Production, bạn nên đổi sang `--availability-type=REGIONAL` để có High Availability và nâng tier cấu hình lên).*

Kết quả:
```bash
Creating Cloud SQL instance for POSTGRES_16.. done.                                                                                                                                                                  
Created [https://sqladmin.googleapis.com/sql/v1beta4/projects/socialhub-micro-service-1/instances/socialhub-db-postgres].
NAME: socialhub-db-postgres
DATABASE_VERSION: POSTGRES_16
LOCATION: asia-east1-c
TIER: db-custom-1-3840
PRIMARY_ADDRESS: -
PRIVATE_ADDRESS: 10.128.0.6  <--- Ghi nhớ IP này để cập nhật vào PG_HOST trong k8s/configmap.yaml
STATUS: RUNNABLE
```

#### 🔒 BẮT BUỘC: Khởi tạo User và 3 Database Schemas (Cloud SQL mặc định sẽ rỗng):
Khi khởi tạo xong, instance chỉ có tài khoản quản trị mặc định `postgres`. Bạn bắt buộc phải chạy các lệnh sau để tạo tài khoản kết nối và phân vùng database cho các microservices:

1.  **Tạo database user `socialhub`**:
    *   Hãy đặt mật khẩu cho user này (Ví dụ: `socialhub_secret`):
        ```bash
        gcloud sql users create socialhub \
            --instance=socialhub-db-postgres \
            --password=socialhub_secret
        ```
2.  **Tạo 3 database tương ứng cho 3 dịch vụ**:
    ```bash
    # Phân vùng database cho dịch vụ Quản lý người dùng
    gcloud sql databases create socialhub_user --instance=socialhub-db-postgres

    # Phân vùng database cho dịch vụ Bạn bè
    gcloud sql databases create socialhub_friend --instance=socialhub-db-postgres

    # Phân vùng database cho dịch vụ Bài viết
    gcloud sql databases create socialhub_post --instance=socialhub-db-postgres
    ```

3.  **Mã hóa Base64 mật khẩu và nạp vào file `k8s/secrets.yaml`**:
    *   Kubernetes yêu cầu mật mã lưu trong secret phải được mã hóa dạng Base64. Hãy chạy lệnh sau trên máy của bạn (hoặc Cloud Shell) để lấy chuỗi Base64:
        ```bash
        echo -n "mật_khẩu_bạn_đặt_ở_trên" | base64
        # Ví dụ: echo -n "socialhub_secret" | base64 -> c29jaWFsaHViX3NlY3JldA==
        ```
    *   Mở file `k8s/secrets.yaml` ở local máy của bạn, dán chuỗi Base64 nhận được vào trường `PG_PASSWORD`:
        ```yaml
        PG_PASSWORD: c29jaWFsaHViX3NlY3JldA==
        ```

#### ⚠️ KHẮC PHỤC LỖI THIẾU EXTENSION UUID CHO POST-SERVICE (BẮT BUỘC):
Dịch vụ `post-service` sử dụng UUID làm khóa chính cho các bảng dữ liệu và yêu cầu extension `uuid-ossp` để sinh ID tự động. Cloud SQL mặc định sẽ không tự kích hoạt extension này, gây ra lỗi crash pod (`Exit Code 1` với thông báo `unrecognized function uuid_generate_v4()`). 

Hãy khắc phục bằng các lệnh dưới đây trên **Cloud Shell** (sau khi cụm GKE đã được tạo thành công):

1.  **Đặt mật khẩu cho tài khoản root `postgres`**:
    ```bash
    gcloud sql users set-password postgres \
        --instance=socialhub-db-postgres \
        --password=socialhub_secret
    ```
2.  **Chạy PostgreSQL Client tạm thời trong GKE để kích hoạt extension**:
    ```bash
    kubectl run pg-client --rm -i --tty --image=postgres:16 \
        --env="PGPASSWORD=socialhub_secret" \
        -- psql -h 10.128.0.6 -U postgres -d socialhub_post -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    ```
3.  **Khởi động lại Pod `post-service` để tự động chạy lại database migration**:
    ```bash
    kubectl delete pod -l app=post-service
    ```

---


### 3. Tạo Google Cloud Memorystore for Redis (Tối ưu chi phí cho Dev):

> 💡 **KHUYÊN DÙNG CHO DEV (TIẾT KIỆM CHI PHÍ - 0 USD)**:
> Bạn **KHÔNG CẦN** chạy lệnh `gcloud` tạo Memorystore Redis dưới đây. Vì Memorystore Redis có giá khá đắt (khoảng $15-30/tháng) và không hỗ trợ tạm dừng (Stop) khi không code.
> 
> Thay vào đó, chúng ta sẽ chạy Redis trực tiếp dưới dạng một **Pod bên trong cụm GKE** bằng file cấu hình [k8s/redis.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s/redis.yaml) (được định cấu hình chạy trên Spot VM siêu rẻ, tự động tắt khi cụm dừng). File [k8s/configmap.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s/configmap.yaml) đã được cấu hình trỏ kết nối mặc định vào Redis nội bộ này.

Nếu bạn vẫn muốn khởi tạo dịch vụ Managed Memorystore for Redis của Google Cloud, hãy chạy lệnh sau:
```bash
gcloud redis instances create socialhub-redis \
    --tier=BASIC \
    --size=1 \
    --region=asia-east1 \
    --network=socialhub-vpc \
    --connect-mode=private-service-access
```
*(Lưu ý: Nếu dùng cách này, bạn cần lấy IP Private của Memorystore sau khi tạo xong và cập nhật lại trường `REDIS_HOST` và `REDIS_URL` trong file `k8s/configmap.yaml`)*

### 4. Tạo Google Cloud Storage Bucket (Thay thế MinIO):
```bash
gcloud storage buckets create gs://socialhub-media-bucket-1 \
    --location=asia-east1 \
    --uniform-bucket-level-access
```

#### Tạo HMAC Access Key & Secret Key để kết nối (Tương thích S3 API):
Vì `media-service` kết nối với GCS thông qua giao thức S3 (MinIO client), bạn cần tạo khóa xác thực HMAC để lấy **Access Key** và **Secret Key**:

1.  **Chạy lệnh tạo khóa HMAC trên Cloud Shell**:
    *   *Mặc định*: Chạy lệnh tạo HMAC cho tài khoản Compute Engine chạy GKE:
        ```bash
        PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
        
        gcloud storage hmac create ${PROJECT_NUM}-compute@developer.gserviceaccount.com
        ```

2.  **⚠️ Giải quyết lỗi cấm tạo khóa (Constraint `iam.disableServiceAccountKeyCreation`):**
    Nếu Cloud Shell báo lỗi `HTTPError 412: Request violates constraint 'constraints/iam.disableServiceAccountKeyCreation'`, có nghĩa là tài khoản GCP của bạn cấm tạo khóa cho Service Account. Hãy xử lý theo một trong hai cách dưới đây:
    
    *   **Cách A (Khuyên dùng - Chạy lệnh tắt chính sách cấm)**: Nếu bạn có quyền Admin dự án, hãy chạy lệnh sau trên Cloud Shell để tạm tắt chính sách cấm tạo khóa trên dự án này:
        ```bash
        gcloud resource-manager org-policies disable-enforce \
            iam.disableServiceAccountKeyCreation \
            --project=socialhub-micro-service-1
        ```
        *Sau khi chạy lệnh trên thành công, bạn hãy chạy lại lệnh ở Bước 1 để tạo HMAC cho Service Account.*

        *Sau đó lại bật lại chính sách*
        ```bash
        gcloud resource-manager org-policies enable-enforce \
            iam.disableServiceAccountKeyCreation \
            --project=socialhub-micro-service-1
        ```
        *Nếu không bật lại chính sách, dự án của bạn sẽ có rủi ro bảo mật.* 

    *   **Cách B (Tạo thủ công trên Giao diện Web)**: Nếu không dùng lệnh được, bạn có thể tạo khóa trực tiếp từ trình duyệt:
        1. Truy cập vào trang **Cloud Storage** -> chọn **Settings** (Cài đặt).
        2. Chọn tab **Interoperability** (Khả năng tương thích).
        3. Cuộn xuống phần **Access keys for users** (Khóa truy cập cho người dùng) -> click **Create a key** (Tạo khóa) để tạo khóa cho chính tài khoản Gmail của bạn (tài khoản cá nhân không bị chặn bởi chính sách cấm của Service Account).
        4. Copy cặp `Access Key` và `Secret Key` vừa tạo để sử dụng.


3.  **Lấy kết quả và nạp vào Secret**:
    *   Kết quả trả về khi tạo thành công sẽ có dạng:
        *   `accessId: GOOGXXXXXX` -> Đây là **`MINIO_ACCESS_KEY`** của bạn.
        *   `secret: XXXXXX` -> Đây là **`MINIO_SECRET_KEY`** của bạn.
    *   Mã hóa Base64 hai giá trị này và dán đè vào `MINIO_ACCESS_KEY` và `MINIO_SECRET_KEY` trong file `k8s/secrets.yaml`.

---

### 5. Thiết lập MongoDB Atlas AWS Free Tier (Lưu trữ dữ liệu vĩnh viễn 0 USD):
Để dữ liệu MongoDB không bị mất khi bạn hủy cụm GKE (tiết kiệm chi phí khi không code), phương án tối ưu nhất là sử dụng **MongoDB Atlas Free Tier**. Do gói Free Tier chỉ khả dụng trên hạ tầng **AWS**, cụm GKE của bạn tại GCP (`asia-east1`) sẽ kết nối an toàn xuyên đám mây (Cross-Cloud) sang cụm MongoDB Atlas trên AWS thông qua mạng Internet.

#### A. Khởi tạo Database Cluster trên MongoDB Atlas:
1. Đăng ký hoặc đăng nhập tài khoản tại [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Tạo một Project mới tên là `SocialHub`.
3. Click **Create Cluster**, chọn gói **M0 Free (Miễn phí)**.
4. Chọn Cloud Provider là **Amazon Web Services (AWS)** và chọn Region khả dụng gần nhất (ví dụ: `ap-southeast-1` - Singapore hoặc `ap-east-1` - Hong Kong) để tối ưu hóa độ trễ kết nối.
5. Chờ 1-3 phút để MongoDB Atlas tạo cụm dữ liệu.

#### B. Tạo tài khoản truy cập Database (Database User):
1. Chuyển đến menu **Security** -> **Database Access** ở thanh bên trái.
2. Click **Add New Database User**:
   *   **Authentication Method**: Password.
   *   **Username**: `socialhub`
   *   **Password**: `socialhub_secret` (hoặc mật khẩu tùy chọn của bạn).
   *   **Database User Privileges**: Chọn `Read and write to any database`.
3. Click **Add User** để lưu lại.

#### C. Cấu hình Firewall cho phép cụm GKE truy cập (BẮT BUỘC):
Để cụm GKE kết nối thành công sang MongoDB Atlas (AWS), bạn cần cấu hình tường lửa (IP Whitelist) trên MongoDB Atlas. Do đặc thù môi trường Dev (thường xuyên xóa và tạo lại cụm GKE dẫn đến IP ngoại vi của Cloud NAT bị thay đổi), chúng ta áp dụng chiến lược sau:

*   **👉 Cách 1: Cho phép truy cập từ mọi nơi (`0.0.0.0/0`) (KHUYÊN DÙNG CHO DEV)**:
    *   **Cách thực hiện**: Trên trang **Network Access** (IP Access List) của MongoDB Atlas -> Click nút **+ ADD IP ADDRESS**:
        *   **Access List Entry**: Nhập thủ công `0.0.0.0/0`.
        *   **Comment**: Điền mô tả tùy chọn (ví dụ: `GKE Dev Cluster`).
        *   **Confirm**: Click nút **Confirm** màu xanh để lưu lại.
    *   **Tại sao nên dùng?**: Bạn sẽ không bao giờ lo lắng về việc IP của GKE bị thay đổi khi hủy/tái tạo cụm. Kết nối luôn thông suốt.
    *   **Tính bảo mật**: Vẫn hoàn toàn đảm bảo an toàn vì kết nối được mã hóa TLS/SSL và bảo vệ nghiêm ngặt bằng tài khoản/mật khẩu mạnh (`MONGO_PASSWORD` trong file secret). Đây là cơ chế bảo mật định danh chuẩn tương tự như các dịch vụ Cloud hiện đại (Supabase, Firebase, PlanetScale).
    *   **Mẹo (Bảo mật tạm thời)**: Ở giao diện mới 2026, bạn có thể gạt công tắc **`This entry is temporary and will be deleted in`** sang bên phải (bật) và chọn thời gian tự động xóa (ví dụ: `6 hours`, `1 day`, `1 week`) để tăng cường độ an toàn tối đa. Hết thời hạn, Atlas sẽ tự động xóa dải IP này.


*   **Cách 2: Chỉ cho phép IP tĩnh cụ thể (Chỉ dùng cho Production)**:
    *   Nếu bạn cấu hình IP tĩnh cho Cloud NAT, bạn chạy lệnh sau trên Cloud Shell để lấy IP:
        ```bash
        gcloud compute addresses list --filter="name:socialhub-nat-ip" --format="value(address)"
        ```
    *   Điền IP tĩnh lấy được vào phần **Network Access** của Atlas. *(Lưu ý: GCP tính phí thuê IP tĩnh rảnh rỗi khi cụm GKE bị xóa, nên không tối ưu cho mục tiêu tiết kiệm 0 USD khi nghỉ).*


#### D. Lấy chuỗi kết nối và quản lý bảo mật (Hạn chế lộ thông tin nhạy cảm):
1.  Tại giao diện MongoDB Atlas, click **Database** ở menu bên trái -> Click nút **Connect** ở Cluster của bạn.
2.  Chọn **Drivers**.
3.  Sao chép chuỗi kết nối (Connection String) và thay thế mật khẩu `<password>` bằng mật khẩu của bạn.
    *   *Ví dụ: `mongodb+srv://socialhub:socialhub_secret@socialhub.qfpvssq.mongodb.net/?appName=SocialHub`*
4.  **🔒 Cấu hình bảo mật để đẩy lên GitHub không bị lộ mật khẩu**:
    *   **Bước 1**: Di chuyển `MONGO_URI` sang file Secret. Hãy chạy lệnh sau trên máy của bạn (hoặc Cloud Shell) để chuyển chuỗi kết nối thành dạng Base64:
        ```bash
        echo -n "mongodb+srv://socialhub:your_password@socialhub.xxxx.mongodb.net/?appName=SocialHub" | base64
        
        # Ví dụ:

        echo -n "mongodb+srv://socialhub:MAT_KHAU_MONGODB_THAT@socialhub.qfpvssq.mongodb.net/?appName=SocialHub" | base64
        ```

    *   **Bước 2**: Mở file `k8s/secrets.yaml` và thay thế giá trị Base64 vừa tạo vào khóa `MONGO_URI`:
        ```yaml
        MONGO_URI: <DÁN_CHUỖI_BASE64_VÀO_ĐÂY>
        ```
    *   **Bước 3**: Đảm bảo tệp `k8s/secrets.yaml` được thêm vào `.gitignore` để không bao giờ bị push lên GitHub.
    *   **Bước 4 (Deploy thủ công một lần)**: Do file secret bị ẩn khỏi Git, Cloud Build sẽ không có file này khi pull code. Bạn cần mở Cloud Shell và chạy lệnh sau để deploy file secret thủ công một lần duy nhất lên cụm GKE:
        ```bash
        kubectl apply -f secrets.yaml -n default
        ```
        *(Từ nay về sau, khi bạn push code, Cloud Build chỉ cần apply các file thường, các Pod sẽ tự động đọc cấu hình MONGO_URI từ Secret có sẵn trong cụm).*

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

Kết quả:
```bash
Creating cluster socialhub-gke-cluster in asia-east1... Cluster is being health-checked (Kubernetes Control Plane is healthy)...done.                                                                                
Created [https://container.googleapis.com/v1/projects/socialhub-micro-service-1/zones/asia-east1/clusters/socialhub-gke-cluster].
To inspect the contents of your cluster, go to: https://console.cloud.google.com/kubernetes/workload_/gcloud/asia-east1/socialhub-gke-cluster?project=socialhub-micro-service-1
kubeconfig entry generated for socialhub-gke-cluster.
NAME: socialhub-gke-cluster
LOCATION: asia-east1
MASTER_VERSION: 1.35.5-gke.1241004
MASTER_IP:
MACHINE_TYPE: ek-standard-8
NODE_VERSION: 1.35.5-gke.1241004
NUM_NODES: 3
STATUS: RUNNING
STACK_TYPE: IP..
```

### 2. Khởi tạo và nạp Kubernetes Secrets lên cụm GKE (BẮT BUỘC thực hiện một lần):
Vì file `k8s/secrets.yaml` chứa thông tin nhạy cảm (như mật khẩu Database, khóa JWT, và URI MongoDB Atlas) đã được thêm vào `.gitignore` để tránh bị lộ trên GitHub, **Cloud Build sẽ không thể tự động nạp file này**. Bạn bắt buộc phải thực hiện nạp file Secret này **thủ công một lần duy nhất** trực tiếp từ **Cloud Shell** ngay sau khi khởi tạo cụm GKE thành công ở trên:

1.  Tại máy cá nhân, đảm bảo bạn đã điền các thông tin thật (như mật khẩu PostgreSQL, JWT Secret, và đặc biệt là mã hóa Base64 của `MONGO_URI` MongoDB Atlas) vào file [k8s/secrets.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s/secrets.yaml).
2.  Mở **Cloud Shell** trên GCP Console.
3.  Tạo file `secrets.yaml` trên Cloud Shell:
    ```bash
    nano secrets.yaml
    ```
    *Dán toàn bộ nội dung file `k8s/secrets.yaml` ở local của bạn vào đây, nhấn `Ctrl+O` -> `Enter` để lưu, và `Ctrl+X` để thoát.*
4.  Chạy lệnh nạp file Secret này lên cụm GKE vừa tạo:
    ```bash
    kubectl apply -f secrets.yaml -n default
    ```
    *Kubernetes sẽ lưu trữ an toàn Secret này mãi mãi trong cụm. Khi bạn cập nhật hoặc push code qua GitHub CI/CD, các Pod sẽ tự động tìm và kết nối tới Secret này mà không lo bị lộ mật khẩu lên GitHub.*

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

**Cần làm xong hết bước 1 -> 6 này**

---

## 🔐 Bước 7: Tạo Và Cấu Hình Khóa Bảo Mật (Secret Manager)

Tránh lưu các thông tin nhạy cảm như mật khẩu database, JWT_SECRET trực tiếp trong code:

1.  **Tạo khóa bí mật cho JWT**:
    ```bash
    # Khởi tạo Secret
    gcloud secrets create socialhub-jwt-secret --replication-policy="automatic"
    
    # Ghi đè giá trị bí mật
    echo -n "congdaojwttoken123" | gcloud secrets versions add socialhub-jwt-secret --data-file=-
    ```
2.  **Tạo mật khẩu cơ sở dữ liệu Postgres**:
    ```bash
    # Khởi tạo Secret
    gcloud secrets create socialhub-db-password --replication-policy="automatic"
    
    # Ghi đè giá trị mật khẩu Postgres
    echo -n "socialhub_secret" | gcloud secrets versions add socialhub-db-password --data-file=-
    ```

---

## 🚀 Hoàn Tất Thiết Lập!
Hạ tầng GCP của bạn đã sẵn sàng. Bước tiếp theo là cấu hình tệp pipeline `cloudbuild.yaml` trong mã nguồn và chạy lệnh kích hoạt build tự động để đẩy ứng dụng lên đám mây Google!

---

## 💵 Chiến Lược Tối Ưu Chi Phí Khi Phát Triển (Cost Optimization)

Hạ tầng đám mây nếu để chạy liên tục không sử dụng sẽ phát sinh chi phí hàng tháng khá lớn. Dưới đây là cách bạn có thể cấu hình tối ưu hoặc tạm dừng các dịch vụ khi không code:

### 1. Google Kubernetes Engine (GKE) Autopilot
*   **Giá thuê cụm (Cluster Management Fee)**: GKE thu phí quản lý là $0.10/giờ (~$73/tháng). Tuy nhiên, Google Cloud tặng **Free Tier credit $74.40/tháng** cho mỗi tài khoản, nghĩa là nếu bạn chỉ duy trì duy nhất 1 cụm GKE này, phí quản lý cụm sẽ **hoàn toàn miễn phí (0 USD)**.
*   **Chi phí tài nguyên VM (Node)**: GKE Autopilot chỉ tính tiền dựa trên lượng tài nguyên (CPU, RAM) mà các Pod đang chạy yêu cầu.
    *   **Tận dụng Spot Pods (Giảm 60-90% chi phí)**: Bạn có thể yêu cầu GKE chạy ứng dụng của mình trên các máy ảo Spot giá rẻ bằng cách thêm `nodeSelector` và `tolerations` vào các file deployment manifest `.yaml` của ứng dụng:
        ```yaml
        spec:
          nodeSelector:
            cloud.google.com/gke-spot: "true"
          tolerations:
          - key: "cloud.google.com/gke-spot"
            operator: "Equal"
            value: "true"
            effect: "NoSchedule"
        ```
    *   **Tạm dừng (Scale-to-Zero)**: Khi kết thúc ca làm việc và không cần test, hãy scale tất cả các Deployment của bạn về **0 replica** (ví dụ: `kubectl scale deployment auth-service --replicas=0`). Khi không có Pod nào chạy, GKE Autopilot sẽ thu hồi toàn bộ máy ảo và bạn sẽ **không tốn một đồng chi phí tài nguyên nào**.

### 2. Google Cloud SQL (PostgreSQL)
*   **Tạm dừng khi không dùng**: Cloud SQL tính tiền theo giờ hoạt động của instance độc lập với việc có kết nối hay không. Bạn có thể tạm dừng (Stop) instance qua dòng lệnh khi nghỉ để chỉ phải trả tiền lưu trữ disk rất nhỏ (không mất tiền CPU/RAM):
    *   **Tắt Database**:
        ```bash
        gcloud sql instances patch socialhub-db-postgres --activation-policy=NEVER
        ```
    *   **Bật lại Database**:
        ```bash
        gcloud sql instances patch socialhub-db-postgres --activation-policy=ALWAYS
        ```

### 3. Memorystore (Redis) và Cloud NAT
*   **Redis**: Memorystore không hỗ trợ tạm dừng. Giải pháp tiết kiệm là xóa đi khi không dùng lâu ngày và tạo lại (hoặc chuyển sang chạy Redis container ngay trong cụm GKE sử dụng Spot VM).
*   **Cloud NAT Gateway**: Có mức phí cố định khoảng ~$30/tháng để duy trì. Nếu bạn dừng code dự án trong vài tuần, nên xóa NAT Gateway và Cloud Router đi và chạy lại lệnh tạo khi cần thiết.

---

## 🧹 Hướng Dẫn Xóa Hoàn Toàn Tài Nguyên (Resource Cleanup)

Khi muốn kết thúc dự án hoặc dọn dẹp sạch sẽ toàn bộ tài nguyên trên tài khoản GCP để tránh bị trừ tiền ngoài ý muốn, hãy mở Cloud Shell và chạy các lệnh sau theo thứ tự (các tài nguyên phụ thuộc sẽ được xóa trước):

```bash
# 1. Xóa cụm GKE Autopilot (quá trình này mất khoảng 5-10 phút)
gcloud container clusters delete socialhub-gke-cluster --region=asia-east1 --quiet

# 2. Xóa cơ sở dữ liệu Cloud SQL
gcloud sql instances delete socialhub-db-postgres --quiet

# 3. Xóa Memorystore Redis
gcloud redis instances delete socialhub-redis --region=asia-east1 --quiet

# 4. Xóa NAT Gateway & Cloud Router
gcloud compute routers nats delete socialhub-nat --router=socialhub-router --region=asia-east1 --quiet
gcloud compute routers delete socialhub-router --region=asia-east1 --quiet

# Trước khi xóa VPC cần xem các cái phụ thuộc đã xóa được hết chưa
# Kiểm tra Cloud SQL
gcloud sql instances list

# Kiểm tra Memorystore Redis
gcloud redis instances list --region=asia-east1


# 5. Xóa VPC Peering và Mạng VPC
gcloud services vpc-peerings delete --network=socialhub-vpc --service=servicenetworking.googleapis.com --quiet

gcloud compute addresses delete socialhub-private-ip-alloc --global --quiet
gcloud compute networks subnets delete socialhub-subnet-asia --region=asia-east1 --quiet
gcloud compute networks delete socialhub-vpc --quiet

# => Vì 4 Lệnh trên dễ lỗi vì nhiều cái phụ thuộc.
# Xóa các cái ở dưới trước

# 5.1. Xóa Subnet trước
gcloud compute networks subnets delete socialhub-subnet-asia --region=asia-east1 --quiet

# 5.2. Xóa địa chỉ IP đã cấp phát
gcloud compute addresses delete socialhub-private-ip-alloc --global --quiet

# 5.3. Xóa mạng VPC (nó sẽ tự động ép xóa các liên kết peering liên quan nếu các tài nguyên đích đã mất)
gcloud compute networks delete socialhub-vpc --quiet


# 6. Xóa Cloud Storage Bucket
gcloud storage buckets delete gs://socialhub-media-bucket-1 --quiet

# 7. Xóa Artifact Registry (Kho chứa Docker)
gcloud artifacts repositories delete socialhub-repo --location=asia-east1 --quiet

# 8. Xóa Secret Manager
gcloud secrets delete socialhub-jwt-secret --quiet
gcloud secrets delete socialhub-db-password --quiet
```
