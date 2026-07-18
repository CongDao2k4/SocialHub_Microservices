# Hướng Dẫn Tích Hợp CI/CD Lên Google Cloud Platform (GCP)

Tài liệu này hướng dẫn chi tiết cách thiết lập hệ thống tích hợp và triển khai liên tục (CI/CD) cho dự án **SocialHub Microservices** lên cụm **GKE Autopilot** (vùng `asia-east1`).

Chúng ta có **2 phương pháp** chính để thiết lập pipeline. Vui lòng chọn một phương pháp phù hợp với luồng công việc của bạn:

---

## ⚡ Các Tối Ưu Hóa Quan Trọng Đã Cấu Hình
*   **Tốc độ Build cực nhanh**: Cả hai cách đều hỗ trợ build song song 7 microservices cùng lúc. Trong `cloudbuild.yaml`, ta sử dụng máy ảo lớn cấu hình cao **`E2_HIGHCPU_8`** (8 vCPUs, 8 GB RAM) giúp rút ngắn thời gian build từ 30 phút xuống còn 3 - 5 phút.
*   **Tiết kiệm chi phí**: Mọi tác vụ build, registry và deploy đều được neo chặt tại vùng **`asia-east1`** (Đài Loan) để giảm tối đa chi phí truyền tải dữ liệu liên vùng (cross-region data transfer) và tận dụng hạ tầng có sẵn.
*   **Spot Pods**: Các file Kubernetes manifests tại thư mục [k8s/](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s) đã được cấu hình mặc định chạy trên **Spot VMs** để giảm 60 - 90% chi phí chạy node.

---

