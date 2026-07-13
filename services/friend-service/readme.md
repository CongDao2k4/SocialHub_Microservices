# friend-service

> Social Graph Management Service (Friendships & Requests) for SocialHub.

## Overview

- **Business Domain**: Social network connections and relationship status.
- **Data Owned**: Friend requests, bilateral friendships.
- **Operations Exposed**: Sending/receiving friend requests, accepting/rejecting requests, mutual friends count, friend suggestions, and checking friendship status.

## Tech Stack

| Component  | Choice             |
|------------|--------------------|
| Language   | Node.js (ESM)      |
| Framework  | Express.js         |
| Database   | PostgreSQL         |
| Cache      | Redis              |

## API Endpoints

| Method | Endpoint                          | Description                                          |
|--------|-----------------------------------|------------------------------------------------------|
| GET    | `/health`                         | Health check                                         |
| POST   | `/api/friends/request`            | Send a friend request                                |
| GET    | `/api/friends/requests`           | List pending friend requests (received/sent)         |
| PUT    | `/api/friends/requests/:id/accept`| Accept a pending friend request                      |
| PUT    | `/api/friends/requests/:id/reject`| Reject a pending friend request                      |
| GET    | `/api/friends`                    | List friends of authenticated user                   |
| GET    | `/api/friends/suggestions`        | Get friend suggestions based on mutual friends       |
| GET    | `/api/friends/check/:userId`      | Check friendship status with a user                  |
| GET    | `/api/friends/mutual/:userId`     | Get mutual friends with a user                       |
| DELETE | `/api/friends/:friendId`          | Remove a friendship                                  |
| GET    | `/internal/friends/:userId`       | Get raw list of friend IDs (internal service only)   |

> Full API specification: [`docs/api-specs/friend-service.yaml`](../../docs/api-specs/friend-service.yaml)

## Running Locally

```bash
# From project root
docker compose up friend-service --build
```

## Project Structure

```
friend-service/
├── Dockerfile
├── readme.md
└── src/
    ├── config/       # Connection configurations (db, redis)
    ├── controllers/  # API business logic handlers
    ├── middleware/   # Request authorization verification (protectRoute)
    ├── routes/       # Endpoint routing definitions
    └── utils/        # Internal HTTP client for user-service batch query
```

## Environment Variables

| Variable           | Description                         | Default                              |
|--------------------|-------------------------------------|--------------------------------------|
| `PORT`             | Port of the service                 | 5002                                 |
| `PG_HOST`          | PostgreSQL database host            | localhost                            |
| `PG_PORT`          | PostgreSQL database port            | 5434                                 |
| `PG_DATABASE`      | PostgreSQL database name            | socialhub_friend                     |
| `PG_USER`          | PostgreSQL username                 | postgres                             |
| `PG_PASSWORD`      | PostgreSQL password                 | 123456                               |
| `REDIS_HOST`       | Redis server host                   | localhost                            |
| `REDIS_PORT`       | Redis server port                   | 6379                                 |
| `JWT_SECRET`       | Secret key to verify JWT            | your-jwt-secret-change-in-production |
| `USER_SERVICE_URL` | Internal URL of user service        | http://localhost:5001                |

## Logging & Caching Behavior
- **HTTP Request Logger**: All incoming API requests are logged to the console using a lightweight middleware printing the format `[HTTP] METHOD PATH STATUS - TIMEms`.
- **Cache-Control & ETags**: ETags are disabled (`app.set('etag', false)`) and response headers are set to `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` to prevent caching of friendship and request lists on client browsers, forcing fresh loads on every call.
