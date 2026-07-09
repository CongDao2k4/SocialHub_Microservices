# Walkthrough — Gateway Extension & Realtime Notification Service

We have completed the Phase 2 requirements:
1. **Docker Infrastructure Restructure**: Configured a lightweight database stack in Docker (saving RAM) while running Node.js services locally on the host. Added a **RabbitMQ** service and a Postgres database initializer SQL script.
2. **Gateway Extensions**: Integrated `friend-service` and the new `notification-service` routing with `opossum` Circuit Breakers. Coded a native HTTP `upgrade` handler in the Gateway to proxy WebSocket traffic directly to the notification service.
3. **Built Notification Service**: Created `notification-service` on port `5006` that subscribes to Redis Pub/Sub events (avoiding codebase modifications to completed services) via an Event Bridge, publishes them to **RabbitMQ**, consumes them to store in MongoDB, and pushes notifications to authenticated clients in realtime via **Socket.IO**.
4. **Local Environments**: Generated `.env` configs for all services mapping to `localhost` databases and endpoints. Resolved host conflicts for MongoDB (mapped to `27018`) and MinIO (mapped to `9005` to avoid WSL relay port 9000 conflicts).

---

## Verification Results

### 1. Postgres Database Seeding Verification
PostgreSQL initialized cleanly. Running database list checks on the container confirms that `socialhub_user` and `socialhub_friend` were created automatically:
```
                                                           List of databases
       Name       |   Owner   | Encoding | Locale Provider |  Collate   |   Ctype    | ICU Locale | ICU Rules |    Access privileges    
------------------+-----------+----------+-----------------+------------+------------+------------+-----------+-------------------------
 postgres         | socialhub | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | 
 socialhub        | socialhub | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | 
 socialhub_friend | socialhub | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | 
 socialhub_user   | socialhub | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | 
(6 rows)
```

### 2. Integration Test Output
Running `node tests/test-notifications.js` inside the `gateway/` folder verifies all routing, authorization, WebSocket proxying, and queuing:
```bash
$ node tests/test-notifications.js
🏁 Starting Gateway & Notification Service Integration Tests...
✅ User A Registered. ID: 9f247bd4-896f-4306-9edf-9ee62812b78d
✅ User B Registered. ID: 992ad3f5-f1d7-481d-95a2-5a41d883c143
🔌 Connecting User B Socket.IO client to Gateway...
✅ User B Socket connected successfully to Gateway WebSocket proxy!
📡 Sending friend request from User A to User B...
✅ Friend request sent from User A. Status: ok
📥 [Socket.IO] User B received "notification:new" event: {
  id: '6a4f1b8f4512848ee2662c6b',
  type: 'friend_request',
  message: 'User A Trigger đã gửi lời mời kết bạn.',
  fromUser: {
    id: '9f247bd4-896f-4306-9edf-9ee62812b78d',
    displayName: 'User A Trigger',
    avatarUrl: null
  },
  referenceId: 'f09b9215-7d1a-4716-aab7-52dbd1d04cdd',
  referenceType: 'friend_request',
  isRead: false,
  createdAt: '2026-07-09T03:54:55.898Z'
}
✅ Notification type & sender verification PASSED!
📥 [Socket.IO] User B received "notification:count" event: { unreadCount: 1 }
✅ Notification unread count verification PASSED!
🎉 Socket.IO Realtime Push verified successfully!
📡 Fetching User B notifications list via REST API...
✅ Get notifications list success. Count: 1
✅ Notification presence in REST API verified.
✅ Get unread count success: 1
📡 Marking notification 6a4f1b8f4512848ee2662c6b as read...
📥 [Socket.IO] User B received "notification:count" event: { unreadCount: 0 }
✅ Mark read success: true
✅ Get unread count after read success: 0

🎉 ALL REALTIME NOTIFICATION & INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉
```

---

## Configuration & Local Run Guide

### Running Databases (Docker)
Ensure Docker is running and execute:
```bash
docker compose up -d
```
*Note: Databases are mapped to host ports: Postgres (`5432`), MongoDB (`27018`), Redis (`6379`), MinIO (`9005` console at `9001`), and RabbitMQ (`5672` management at `15672`).*

### Running Microservices Locally (Host)
Install dependencies and run:
```bash
# Terminal 1: User Service
cd services/user-service && npm install && npm run dev

# Terminal 2: Friend Service
cd services/friend-service && npm install && npm run dev

# Terminal 3: Post Service
cd services/post-service && npm install && npm run dev

# Terminal 4: Media Service
cd services/media-service && npm install && node src/server.js

# Terminal 5: Notification Service (RabbitMQ consumer + Socket.IO push)
cd services/notification-service && npm install && npm run dev

# Terminal 6: API Gateway
cd gateway && npm install && npm run dev
```
*(All services will watch files and hot-reload. Post-service is routed under `/api/posts` and `/api/feed` as requested).*
