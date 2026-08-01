# Task DB-03: Khởi tạo database hiện tại bằng migration

## Mục tiêu

Áp dụng migration vào database `fooddie_db` hiện đang được PostgreSQL container phục vụ, để các API restaurants, foods và promotions không còn lỗi thiếu relation.

## Trạng thái hiện tại

- PostgreSQL container đang healthy.
- Database ứng dụng hiện không có các bảng nghiệp vụ.
- Bảng lịch sử `migrations` chưa tồn tại.
- TypeORM nhận diện 23 migration pending.
- Không có bằng chứng lỗi này xuất phát từ MinIO.

## Điều kiện trước khi chạy

1. Hoàn tất `task-db-01-compiled-migration-runner.md`.
2. Hoàn tất `task-db-02-docker-migration-service.md` hoặc có runner tương đương đã được kiểm chứng.
3. Xác nhận `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` và `DB_PORT` trỏ đúng database cần khởi tạo.
4. Nếu database có dữ liệu cần giữ, tạo backup trước khi chạy migration.

## Quy trình đề xuất

```powershell
docker compose up -d postgres redis ai-server minio
docker compose run --rm migrate
docker compose up -d api
docker compose ps
```

Không chạy `docker compose down -v` trên môi trường hiện tại, vì thao tác đó có thể xóa volume PostgreSQL và làm mất dữ liệu.

## Kiểm tra sau migration

Kiểm tra lịch sử migration:

```powershell
docker exec fooddie_postgres psql -U postgres -d fooddie_db -c "SELECT COUNT(*) FROM migrations;"
```

Kiểm tra các bảng chính:

```powershell
docker exec fooddie_postgres psql -U postgres -d fooddie_db -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```

Tối thiểu phải kiểm tra sự tồn tại của các bảng phục vụ API:

- `restaurants`
- `foods`
- `promotions`
- các bảng category, user/role/permission, order và review liên quan

## Tiêu chí nghiệm thu

- Migration process exit code 0.
- Bảng `migrations` được tạo.
- Toàn bộ migration pending được ghi nhận đúng thứ tự.
- Các relation `restaurants`, `foods`, `promotions` tồn tại.
- Không có lỗi duplicate table, duplicate enum, foreign key hoặc extension trong log.
- API có thể đọc dữ liệu sau khi migration hoàn tất.

## Rủi ro cần kiểm tra

- Một số migration có seed/sample data; cần phân biệt dữ liệu seed có chủ ý với dữ liệu bị insert trùng do chạy lại.
- Database hiện tại có thể khác với database mà container API đang dùng nếu `.env` và Compose override không đồng nhất.
- Không được xóa volume để “sửa nhanh” khi chưa xác nhận dữ liệu không cần giữ.
