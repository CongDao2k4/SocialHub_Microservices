# user-service

> Identity & Access Management Service for SocialHub.

## Overview

- **Business Domain**: Identity, authentication, and user profiles.
- **Data Owned**: User credentials, profile details (displayName, bio, avatarUrl), and active refresh tokens.
- **Operations Exposed**: User registration, login, logout, refresh token rotation, profile lookup/update, user search, and batch internal user profile lookup.

## Tech Stack

| Component  | Choice             |
|------------|--------------------|
| Language   | Node.js (ESM)      |
| Framework  | Express.js         |
| Database   | PostgreSQL         |
| Cache      | Redis              |

## API Endpoints

| Method | Endpoint              | Description                                          |
|--------|-----------------------|------------------------------------------------------|
| GET    | `/health`             | Health check                                         |
| POST   | `/api/auth/register`  | Register a new user                                  |
| POST   | `/api/auth/login`     | Login and receive JWT access & refresh tokens        |
| POST   | `/api/auth/refresh`   | Refresh expired access token (with rotation)        |
| POST   | `/api/auth/logout`    | Logout and blacklist active access token             |
| GET    | `/api/users/:id`      | Get user profile (caches to Redis)                   |
| PUT    | `/api/users/:id`      | Update user profile (invalidates cache)             |
| GET    | `/api/users/search`   | Search users by name/email (paginated)               |
| POST   | `/api/users/batch`    | Internal endpoint to lookup multiple users by IDs    |

> Full API specification: [`docs/api-specs/user-service.yaml`](../../docs/api-specs/user-service.yaml)

## Running Locally

```bash
# From project root
docker compose up user-service --build
```

## Project Structure

```
user-service/
├── Dockerfile
├── readme.md
└── src/
    ├── config/       # Connection configurations (db, redis)
    ├── controllers/  # API business logic handlers
    ├── middleware/   # Request interception (auth verify)
    ├── routes/       # Endpoint routing definitions
    └── utils/        # Utilities (token generation)
```

## Environment Variables

| Variable             | Description                          | Default                               |
|----------------------|--------------------------------------|---------------------------------------|
| `PORT`               | Port of the service                  | 5001                                  |
| `PG_HOST`            | PostgreSQL database host             | localhost                             |
| `PG_PORT`            | PostgreSQL database port             | 5433                                  |
| `PG_DATABASE`        | PostgreSQL database name             | socialhub_user                        |
| `PG_USER`            | PostgreSQL username                  | postgres                              |
| `PG_PASSWORD`        | PostgreSQL password                  | 123456                                |
| `REDIS_HOST`         | Redis cache host                     | localhost                             |
| `REDIS_PORT`         | Redis cache port                     | 6379                                  |
| `JWT_SECRET`         | Access token signature secret        | your-jwt-secret-change-in-production  |
| `JWT_REFRESH_SECRET` | Refresh token signature secret       | your-refresh-secret-change-in-prod    |

## Logging & Caching Behavior
- **HTTP Request Logger**: All incoming API requests are logged to the console using a lightweight middleware printing the format `[HTTP] METHOD PATH STATUS - TIMEms`.
- **Cache-Control & ETags**: ETags are disabled (`app.set('etag', false)`) and response headers are set to `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` to prevent caching of dynamic profile/search endpoints on client browsers, forcing fresh loads on every call.
