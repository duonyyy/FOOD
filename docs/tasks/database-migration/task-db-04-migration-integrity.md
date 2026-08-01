# Task DB-04: Kiểm tra tính toàn vẹn và idempotency của migration

## Mục tiêu

Chứng minh toàn bộ migration chạy đúng thứ tự trên database rỗng, có thể chạy lại an toàn và không tạo dữ liệu/schema trùng.

## Phạm vi kiểm tra

Các nhóm migration cần đặc biệt kiểm tra:

- Base schema: `1700000000000`
- Admin, roles và permissions: `1748968581909`
- Promotion: `1750000000000` đến `1750000000002`
- Sample data: `1750000000003` và `1750000000024`
- Restaurant, food, review, order, messenger và shipper: các migration `1750000000004` đến `1750000000023`

## Công việc chi tiết

1. Dùng một PostgreSQL database/volume disposable, không dùng volume hiện tại để test phá hủy.
2. Build production image có compiled DataSource và migration.
3. Chạy `migration:show:compiled` trước khi apply và lưu số lượng pending.
4. Chạy `migration:run:compiled` một lần.
5. Chạy lại `migration:show:compiled`; kết quả không còn migration pending.
6. Chạy lại `migration:run:compiled` lần thứ hai.
7. Kiểm tra migration history không có bản ghi trùng và seed không bị nhân đôi.
8. Kiểm tra schema, index, foreign key, enum và extension sau khi chạy.

## Kiểm thử đề xuất

```powershell
docker compose run --rm migrate npm run migration:show:compiled
docker compose run --rm migrate npm run migration:run:compiled
docker compose run --rm migrate npm run migration:show:compiled
docker compose run --rm migrate npm run migration:run:compiled
```

## Tiêu chí nghiệm thu

- Lần chạy đầu áp dụng đủ migration theo thứ tự timestamp.
- Lần chạy thứ hai không thực hiện lại migration đã thành công.
- Không có lỗi duplicate table, column, enum, index hoặc constraint.
- Không có lỗi foreign key do thứ tự migration sai.
- Dữ liệu seed/sample chỉ xuất hiện theo thiết kế của migration.
- Kết quả trên database disposable không ảnh hưởng database hiện tại.

## Rủi ro cần kiểm tra

- Migration có seed dữ liệu nhưng không có unique guard có thể tạo bản ghi trùng nếu logic bị gọi ngoài TypeORM history.
- Extension `unaccent` cần quyền phù hợp trên PostgreSQL image.
- Nếu test trên database đã có schema một phần, kết quả không phản ánh chính xác hành vi trên database rỗng.
