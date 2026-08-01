# Task DB-01: Tạo compiled migration runner cho production

## Mục tiêu

Cho phép chạy TypeORM migration trong production image mà không phụ thuộc vào `ts-node` hoặc devDependencies.

## Phạm vi file

- `package.json`
- `Dockerfile`
- `dist/config/typeorm.data-source.js` sau build
- `dist/migrations/*.js` sau build

## Bối cảnh kỹ thuật

Các script migration hiện tại dùng file TypeScript trong `src/config/typeorm.data-source.ts` và chạy qua `ts-node`. Trong khi đó `Dockerfile` cài production dependencies bằng `npm ci --omit=dev`, nên container production không nên dựa vào `ts-node`.

Image hiện tại đã compile được DataSource và toàn bộ migration vào `dist`, vì vậy runner production nên gọi trực tiếp TypeORM CLI bằng Node.js.

## Công việc chi tiết

1. Bổ sung script chỉ dùng compiled artifacts:

   ```json
   "migration:show:compiled": "node ./node_modules/typeorm/cli.js migration:show -d dist/config/typeorm.data-source.js",
   "migration:run:compiled": "node ./node_modules/typeorm/cli.js migration:run -d dist/config/typeorm.data-source.js"
   ```

2. Giữ lại các script TypeScript hiện tại để phục vụ local development nếu chúng vẫn cần thiết.

3. Xác nhận `npm run build` tạo ra:

   - `dist/config/typeorm.data-source.js`
   - `dist/migrations/*.js`

4. Xác nhận production image có `typeorm` CLI và compiled migration files.

5. Kiểm tra runner nhận đúng các biến kết nối database, đặc biệt là `DB_HOST=postgres` khi chạy trong Compose.

## Kiểm thử

```powershell
npm run build
docker compose build api migrate
docker compose run --rm migrate npm run migration:show:compiled
```

Lệnh `migration:show:compiled` phải chỉ đọc trạng thái migration, không thay đổi schema.

## Tiêu chí nghiệm thu

- Runner chạy được trong production image.
- Không cần `ts-node` để chạy migration compiled.
- Runner kết nối được đến service PostgreSQL trong Docker network.
- Trên database rỗng, runner nhận diện đầy đủ 23 migration pending.
- Không phát sinh dependency trực tiếp mới ngoài những package đã có trong production image.

## Rủi ro cần kiểm tra

- DataSource compiled có thể resolve sai đường dẫn entity/migration nếu glob chỉ phù hợp với source TypeScript.
- Biến môi trường trong CLI và API có thể trỏ tới hai database khác nhau nếu không dùng chung cấu hình.
- Không được đánh đồng việc CLI chạy được với việc migration đã được áp dụng thành công; cần kiểm tra thêm lịch sử migration và schema.
