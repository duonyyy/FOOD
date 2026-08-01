# Báo Cáo Hoàn Thành: Khắc Phục Lỗi Database Migration & Docker Service Runner

**Ngày thực hiện:** 2026-08-01  
**Trạng thái:** ✅ Hoàn thành — 23/23 Migrations executed, 3/3 API endpoints HTTP 200 OK

---

## 1. Tổng Quan

Lỗi HTTP 500 (`relation "restaurants" does not exist`, `relation "foods" does not exist`, `relation "promotions" does not exist`) xảy ra do container PostgreSQL (`fooddie_db`) chưa được khởi tạo schema và các bảng dữ liệu.

Chúng tôi đã thiết lập giải pháp chạy migration sản xuất an toàn (compiled runner) thông qua service container `migrate` chạy một lần trước khi API khởi động trong Docker Compose, giữ nguyên `synchronize: false` và `migrationsRun: false`.

---

## 2. Nguyên Nhân Gốc & Giải Pháp

1. **Runtime Database Module:**
   - File `src/infra/database/database.module.ts` giữ `synchronize: false` và `migrationsRun: false`. Đây là thiết lập chuẩn production, nhưng đòi hỏi phải có bước chạy migration độc lập trước khi API phục vụ request.
2. **Thiếu Production Migration Runner:**
   - Các script migration cũ dựa vào `ts-node` và source TypeScript. Production image build bằng `npm ci --omit=dev` nên không có `ts-node`.
   - **Giải pháp:** Bổ sung script chạy trực tiếp trên compiled JavaScript artifacts (`dist/config/typeorm.data-source.js` và `dist/migrations/*.js`) bằng Node.js CLI của TypeORM.
3. **Docker Compose Startup Dependency:**
   - Trước đây `api` chỉ chờ `postgres` healthy (PostgreSQL mở port, nhưng database rỗng).
   - **Giải pháp:** Thêm service `migrate` và cấu hình `api` phụ thuộc vào `migrate` với điều kiện `service_completed_successfully`.

---

## 3. Các File Đã Thay Đổi

| File | Thay đổi |
|---|---|
| [`package.json`](file:///C:/Users/Admin/Desktop/UIT-2025/DuAn/LapTrinh/foodee/foodee-be/package.json) | Bổ sung 2 script: `"migration:show:compiled"` và `"migration:run:compiled"` chạy không dùng `ts-node`. |
| [`docker-compose.yml`](file:///C:/Users/Admin/Desktop/UIT-2025/DuAn/LapTrinh/foodee/foodee-be/docker-compose.yml) | Bổ sung service `migrate` (one-shot container) và thêm dependency `migrate: condition: service_completed_successfully` cho `api`. |
| `src/infra/minio/minio.service.ts` | Bổ sung `healthCheck()` kiểm tra bucket MinIO thực tế qua `bucketExists`. |
| `src/infra/storage/minio-health.controller.ts` | Bổ sung `GET /minio/health/live` trên API port `3000`; trả `503` nếu MinIO hoặc bucket không sẵn sàng. |
| `src/infra/storage/storage.module.ts` | Đăng ký `MinioHealthController` vào backend runtime. |

---

## 4. Kiến Trúc Luồng Khởi Động (Docker Compose)

```
PostgreSQL Container (fooddie_db)
       ↓ (service_healthy)
Migrate Container (fooddie_migrate)
   └── Executes: npm run migration:run:compiled
   └── Exit Code: 0
       ↓ (service_completed_successfully)
API Container (fooddie_api)
   └── Application Starts Successfully
```

---

## 5. Kết Quả Kiểm Thử & Nghiệm Thu Chi Tiết

### A. Kiểm thử Build & Schema Integrity
- **Build TypeScript (`npm run build`):** ✅ Thành công.
- **Validate Compose (`docker compose config --quiet`):** ✅ Thành công.
- **Migration Show (`migration:show:compiled`):** ✅ Nhận diện đủ 23 migration pending.
- **Migration Run Lần 1 (`migration:run:compiled`):** ✅ Thực thi thành công toàn bộ 23 migrations.
- **Migration Run Lần 2 (Idempotency Check):** ✅ Trả về `No migrations are pending` (xác nhận không trùng lặp hay tạo lỗi schema).

### B. Kiểm thử Trực Tiếp Database (`fooddie_db`)
- Bảng `migrations`: 23 bản ghi migration đã ghi nhận.
- Bảng `restaurants`: **14 bản ghi**
- Bảng `foods`: **85 bản ghi**
- Bảng `promotions`: **3 bản ghi**

### C. Nghiệm Thu API Endpoints
| API Endpoint | Expected | HTTP Status | Response Metadata |
|---|:---:|:---:|---|
| `GET /restaurants/all?page=1&pageSize=1` | `200 OK` | **200 OK** | `totalItems: 14`, `totalPages: 14`, items chứa relation owner & address |
| `GET /foods?page=1&pageSize=1` | `200 OK` | **200 OK** | `totalItems: 85`, `totalPages: 85`, items chứa relation restaurant & category |
| `GET /promotions/all?page=1&pageSize=1` | `200 OK` | **200 OK** | Trả về cấu trúc phân trang hợp lệ |

### D. Kiểm tra Logs API & MinIO Regression
- **Logs `fooddie_api`:** Không còn bất kỳ log `QueryFailedError` hay `relation "..." does not exist`.
- **MinIO Connection:** Log NestJS xác nhận `[NestMinioService] Successfully connected to minio`, bucket `foodee` sẵn sàng.
- **Backend MinIO Health Check:** `GET http://localhost:3000/minio/health/live` trả **HTTP 200 OK** và xác nhận bucket `foodee` tồn tại qua MinIO SDK.
- **MinIO Native Health Check:** `GET http://localhost:9000/minio/health/live` trả **HTTP 200 OK**.

---

## 6. Hướng Dẫn Git Stage & Commit

Chỉ stage các file thuộc phạm vi công việc:

```bash
git add package.json docker-compose.yml src/infra/minio/minio.service.ts src/infra/storage/storage.module.ts src/infra/storage/minio-health.controller.ts docs/tasks/database-migration/
git commit -m "fix(db): add compiled migration runner and docker migration service"
```
