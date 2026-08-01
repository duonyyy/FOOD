# Task 4: Thay thế Storage Service ở các Feature Module

## Mục đích
Thay thế `GoogleCloudStorageService` bằng `MinioService` ở 3 module: Food, Restaurant và Promotion. Lưu ý: Food và Promotion chỉ dùng hàm xóa (`deleteFile`), trong khi Restaurant dùng cả hàm upload (`uploadPublicFile`).

## Hướng dẫn chi tiết từng bước

### 1. Cập nhật `src/modules/restaurant/restaurant.service.ts`
Đây là service duy nhất có xử lý upload file trực tiếp từ Backend.
- **Bước 1.1**: Ở dòng import, đổi:
  `import { GoogleCloudStorageService } from 'src/infra/storage/gcs.service';`
  thành
  `import { MinioService } from 'src/infra/minio/minio.service';`
- **Bước 1.2**: Trong constructor, đổi `private gcsService: GoogleCloudStorageService` thành `private minioService: MinioService`.
- **Bước 1.3**: Tìm các chỗ upload file (ví dụ `this.gcsService.uploadPublicFile(avatarFile, 'restaurant-avatars')`) và sửa lại:
  ```typescript
  // CŨ
  // avatarUrl = await this.gcsService.uploadPublicFile(avatarFile, 'restaurant-avatars');

  // MỚI
  const avatarUpload = await this.minioService.upload(avatarFile, avatarFile.originalname, 'restaurant-avatars');
  avatarUrl = this.minioService.getPublicUrl(avatarUpload.fileName);
  ```
  *(Làm tương tự cho `backgroundUrl` và `certificateUrl`)*.
- **Bước 1.4**: Các chỗ xóa file (ví dụ `this.gcsService.deleteFile(oldAvatarUrl)`), sửa thành `this.minioService.deleteFile(oldAvatarUrl)`.


### 2. Cập nhật `src/modules/food/food.service.ts`
Service này **chỉ dùng hàm deleteFile**.
- **Bước 2.1**: Ở dòng import, đổi sang `import { MinioService } from 'src/infra/minio/minio.service';`
- **Bước 2.2**: Trong constructor, đổi `private readonly gcsService: GoogleCloudStorageService` thành `private readonly minioService: MinioService`.
- **Bước 2.3**: Tìm các chỗ xóa ảnh cũ (khoảng dòng 1269 và 1287):
  ```typescript
  // CŨ:
  // await this.gcsService.deleteFile(food.image).catch(...);

  // MỚI:
  await this.minioService.deleteFile(food.image).catch(...);
  ```


### 3. Cập nhật `src/modules/promotion/promotion.service.ts`
Service này cũng **chỉ dùng hàm deleteFile**.
- **Bước 3.1**: Đổi import sang `MinioService`.
- **Bước 3.2**: Trong constructor, đổi inject thành `minioService: MinioService`.
- **Bước 3.3**: Tìm 2 chỗ xóa ảnh (khoảng dòng 306 và 334):
  ```typescript
  // CŨ:
  // await this.gcsService.deleteFile(promotion.image);

  // MỚI:
  await this.minioService.deleteFile(promotion.image);
  ```


### 4. Dọn dẹp và Kiểm tra tổng thể
- Mở terminal chạy `npm run build`.
- Nếu có lỗi "gcsService does not exist", hãy dùng tính năng "Find and Replace All" (Ctrl+Shift+H / Cmd+Shift+H) trong 3 file trên để đổi từ `this.gcsService` sang `this.minioService`.
- Đảm bảo terminal không báo lỗi TypeScript nào.