> ⚠️ **ĐIỀU KIỆN TIÊN QUYẾT BẮT BUỘC (Prerequisites)**:
> Trước khi thực hiện bất kỳ thiết lập CI/CD nào dưới đây, hãy đảm bảo bạn đã:
> 1. Khởi tạo thành công cụm GKE Autopilot.
> 2. Đã nạp thủ công file mật mã **`secrets.yaml`** (chứa mật khẩu PostgreSQL, JWT Secret, và URI MongoDB Atlas thật) lên cụm GKE của bạn. 
>    *   *Xem hướng dẫn chi tiết cách nạp tại **Bước 5 - Mục 2** của tài liệu [README_GOOGLE_CLOUD_SETUP.md](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/README_GOOGLE_CLOUD_SETUP.md#l250).*
>    *   *Nếu bỏ qua bước nạp Secret này, pipeline deploy sẽ thất bại hoặc các Pod microservices khi chạy lên sẽ bị crash liên tục (CrashLoopBackOff) vì thiếu thông tin xác thực database.*

---

## 🛠️ CÁCH 1: Google Cloud Build (Tích hợp All-in-GCP)

Phương pháp này sử dụng trực tiếp công cụ Google Cloud Build để lắng nghe sự kiện push code trên GitHub và tự động chạy file [cloudbuild.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/cloudbuild.yaml).

### 1. Tạo và cấp quyền cho Dedicated Service Account của Cloud Build
Theo chuẩn bảo mật mới nhất của Google Cloud, các Service Account mặc định (như `@cloudbuild.gserviceaccount.com`) sẽ **không được hiển thị** trong danh sách dropdown vì chúng là tài khoản do Google quản lý. Để thực thi Trigger một cách an toàn và có thể lựa chọn được trong dropdown, bạn cần tạo một **User-Managed Service Account chuyên dụng** (Dedicated Service Account):

Mở Cloud Shell và chạy chuỗi lệnh sau để tạo và cấp quyền:

```bash
# 1. Khai báo ID dự án và lấy Project Number
PROJECT_ID="socialhub-micro-service-1"
PROJECT_NUM=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")

# 2. Tạo Service Account chuyên dụng cho Cloud Build
gcloud iam service-accounts create socialhub-build-sa \
    --display-name="SocialHub Cloud Build Execution SA"

# 3. Cấp quyền ghi log cho Service Account mới
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter" \
    --condition=None

# 4. Cấp quyền đẩy ảnh Docker vào Artifact Registry
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" \
    --condition=None

# 5. Cấp quyền Deploy ứng dụng lên cụm GKE
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/container.developer" \
    --condition=None

# 6. Cấp quyền đọc Token của Developer Connect (để kéo code từ GitHub)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/developerconnect.readTokenAccessor" \
    --condition=None

# 7. Cấp quyền chạy cho Service Agent của Cloud Build (Bắt buộc để Cloud Build có quyền giả danh tài khoản này)
gcloud iam service-accounts add-iam-policy-binding socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com \
    --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# 8. Cấp quyền Token Accessor cho Service Agent của Cloud Build
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
    --role="roles/developerconnect.tokenAccessor" \
    --condition=None
```

### 2. Liên kết kho chứa GitHub và Tạo Trigger trên Console (Thông qua Developer Connect - 2nd gen)
Theo chuẩn mới nhất của Google Cloud, việc kết nối kho lưu trữ GitHub được quản lý tập trung thông qua dịch vụ **Developer Connect** (Thế hệ 2):

1.  **Thiết lập kết nối (Connection)**:
    *   Trong Google Cloud Console, tìm kiếm và truy cập vào dịch vụ **Developer Connect**.
    *   Click **Create Connection**, chọn nhà cung cấp là **GitHub**.
    *   Chọn Vùng (Region) hoạt động là **`asia-east1`** (Bắt buộc để giữ toàn bộ pipeline hoạt động tại vùng này).
    *   Click **Continue** và làm theo hướng dẫn để cấp quyền truy cập (OAuth) cho Google Developer Connect cài đặt GitHub App trên tài khoản GitHub của bạn.
2.  **Liên kết Repo (Link Repositories)**:
    *   Tại giao diện Developer Connect, chuyển đến mục **Repositories**.
    *   Click **Link repository**, chọn kết nối bạn vừa tạo và chọn kho lưu trữ `SocialHub_Microservices`.
    *   Click **Link** để hoàn thành liên kết.
3.  **Tạo Trigger trong Cloud Build**:
    *   Mở trang **Cloud Build** -> Chọn tab **Triggers** -> Click **Create Trigger**.
    *   **Name**: `socialhub-github-trigger`
    *   **Region**: Chọn **`asia-east1`** (Đảm bảo khớp với vùng của kết nối và cụm GKE).
    *   **Event**: `Push to a branch`
    *   **Source**: Chọn **Repository (2nd gen)**.
    *   **Repository**: Chọn repo đã liên kết qua Developer Connect ở bước trên.
    *   **Branch**: `^main$` (Hoặc `^master$`)
    *   **Approval**: **Không chọn / Để trống** (Không tích vào ô *"Require approval before build executes"*. Nếu tích chọn ô này, mỗi lần bạn push code lên GitHub, build sẽ bị tạm dừng và bắt bạn phải vào GCP Console phê duyệt thủ công thì build mới chạy). Bạn sẽ phải đăng nhập vào Google Cloud Console, tìm đến tab Cloud Build, và bấm nút "Approve" (Duyệt) thủ công thì build mới bắt đầu chạy.
        * Sau khi bạn đã tạo Trigger xong, nếu sau này muốn thay đổi cấu hình (bật hoặc tắt tính năng duyệt thủ công), bạn chỉ cần làm như sau:
            * Vào trang Cloud Build -> Chọn tab Triggers.
            * Click vào tên trigger của bạn (socialhub-github-trigger) hoặc bấm vào dấu 3 chấm ở góc phải và chọn Edit (Sửa).
            * Cuộn xuống phần Approval và tích chọn hoặc bỏ tích chọn ô "Require approval before build executes".
            * Kéo xuống cuối trang và bấm Save (Lưu).
    *   **Configuration**: Chọn `Cloud Build configuration file (yaml or json)`
    *   **Cloud Build configuration file location**: `/cloudbuild.yaml` (Mặc định ở thư mục gốc).
    *   **Service Account** (Mục Nâng cao/Advanced): Chọn **`socialhub-build-sa@socialhub-micro-service-1.iam.gserviceaccount.com`** (Tài khoản chuyên dụng đã tạo và cấp quyền ở Bước 1).
4.  Nhấn **Create** để hoàn tất cấu hình tự động.

> ⚠️ **LƯU Ý SỬA LỖI (Troubleshooting - Lỗi cấu hình Trigger)**:
> 
> *   **Trường hợp 1: Chỉ chọn được Connection nhưng không chọn được Repository (Danh sách Repo bị trống)**:
>     Nguyên nhân do **Cloud Build Service Agent** của dự án chưa có quyền đọc Token từ Developer Connect. Đảm bảo bạn đã chạy lệnh cấp quyền **C** ở **Mục 1**:
>     ```bash
>     PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
>     gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
>         --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
>         --role="roles/developerconnect.tokenAccessor" \
>         --condition=None
>     ```
>     Sau đó **F5 reload** lại trang tạo Trigger.
> 
> *   **Trường hợp 2: Cảnh báo màu cam về quyền `developerconnect.readTokenAccessor` và không tìm thấy tài khoản mặc định `@cloudbuild.gserviceaccount.com` trong dropdown**:
>     *   **Lý do không thấy `@cloudbuild.gserviceaccount.com`**: Tài khoản cũ đó là tài khoản do Google quản lý (Google-managed), nên các trang Console mới của Cloud Build không cho phép chọn trực tiếp từ dropdown nữa.
>     *   **Giải pháp bảo mật (Khuyên dùng)**: Thay vì dùng tài khoản Compute Engine mặc định có quyền quá rộng (Editor), bạn hãy làm theo **Mục 1** ở trên để tạo tài khoản **`socialhub-build-sa`**. Tài khoản này là tài khoản do bạn tự quản lý (User-managed) nên sẽ **hiển thị trong dropdown** để bạn chọn. Khi chọn tài khoản này, bạn sẽ không gặp lỗi phân quyền vì bước 1 đã cấp đủ quyền `readTokenAccessor` cho nó.
>     *   **Giải pháp chữa cháy nhanh**: Nếu bạn vẫn muốn dùng Compute Engine mặc định (`...-compute@developer.gserviceaccount.com`), chỉ cần bấm nút **"Grant all"** ngay trên giao diện cảnh báo để Google Cloud tự cấp quyền `readTokenAccessor` cho nó. Hoặc chạy lệnh CLI:
>         ```bash
>         PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
>         gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
>             --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
>             --role="roles/developerconnect.readTokenAccessor" \
>             --condition=None
>         ```
> 
> *   **Trường hợp 3: Các Pod rơi vào trạng thái `ImagePullBackOff` hoặc `ErrImagePull` sau khi deploy lên cụm GKE**:
>     *   **Nguyên nhân**: Cụm GKE Autopilot chạy trên các node sử dụng tài khoản Compute Engine mặc định (`...-compute@developer.gserviceaccount.com`). Nếu tài khoản này thiếu quyền đọc ảnh từ Artifact Registry, Kubernetes sẽ không thể kéo ảnh về để chạy Pod.
>     *   **Cách khắc phục**: Mở Cloud Shell và chạy lệnh cấp quyền đọc (Registry Reader) sau:
>         ```bash
>         PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
>         gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
>             --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
>             --role="roles/artifactregistry.reader" \
>             --condition=None
>         ```
>     *   **Cách chẩn đoán lỗi khác**: Nếu đã chạy lệnh trên mà vẫn lỗi, chạy lệnh sau để xem lỗi chi tiết (ví dụ: sai tag hoặc sai tên ảnh):
>         ```bash
>         kubectl describe pod <tên-pod-bị-lỗi> -n default
>         ```

### 3. Lệnh chạy thử nghiệm thủ công (Manual Trigger)
Nếu bạn muốn kích hoạt build và deploy ngay lập tức từ máy tính cá nhân (hoặc Cloud Shell) bằng file cấu hình tối ưu cấu hình cao mà không cần push code lên GitHub:

```bash
# Gửi tác vụ build lên Cloud Build tại vùng asia-east1
gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD) \
    --region=asia-east1 .
```

### 4. Lệnh dọn dẹp (Xóa Trigger)
Nếu bạn không muốn sử dụng Cloud Build Trigger nữa để tránh việc vô tình build gây tốn tiền:

```bash
gcloud beta builds triggers delete socialhub-github-trigger --region=asia-east1 --quiet
```

### 5. Cách hoạt động chạy thường ngày:

Vì bạn đã **push code trước khi tạo Trigger và kết nối Developer Connect**, nên sự kiện push đó sẽ không tự động kích hoạt build (vì lúc đó Trigger chưa tồn tại để bắt sự kiện).

Tuy nhiên, lúc này bạn đã cấu hình xong Trigger và cũng đã bật tính năng **Require Approval (Yêu cầu phê duyệt)**, bạn có 2 cách để bắt đầu chạy build đầu tiên:

---

#### Cách A: Kích hoạt chạy thủ công trên GCP Console (Nhanh nhất)
Bạn không cần push lại code, chỉ cần chạy trigger có sẵn bằng cách:
1.  Truy cập vào trang **Cloud Build** -> chọn tab **Triggers**.
2.  Tìm trigger `socialhub-github-trigger` và click nút **Run** (Chạy) ở góc phải.
3.  Chọn nhánh chạy là **`main`** (hoặc `master` tùy repo của bạn) -> click **Run Trigger**.
4.  Ngay sau đó, bạn chuyển sang tab **History (Lịch sử)** bên tay trái. Bạn sẽ thấy một bản build mới được tạo ra ở trạng thái **Pending (Đang chờ duyệt)** (màu vàng có biểu tượng ổ khóa).
5.  Click vào bản build đó -> Click nút **Approve (Phê duyệt)** ở góc trên -> Chọn **Approve** lần nữa để xác nhận. Bản build sẽ bắt đầu chạy thực tế.

---

#### Cách B: Push một commit mới lên GitHub (Tự động kích hoạt)
Bạn có thể tạo một commit trống để tạo sự kiện push mới lên GitHub:
1.  Mở terminal tại thư mục dự án và chạy:
    ```bash
    git commit --allow-empty -m "ci: trigger first cloud build pipeline"
    git push origin main
    ```
2.  Sau khi push thành công, bạn quay lại trang **Cloud Build** -> chọn tab **History (Lịch sử)**.
3.  Bạn cũng sẽ thấy bản build tự động xuất hiện ở trạng thái **Pending (Đang chờ duyệt)**. Click vào đó và chọn **Approve** tương tự như trên để chạy!

---

## 🤖 CÁCH 2: GitHub Actions (Tích hợp qua Workload Identity Federation)

Phương pháp này điều phối toàn bộ luồng tích hợp và triển khai từ GitHub Actions thông qua file cấu hình [.github/workflows/gke-deploy.yml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/.github/workflows/gke-deploy.yml) (hiện đang được comment toàn bộ để tránh chạy tự động). 

Cách này sử dụng cơ chế bảo mật **Workload Identity Federation (WIF) - Xác thực không dùng khóa (Keyless)**. GitHub Actions sẽ tự động trao đổi Identity Token ngắn hạn (chỉ có hiệu lực trong vài phút) với GCP WIF để đăng nhập, loại bỏ hoàn toàn việc phải lưu trữ file JSON Key (Service Account Key) trên GitHub Secrets vốn rất dễ bị lộ.

---

### 1. Tạo Service Account chuyên dụng cho GitHub Actions
Mở Cloud Shell và chạy lệnh tạo tài khoản dịch vụ do người dùng quản lý:
```bash
gcloud iam service-accounts create socialhub-github-sa \
    --display-name="GitHub Actions Service Account"
```

---

### 2. Cấp quyền IAM tối thiểu (Least Privilege) cho Service Account
Bạn cần cấp các quyền cần thiết để tài khoản này đẩy ảnh Docker vào registry và kích hoạt deploy trên cụm GKE. Do dự án có thể có chính sách Boundary IAM, ta thêm cờ `--condition=None` để tránh lỗi nhắc nhở:

```bash
# A. Quyền ghi và đẩy ảnh Docker lên Artifact Registry
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" \
    --condition=None

# B. Quyền quản lý và deploy Kubernetes trên cụm GKE
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com" \
    --role="roles/container.developer" \
    --condition=None
```

---

### 3. Tạo Workload Identity Pool & Provider cho GitHub Actions
Thiết lập cổng kết nối tin cậy giữa dịch vụ xác thực OIDC của GitHub và Google Cloud:

```bash
# A. Tạo Workload Identity Pool (Bể chứa danh tính)
gcloud iam workload-identity-pools create socialhub-wif-pool \
    --location=global \
    --display-name="SocialHub WIF Pool"

# B. Tạo OIDC Provider (Nhà cung cấp dịch vụ liên kết danh tính)
gcloud iam workload-identity-pools providers create-oidc socialhub-github-provider \
    --location=global \
    --workload-identity-pool=socialhub-wif-pool \
    --display-name="SocialHub GitHub Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.subject,attribute.repository=assertion.repository,attribute.actor=assertion.actor"
```

---

### 4. Liên kết OIDC Provider với Service Account của GitHub
Bạn cần cấp quyền giả danh (Impersonate) cho repo GitHub của bạn thông qua Pool đã tạo. Hãy thay đổi `'YOUR_GITHUB_USERNAME/SocialHub_Microservices'` bằng đường dẫn repository thật của bạn:
*   *Ví dụ: `CongDao2k4/SocialHub_Microservices` hoặc `minhtuan1102/SocialHub_Microservices`*

```bash
# 1. Lấy Project Number của dự án
PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")

# 2. Thực hiện liên kết bảo mật (Thay 'YOUR_GITHUB_USERNAME' bằng tài khoản Github của bạn)
gcloud iam service-accounts add-iam-policy-binding socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/socialhub-wif-pool/attribute.repository/YOUR_GITHUB_USERNAME/SocialHub_Microservices"
```

---

### 5. Cấu hình GitHub Variables
Để bảo mật và tái sử dụng, tệp workflow YAML sử dụng các biến động. Bạn hãy cấu hình các biến này trực tiếp trên GitHub:

1.  Vào Repository của bạn trên GitHub -> **Settings** -> **Secrets and variables** -> **Actions**.
2.  Chọn tab **Variables** (ở bên cạnh Secrets) -> click **New repository variable** và thêm lần lượt các biến sau:
    *   `GCP_PROJECT_ID`: `socialhub-micro-service-1`
    *   `GCP_REGION`: `asia-east1`
    *   `GAR_REPOSITORY`: `socialhub-repo`
    *   `GKE_CLUSTER`: `socialhub-gke-cluster`
    *   `WIF_PROVIDER`: Điền đường dẫn đầy đủ của Pool Provider. 
        *   Cú pháp: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/socialhub-wif-pool/providers/socialhub-github-provider`
        *   *(Thay `<PROJECT_NUMBER>` bằng số dự án lấy từ lệnh `gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)"`)*
    *   `WIF_SERVICE_ACCOUNT`: `socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com`

