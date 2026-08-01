# Task 1: Thiết lập MinIO (Docker & Env)

## Mục đích
Thêm cấu hình hạ tầng MinIO vào hệ thống qua Docker Compose và khai báo biến môi trường.

## Hướng dẫn chi tiết từng bước

### 1. Cập nhật `docker-compose.yml`
Mở file `docker-compose.yml` tại thư mục gốc của dự án (`foodee-be`).
Thêm service `minio` ngang cấp với `api`, `postgres`...

```yaml
  minio:
    image: minio/minio:RELEASE.2023-09-04T19-57-37Z
    container_name: fooddie_minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-miniouser}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-miniopassword}
    ports:
      - '${MINIO_PORT:-9000}:9000'
      - '9001:9001'
    volumes:
      - minio-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Cũng trong file này, ở dưới cùng mục `volumes:`, đảm bảo đã khai báo `minio-data`:
```yaml
volumes:
  # Các volume khác...
  minio-data:
    driver: local
```

### 2. Cập nhật file `.env`
Mở file `.env` (thư mục gốc) và thêm vào cuối file:

```env
# MINIO STORAGE
MINIO_ENDPOINT=localhost
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=miniouser
MINIO_SECRET_KEY=miniopassword
MINIO_BUCKET=foodee
```
