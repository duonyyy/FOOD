# Báo Cáo Hoàn Thành: Migration Google Cloud Storage → MinIO

**Ngày thực hiện:** 2026-07-31  
**Trạng thái:** ✅ Hoàn thành — Build thành công, 0 lỗi TypeScript

---

## Tổng Quan

Hệ thống lưu trữ file của dự án `foodee-be` đã được chuyển đổi hoàn toàn từ **Google Cloud Storage (GCS)** sang **MinIO** (S3-compatible, self-hosted). Toàn bộ business logic không thay đổi, chỉ swap tầng infrastructure.

---

## Các File Thay Đổi

### 🆕 File Mới Tạo

| File | Mô tả |
|------|-------|
| `src/config/minio.config.ts` | Config namespace `minio.*` dùng `registerAs`, đọc từ env |
| `src/infra/minio/infra-minio.module.ts` | Module kết nối MinIO qua `nestjs-minio` (`NestMinioModule.registerAsync`) |
| `src/infra/minio/minio.service.ts` | Service wrapper với `upload()`, `getPublicUrl()`, `deleteFile()`. Tự động tạo bucket và set public read policy lúc khởi động (`onModuleInit`) |

### ✏️ File Chỉnh Sửa

| File | Thay đổi |
|------|----------|
| `docker-compose.yml` | Thêm service `fooddie_minio` (image `minio/minio:RELEASE.2023-09-04T19-57-37Z`, port `9000` API + `9001` Console, healthcheck, volume `minio-data`) |
| `.env` | Thêm 7 biến: `MINIO_ENDPOINT`, `MINIO_PUBLIC_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` |
| `src/app.module.ts` | Import `minioConfig` và đưa vào `ConfigModule.forRoot({ load: [minioConfig] })` |
| `src/infra/storage/storage.module.ts` | Swap provider/export từ `GoogleCloudStorageService` → `MinioService` (import thêm `InfraMinioModule`) |
| `src/modules/restaurant/restaurant.service.ts` | Đổi import + inject + **thay thế toàn bộ 3 hàm upload** (`uploadPublicFile` → `upload` + `getPublicUrl`) và **6 lệnh deleteFile** ở 3 functions: `requestRestaurantWithFiles`, `updateFiles`, `updateWithAddressAndFiles` |
| `src/modules/food/food.service.ts` | Đổi import + inject + **thay thế 2 lệnh deleteFile** (dòng ~1269, ~1287 — xóa ảnh cũ khi update) |
| `src/modules/promotion/promotion.service.ts` | Đổi import + inject + **thay thế 2 lệnh deleteFile** (khi update và delete promotion) |

---

## Packages Đã Cài Đặt

```bash
npm install minio nestjs-minio --save
npm install -D @types/minio
```

---

## Kiến Trúc Mới

```
StorageModule
  └── imports: InfraMinioModule
        └── NestMinioModule.registerAsync (nestjs-minio)
              └── MinioService (onModuleInit: tạo bucket + set policy)
                    ├── upload(file, fileName, path) → IMinioUploadResult
                    ├── getPublicUrl(objectName) → string
                    └── deleteFile(fileUrl) → void

MinioService được inject vào:
  ├── RestaurantService (upload + delete)
  ├── FoodService (delete only)
  └── PromotionService (delete only)
```

---

## Cách Sử Dụng

### Upload file
```typescript
const result = await this.minioService.upload(file, file.originalname, 'foods');
const imageUrl = this.minioService.getPublicUrl(result.fileName);
// → http://localhost:9000/foodee/foods/1234567890-image.jpg
```

### Xóa file
```typescript
await this.minioService.deleteFile(imageUrl); // truyền vào full URL hoặc object name đều được
```

---

## Cấu Hình Môi Trường

| Biến | Giá trị (local) | Ghi chú |
|------|-----------------|---------|
| `MINIO_ENDPOINT` | `minio` | Tên service trong Docker network |
| `MINIO_PUBLIC_ENDPOINT` | `http://localhost:9000` | URL client dùng để truy cập ảnh |
| `MINIO_PORT` | `9000` | API port |
| `MINIO_USE_SSL` | `false` | Môi trường local |
| `MINIO_ACCESS_KEY` | `miniouser` | Root user |
| `MINIO_SECRET_KEY` | `miniopassword` | Root password |
| `MINIO_BUCKET` | `foodee` | Tên bucket chính |

> **Lưu ý production:** Khi deploy lên server, đổi `MINIO_ENDPOINT` thành hostname/IP thực của MinIO server, đổi `MINIO_PUBLIC_ENDPOINT` thành domain public, và cập nhật credentials mạnh hơn.

---

## Kết Quả Kiểm Tra

```
> be@0.0.1 build
> nest build

✅ Build thành công — 0 lỗi TypeScript
✅ Không còn reference nào tới GoogleCloudStorageService
✅ Không còn reference nào tới gcsService
```

---

## Việc Cần Làm Tiếp Theo (Tùy Chọn)

- [x] Đã gỡ dependency trực tiếp `@google-cloud/storage` khỏi `package.json`
- [x] Đã xóa `src/infra/storage/gcs.service.ts` và artifact GCS trong `dist`
- [x] Đã xóa script legacy `src/config/scripts/configure-gcs-cors.js`
- [i] `@google-cloud/storage` vẫn xuất hiện dạng dependency chuyển tiếp của `firebase-admin`; không xóa riêng khỏi lockfile để tránh làm hỏng dependency graph
- [ ] Đổi credentials `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` thành giá trị mạnh hơn trước khi deploy production
- [ ] Mở MinIO Console tại `http://localhost:9001` để kiểm tra bucket và upload thử