---

### 6. Cách kích hoạt chạy thử nghiệm & Cơ chế chạy song song (Matrix Build)
Để kích hoạt, bạn chỉ cần gỡ các dấu comment `#` khỏi tệp [.github/workflows/gke-deploy.yml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/.github/workflows/gke-deploy.yml), thực hiện commit và push lên GitHub:

```bash
git add .github/workflows/gke-deploy.yml
git commit -m "ci: enable github actions workflow with parallel matrix builds"
git push origin main
```

#### 💡 Cơ chế hoạt động của Matrix Build:
*   **Job 1: Build & Push**: GitHub Actions sẽ tự động khởi chạy **8 máy ảo Ubuntu chạy song song** (Matrix) hoàn toàn miễn phí để đóng gói Docker cho 8 dịch vụ cùng lúc (`frontend`, `gateway`, và 6 microservices). Việc chạy song song này giúp thời gian đóng gói Docker của toàn bộ hệ thống hoàn thành chỉ trong **vòng 3 phút**.
*   **Job 2: Deploy GKE**: Chỉ chạy sau khi Job 1 hoàn thành. GitHub Actions đăng nhập vào GKE thông qua WIF, tự động lấy tags của commit hiện tại và thay thế các placeholder trong thư mục `k8s/`, sau đó chạy `kubectl apply -f k8s/` để deploy lên GKE.
*   **⚠️ Lưu ý về Secrets**: Do `k8s/secrets.yaml` đã bị bỏ qua bởi Git, bạn phải đảm bảo đã nạp thủ công file `secrets.yaml` lên GKE trước khi chạy workflow này (xem hướng dẫn ở Bước 5 mục 2 trong file `README_GOOGLE_CLOUD_SETUP.md`).

