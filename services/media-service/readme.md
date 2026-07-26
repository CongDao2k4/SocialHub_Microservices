# media-service

`media-service` quan ly upload, luu tru, stream va HLS cho media trong SocialHub.

## Chuc nang chinh

- upload anh va video len MinIO
- nen anh thanh 3 bien the WebP:
  - `original`
  - `medium`
  - `thumbnail`
- luu metadata vao MongoDB
- stream file goc / bien the anh
- cung cap HLS playlist va HLS segments cho video
- xoa media theo chu so huu

## Runtime

- Internal port: `5000`
- Host port trong `docker-compose.yml`: `5005`
- Health check: `GET /health`

## Diem can nho ve HLS

Trang thai code hien tai:

- khi upload video qua `POST /media/upload`, service se:
  1. upload file video goc len MinIO
  2. tao record MongoDB
  3. `await` FFmpeg transcode sang HLS
  4. upload `index.m3u8` va cac file `.ts` len MinIO
  5. cap nhat `hlsReady=true`
  6. chi sau do moi tra `201`

Dieu nay co nghia la luong reel moi upload xong se khong con gap `index.m3u8 404` do playlist chua san sang.

Neu HLS fail:

- request upload se fail
- file goc trong MinIO se duoc xoa thu hoi
- record MongoDB se bi xoa de tranh media "nua song nua chet"

## API endpoints

| Method | Endpoint | Auth | Mo ta |
| --- | --- | --- | --- |
| `GET` | `/health` | no | health check service + MinIO |
| `POST` | `/media/upload` | yes (`x-user-id`) | upload anh / video |
| `POST` | `/media/batch-urls` | yes | lay URL proxy cho nhieu media |
| `GET` | `/media/file/:id` | no | stream file media, anh ho tro `variant` |
| `GET` | `/media/hls/:id/index.m3u8` | no | stream HLS playlist |
| `GET` | `/media/hls/:id/:segment` | no | stream HLS segment `.ts` |
| `GET` | `/media/:id` | yes | lay metadata |
| `GET` | `/media/:id/url` | yes | lay URL proxy dang relative |
| `DELETE` | `/media/:id` | yes | xoa media |

## Hanh vi endpoint quan trong

### `POST /media/upload`

- auth bang `x-user-id`
- nhan `multipart/form-data`, field ten `file`
- anh:
  - GIF giu nguyen
  - JPG / PNG / WEBP duoc nen thanh 3 bien the
- video:
  - upload file goc
  - transcode HLS dong bo
  - response chi tra ve sau khi `hlsReady=true`

### `GET /media/file/:id`

- public
- voi anh, ho tro:
  - `?variant=thumbnail`
  - `?variant=medium`
  - `?variant=original`
- voi video, route nay la fallback MP4 / file goc
- response co cache dai han:
  - `Cache-Control: public, max-age=31536000, immutable`

### `GET /media/hls/:id/index.m3u8`

- public
- stream playlist tu MinIO neu `hlsReady=true`
- voi video cu chua co HLS, service van thu kick off transcode lai neu can

### `GET /media/hls/:id/:segment`

- public
- stream tung HLS segment `.ts`

## Luu tru

### MongoDB

Model `Media` luu:

- `originalName`
- `mimeType`
- `size`
- `objectKey`
- `uploadedBy`
- `compressedSize`
- `compressionRatio`
- `format`
- `variants`
- `hlsReady`
- `hlsMasterKey`

### MinIO

Key pattern:

- file goc: `{userId}/{uuid}.{ext}`
- anh webp:
  - `{userId}/{uuid}_original.webp`
  - `{userId}/{uuid}_medium.webp`
  - `{userId}/{uuid}_thumbnail.webp`
- HLS:
  - `{userId}/hls/{mediaId}/index.m3u8`
  - `{userId}/hls/{mediaId}/segment_000.ts`

## Stream va do ben

Controller stream dung `pipeline(...)` thay vi `pipe(...)` de xu ly tot hon khi:

- client dong tab
- gateway huy request
- MinIO stream bi dong som

Cac loi `ECONNRESET` va `ERR_STREAM_PREMATURE_CLOSE` duoc xu ly theo huong an toan hon cho luong proxy.

## Bien moi truong

| Variable | Default |
| --- | --- |
| `PORT` | `5000` |
| `JWT_SECRET` | app secret dung chung |
| `MONGO_URI` | `mongodb://localhost:27017/socialhub-media` |
| `MINIO_ENDPOINT` | `localhost` |
| `MINIO_PORT` | `9000` |
| `MINIO_USE_SSL` | `false` |
| `MINIO_ACCESS_KEY` | `minioadmin` |
| `MINIO_SECRET_KEY` | `minioadmin` |
| `MINIO_BUCKET_NAME` | `socialhub-media` |
| `PRESIGNED_URL_TTL` | `900` |
| `MAX_FILE_SIZE` | `10485760` |
| `MAX_VIDEO_SIZE` | `104857600` |
| `IMAGE_QUALITY_ORIGINAL` | `92` |
| `IMAGE_QUALITY_MEDIUM` | `88` |
| `IMAGE_QUALITY_THUMBNAIL` | `75` |
| `IMAGE_MAX_WIDTH_ORIGINAL` | `2048` |
| `IMAGE_MAX_WIDTH_MEDIUM` | `1080` |
| `IMAGE_MAX_WIDTH_THUMBNAIL` | `200` |

## Chay local

```bash
cd services/media-service
npm install
npm run dev
```

Kiem tra nhanh:

```bash
curl http://localhost:5005/health
```

Upload anh:

```bash
curl -X POST http://localhost:5005/media/upload \
  -H "x-user-id: user-123" \
  -F "file=@./test.jpg"
```

Upload video:

```bash
curl -X POST http://localhost:5005/media/upload \
  -H "x-user-id: user-123" \
  -F "file=@./test.mp4"
```

Khi lenh upload video tra `201`, HLS da san sang de phat qua:

```bash
curl http://localhost:5005/media/hls/<mediaId>/index.m3u8
```

## File lien quan

- route: [src/routes/media.routes.js](./src/routes/media.routes.js)
- service: [src/services/media.service.js](./src/services/media.service.js)
- HLS: [src/services/hls.service.js](./src/services/hls.service.js)
- controller stream: [src/controllers/media.controller.js](./src/controllers/media.controller.js)
- OpenAPI: [../../docs/api-specs/media-service.yaml](../../docs/api-specs/media-service.yaml)
