# Task DB-06: Đồng bộ cấu hình và readiness của runtime

## Mục tiêu

Đảm bảo API và migration CLI dùng cùng một cấu hình database, đồng thời deployment không quảng bá API là ready khi schema chưa sẵn sàng.

## File liên quan

- `src/infra/database/database.module.ts`
- `src/config/typeorm.data-source.ts`
- `package.json`
- `Dockerfile`
- `docker-compose.yml`

## Hiện trạng cần giữ rõ

`database.module.ts` hiện có:

- `synchronize: false`
- `migrationsRun: false`
- glob migration cho cả `.ts` và `.js`

Đây là cấu hình an toàn nếu migration được điều khiển bởi release step. Không nên bật `synchronize` để chữa lỗi thiếu bảng, vì nó bỏ qua quy trình migration có version và có thể gây thay đổi schema ngoài kiểm soát.

## Công việc chi tiết

1. So sánh options của `database.module.ts` và `typeorm.data-source.ts`.
2. Đảm bảo hai nơi dùng cùng host, port, database, username, password, entities, migrations và migration table name.
3. Nếu có khác biệt, trích xuất phần cấu hình dùng chung hoặc chuẩn hóa biến môi trường.
4. Giữ `synchronize: false`.
5. Chọn một cơ chế migration duy nhất: migration service/release step.
6. Bổ sung readiness check có thể xác nhận:
   - PostgreSQL reachable.
   - Migration table tồn tại.
   - Không còn migration pending trước khi API nhận traffic.
7. Đảm bảo API không start thành công nếu migration service fail.

## Tiêu chí nghiệm thu

- Runtime API và compiled CLI trỏ cùng database.
- Restart API không tự phá schema và không chạy seed ngoài ý muốn.
- Migration service chạy idempotent.
- Deployment fail rõ ràng khi migration fail.
- Không dùng `synchronize: true` như workaround.
- Có tài liệu vận hành cho thứ tự `postgres → migrate → api`.

## Rủi ro cần kiểm tra

- Nếu có nhiều API replica, để từng replica tự chạy migration có thể tạo race condition.
- `depends_on` không kiểm tra được business readiness của schema nếu migration service không được khai báo đúng.
- Hai DataSource config khác nhau là nguồn rủi ro lớn hơn bản thân lỗi thiếu bảng; cần kiểm tra bằng log/database name thực tế.