---

### 7. Hướng dẫn sửa các lỗi thường gặp (Troubleshooting WIF)
*   **Lỗi `403: Subject unsanctioned/Permission Denied`**:
    *   *Nguyên nhân*: Do sai lệch đường dẫn Repository cấu hình trong phần `gcloud iam service-accounts add-iam-policy-binding`.
    *   *Cách sửa*: Chạy lại lệnh ở **Mục 4**, kiểm tra kỹ xem tên tài khoản GitHub và tên Repo đã viết đúng chữ hoa chữ thường chưa (Git phân biệt chữ hoa chữ thường, ví dụ: `SocialHub_Microservices` khác với `socialhub_microservices`).
*   **Lỗi `400: Identity Provider not found`**:
    *   *Nguyên nhân*: Do biến `WIF_PROVIDER` trên GitHub Variables điền sai định dạng hoặc sai số `PROJECT_NUMBER`.
    *   *Cách sửa*: Sử dụng lệnh `gcloud projects describe` để lấy chính xác Project Number và điền lại biến trên GitHub.

---

### 8. Lệnh dọn dẹp (Xóa cấu hình WIF & Service Account)
Khi kết thúc dự án và muốn xóa bỏ các kết nối bảo mật này để tránh phát sinh tài nguyên rác:

```bash
# 1. Xóa OIDC Provider
gcloud iam workload-identity-pools providers delete socialhub-github-provider \
    --workload-identity-pool=socialhub-wif-pool \
    --location=global --quiet

# 2. Xóa Workload Identity Pool
gcloud iam workload-identity-pools delete socialhub-wif-pool \
    --location=global --quiet

# 3. Xóa Service Account của GitHub
gcloud iam service-accounts delete socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com --quiet
```
---

