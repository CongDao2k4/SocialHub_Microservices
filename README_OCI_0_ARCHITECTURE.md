# Giai Đoạn 0: Kiến Trúc Triển Khai OCI & MongoDB Atlas

Tài liệu này mô tả chi tiết sơ đồ kiến trúc và luồng kết nối của dự án **SocialHub Microservices** trên nền tảng **Oracle Cloud Infrastructure (OCI)** và **MongoDB Atlas**.

---

## 📐 1. Sơ Đồ Kiến Trúc Hệ Thống (Single-VM Deployment)

Để tối ưu chi phí vận hành (0 USD nhờ gói Always Free của Oracle Cloud) và đảm bảo tính bảo mật tối đa, hệ thống được thiết kế chạy trên một máy ảo VM duy nhất bằng **Docker Compose**, kết hợp với cơ sở dữ liệu MongoDB được quản lý ngoài đám mây (**MongoDB Atlas**) để giải phóng RAM cho VM.

```mermaid
flowchart TD
    subgraph Client ["Client Browser (WebRTC)"]
        A[Frontend Web App - Vercel]
    end

    subgraph External_Cloud ["External Cloud Services"]
        Atlas["MongoDB Atlas (Cloud Managed)"]
    end

    subgraph CF_Network ["Cloudflare Network"]
        Tunnel["Cloudflare Tunnel (Zero Trust)"]
        CF_DNS["turn.yourdomain.com (DNS Only)"]
    end

    subgraph OCI_VM ["Oracle Cloud VM (ARM 6GB RAM)"]
        subgraph Docker_Network ["Docker app-network"]
            C_Tunnel["Docker: cloudflared"]
            Gateway["gateway (8000)"]
            UserService["user-service (5000)"]
            FriendService["friend-service (5000)"]
            PostService["post-service (5000)"]
            ChatService["chat-service (5000)"]
            MediaService["media-service (5000)"]
            NotificationService["notification-service (5000)"]
            
            PG["pg (PostgreSQL 16)"]
            Redis["redis (Redis 7)"]
            MinIO["minio (9000/9001)"]
            RabbitMQ["rabbitmq (5672)"]
        end

        subgraph Host_Storage ["Storage (OCI Block Volume - XFS)"]
            Data["/mnt/socialhub-storage/docker-data/"]
        end
        
        Coturn["Docker: coturn (host port 3478)"]
    end

    %% Client connection
    A -->|1. Gọi API / Stream Media| Tunnel
    Tunnel -->|Chuyển tiếp mã hóa| C_Tunnel
    C_Tunnel -->|Forward nội bộ| Gateway
    C_Tunnel -->|Direct Bypass Reels| MediaService

    A -.->|2. Hỏi DNS TURN| CF_DNS
    CF_DNS -.->|Trỏ trực tiếp về IP tĩnh VM| A
    A -->|3. Kết nối STUN/TURN (UDP 3478)| Coturn
    A -->|4. Truyền tải Media (UDP 49152-49200)| Coturn

    %% Internal Connections
    UserService & FriendService & PostService -->|Truy cập SQL| PG
    ChatService & MediaService & NotificationService -->|Truy cập Atlas| Atlas
    UserService & FriendService & PostService & ChatService & NotificationService -->|Đệm RAM cache| Redis
    MediaService -->|Lưu trữ tệp gốc & HLS chunks| MinIO
    NotificationService -->|Lắng nghe sự kiện truyền tin| RabbitMQ

    %% Mount Storage
    PG & Redis & MinIO & RabbitMQ -->|Ghi dữ liệu liên tục| Data
```

---

## 🔗 2. Phân Tích Luồng Kết Nối Chính

1.  **Frontend trên Vercel**: 
    - Ứng dụng web chạy độc lập trên Vercel. Khi gọi API, client sẽ kết nối thông qua tên miền trỏ về **Cloudflare Tunnel**.
    - Việc này giúp bạn không cần mở các cổng nhạy cảm (như cổng API Gateway 8080) ra Internet. Chỉ những gói tin đi qua Cloudflare Tunnel mới được chuyển tiếp vào VM.
2.  **Bypass qua Media Service (Direct Route)**:
    - Khi xem Reels hoặc đăng video, dữ liệu luồng media nặng sẽ đi qua subdomain phụ (`media.yourdomain.com`) được Tunnel định tuyến thẳng tới `media-service:5000` thay vì đi qua API Gateway. Việc này tránh hiện tượng thắt nút cổ chai (bottleneck) ở Gateway.
3.  **MongoDB Atlas (External)**:
    - `chat-service`, `media-service`, và `notification-service` kết nối thẳng đến MongoDB Atlas bằng giao thức `mongodb+srv`. Việc này giúp loại bỏ container MongoDB nội bộ, tiết kiệm được khoảng 384MB - 512MB RAM thực tế trên máy ảo OCI.
4.  **OCI Block Volume (XFS)**:
    - Toàn bộ dữ liệu của PostgreSQL, Redis, RabbitMQ và MinIO được lưu trữ trên một Block Volume gắn ngoài 100GB. Chúng ta định dạng volume này với định dạng **XFS** để chịu tải đọc/ghi hàng ngàn tệp tin media nhỏ (HLS segment `.ts`) tốt hơn.
