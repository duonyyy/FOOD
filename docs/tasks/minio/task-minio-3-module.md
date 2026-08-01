# Task 3: Tích hợp MinioService vào StorageModule

## Mục đích
Sửa lại file cấu hình module của chức năng lưu trữ để chia sẻ `MinioService` ra toàn hệ thống (cấp phát qua Dependency Injection), đồng thời loại bỏ `GoogleCloudStorageService`.

## Hướng dẫn chi tiết từng bước

### 1. Cập nhật `src/infra/storage/storage.module.ts`
Mở file `storage.module.ts` và thay thế TOÀN BỘ nội dung bằng đoạn code sau:

```typescript
import { Module } from '@nestjs/common';
import { InfraMinioModule } from '../minio/infra-minio.module';
import { MinioService } from '../minio/minio.service';

@Module({
  imports: [InfraMinioModule],
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
```

### 2. Dọn dẹp Code cũ
- Xóa hẳn file `src/infra/storage/gcs.service.ts` khỏi source code.
- Chạy lệnh sau ở terminal để gỡ thư viện của Google (nếu dự án không còn dùng Google Cloud Storage cho việc khác):
```bash
npm uninstall @google-cloud/storage
```