## 🔍 CẨM NANG VẬN HÀNH, GIÁM SÁT VÀ DEBUG TRÊN KUBERNETES (GKE)

Dưới đây là các câu lệnh `kubectl` thiết yếu giúp bạn vận hành, kiểm tra trạng thái và xử lý lỗi hệ thống trực tiếp trên Cloud Shell:

### 1. Kiểm tra trạng thái tài nguyên
```bash
# Xem toàn bộ các Pod đang chạy, đang kéo ảnh hoặc bị lỗi
kubectl get pods -n default

# Xem trạng thái các dịch vụ (Services) và lấy IP Public để truy cập API Gateway bên ngoài
kubectl get services -n default

# Kiểm tra IP Public tĩnh được cấp phát cho API Gateway (chờ vài phút để hiện IP)
kubectl get service gateway -n default
```

### 2. Đọc nhật ký hoạt động (Logs) của các Microservices
```bash
# Đọc 100 dòng log gần nhất của một dịch vụ cụ thể
kubectl logs deployment/user-service -n default --tail=100

# Theo dõi log thời gian thực (Real-time logs) của API Gateway
kubectl logs deployment/gateway -n default -f

# Xem log kết nối của hàng đợi RabbitMQ
kubectl logs deployment/rabbitmq -n default --tail=50

# Xem log hoạt động của Redis
kubectl logs deployment/redis -n default --tail=50
```

