# Task DB-02: Thêm migration service vào Docker Compose

## Mục tiêu

Đảm bảo migration hoàn tất trước khi API khởi động, nhưng chỉ chạy migration một lần cho mỗi lần triển khai.

## Phạm vi file

- `docker-compose.yml`
- `package.json`
- Có thể bổ sung health/readiness logic nếu cấu trúc Compose hiện tại yêu cầu.

## Thiết kế đề xuất

Tạo service one-shot `migrate` dùng cùng production image với API:

```yaml
migrate:
  build:
    context: .
    dockerfile: Dockerfile
  command: npm run migration:run:compiled
  env_file:
    - .env
  environment:
    - DB_HOST=postgres
  depends_on:
    postgres:
      condition: service_healthy
  restart: "no"
```

API phải phụ thuộc vào việc service `migrate` kết thúc thành công:

```yaml
api:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    ai-server:
      condition: service_healthy
    minio:
      condition: service_healthy
    migrate:
      condition: service_completed_successfully
```

## Công việc chi tiết

1. Thêm `migrate` với cùng build context, Dockerfile và runtime environment như API.
2. Chỉ override `DB_HOST=postgres` trong Compose network; không hard-code credentials trong file compose.
3. Đảm bảo `migrate` không chạy vô hạn và không tự restart khi migration fail.
4. Thêm dependency `service_completed_successfully` cho API.
5. Giữ các dependency hiện tại của API: PostgreSQL, Redis, AI server và MinIO.
6. Kiểm tra cấu hình không tạo vòng phụ thuộc giữa `api` và `migrate`.

## Kiểm thử

```powershell
docker compose config --quiet
docker compose build migrate api
docker compose up -d postgres redis ai-server minio
docker compose run --rm migrate
docker compose up -d api
docker compose ps
```

## Tiêu chí nghiệm thu

- `docker compose config --quiet` thành công.
- `migrate` chờ PostgreSQL healthy trước khi chạy.
- `migrate` exit code 0 khi database hợp lệ.
- API chỉ start sau khi `migrate` exit code 0.
- Nếu migration fail, API không được coi là đã sẵn sàng.
- Re-run Compose không làm chạy lại các migration đã ghi nhận.
- MinIO và các dependency hiện tại không bị thay đổi hành vi.

## Rủi ro cần kiểm tra

- `depends_on` chỉ kiểm soát thứ tự/điều kiện container; không thay thế việc kiểm tra migration history.
- Nếu dùng `docker compose run --rm migrate`, service dependency của API không tự tạo một release workflow hoàn chỉnh; cần thống nhất lệnh triển khai chuẩn.
- Không nên bật `migrationsRun: true` đồng thời trên mọi API replica nếu deployment có nhiều replica.