### 3. Chẩn đoán và Debug lỗi (Khi Pod bị Crash hoặc ImagePullBackOff)
```bash
# Xem thông tin cấu hình chi tiết, sự kiện (Events) lỗi của một Pod cụ thể
kubectl describe pod <tên-pod-bị-lỗi> -n default
# (Ví dụ: kubectl describe pod gateway-7f6978784f-8ndw8 -n default)

# Xem các sự kiện lỗi tổng quát của cả cụm GKE sắp xếp theo thời gian mới nhất
kubectl get events -n default --sort-by='.metadata.creationTimestamp'
```

### 4. Cách ép cụm tải lại ảnh Docker mới ngay lập tức
Khi bạn vừa sửa lỗi phân quyền hoặc cập nhật Docker Registry và không muốn chờ Kubernetes thử lại (backoff):
```bash
# Xóa toàn bộ Pod cũ. Kubernetes sẽ lập tức tạo Pod mới và kéo ảnh mới về tức thì
kubectl delete pods --all -n default
```

### 5. Tiết kiệm chi phí: Tạm dừng và Bật lại dự án (Scale-to-Zero)
Khi kết thúc ngày làm việc hoặc khi không kiểm thử, hãy hạ số lượng bản sao (replicas) về 0 để GKE Autopilot giải phóng toàn bộ máy ảo và **không tính tiền phần cứng (0 USD)**:

*   **Tắt toàn bộ hệ thống (Hạ về 0)**:
    ```bash
    kubectl scale deployment --all --replicas=0 -n default
    ```
*   **Bật lại hệ thống khi tiếp tục code (Nâng lên 1)** - Cần nhớ hết các service và pod nhé:
    ```bash
    kubectl scale deployment frontend gateway user-service friend-service post-service media-service notification-service chat-service rabbitmq redis --replicas=1 -n default
    ```

