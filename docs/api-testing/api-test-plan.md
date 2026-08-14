# Kế hoạch kiểm thử API Foodee

Ngày lập: 2026-08-14  
Môi trường mục tiêu: Local Docker / development  
Base URL: `http://localhost:3000`  
API specification: `GET /api-json` — OpenAPI 3.0.0, `FOODEE API` 1.0

## 1. Mục tiêu

- Xác nhận API boot được trong Docker và các dependency chính hoạt động.
- Đối chiếu route thực tế với Swagger/OpenAPI.
- Kiểm tra public read, authentication, authorization và validation response.
- Kiểm tra các luồng Order, Payment, Promotion, Review, Notification và
  Delivery bằng test có sẵn.
- Không tạo hoặc xóa dữ liệu thật nếu chưa có credential/fixture và kế hoạch
  cleanup rõ ràng.

## 2. Phạm vi API được phát hiện

Swagger runtime phát hiện **168 endpoint**:

| Nhóm | Số endpoint | Phạm vi chính |
|---|---:|---|
| System | 3 | health, root, MinIO health, Swagger |
| Auth | 13 | login, register, OTP, password reset |
| Addresses | 6 | địa chỉ của customer |
| Categories | 5 | public read, admin/catalog write |
| Foods | 23 | food/menu/topping/query/command |
| Restaurants | 9 | discovery, merchant profile, admin approval |
| Orders | 14 | create, query, status, payment, promotion |
| Payments | 9 | checkout, Momo, VNPay, webhook |
| Promotions | 6 | CRUD và truy vấn promotion |
| Reviews | 7 | food/shipper review và query |
| Notifications | 2 | list/read status |
| Delivery/Shippers | 15 | assignment, pickup, delivery, earnings |
| Identity/Users/Roles | 28 | user, role, permission, admin query |
| Chat/Messenger | 11 | chat và messenger |
| Dashboard/Demo payment | 13 | dashboard và compatibility demo routes |

Danh sách path đầy đủ phải lấy từ `http://localhost:3000/api-json`, không tự
đoán thêm endpoint ngoài contract.

## 3. Điều kiện trước khi test

```powershell
docker compose ps
Invoke-WebRequest http://localhost:3000/health -UseBasicParsing
Invoke-WebRequest http://localhost:3000/api-json -UseBasicParsing
```

Các điều kiện cần ghi nhận:

- `api`, `postgres`, `redis`, `minio`, `ai-server` đang healthy/running.
- `migrate` exit code `0`.
- Không in ra `.env`, password, JWT, cookie, API key hoặc payment secret.
- Nếu thiếu credential test, đánh dấu `BLOCKED`; không tự tạo credential giả.

## 4. Test matrix

### A. Startup và dependency

- `GET /health` → `200`, JSON liveness đúng schema.
- `GET /` → `200`.
- `GET /api` và `GET /api-json` → `200`.
- Docker migration chạy thành công và không có migration pending ngoài dự kiến.
- PostgreSQL/Redis/MinIO/AI server healthcheck pass.

### B. Public read

- `GET /categories`
- `GET /foods`
- `GET /foods/search`
- `GET /restaurants/all`
- `GET /restaurants/popular`
- `GET /reviews/food/{foodId}`
- `GET /reviews/shipper/{shipperId}`

Kiểm tra status code, JSON shape, pagination/filter nếu endpoint hỗ trợ và
không yêu cầu token khi Swagger không khai báo authentication.

### C. Authentication và authorization

Với endpoint yêu cầu auth:

- Không có token → `401`.
- Token hợp lệ → kiểm tra response theo role/ownership fixture.
- Role không đủ quyền → `403`.
- Không được dùng `userId` từ request body để thay thế actor trong JWT.

Chỉ chạy valid-token/admin/merchant/shipper cases khi fixture đã có sẵn và
không làm lộ token trong log.

### D. Validation và error contract

- Thiếu field bắt buộc → `400` hoặc status được Swagger quy định.
- Sai kiểu dữ liệu/enum/ID → validation error có cấu trúc thống nhất.
- Webhook thiếu signature → `400`.
- Resource không tồn tại → `404`.
- Duplicate/conflict/idempotency → `409` nếu contract quy định.
- Không chấp nhận mọi `2xx` một cách chung chung; phải kiểm tra đúng status và
  response shape.

### E. Order/Payment/Promotion

- Order create tính total từ server-side data, không tin total client.
- Order status transition hợp lệ và invalid transition.
- Payment callback kiểm tra signature, amount, currency và replay behavior.
- Promotion redemption không tăng usage hai lần khi retry.
- Event/outbox được ghi sau transaction và retry không duplicate.

Các test write/payment provider thật chỉ chạy với sandbox hoặc fixture local.

### F. Review/Notification/Delivery

- Review food và shipper kiểm tra eligibility/duplicate target.
- Notification list/read chỉ truy cập dữ liệu actor hiện tại.
- Shipper accept/reject/start/complete kiểm tra actor và assignment state.
- Hai shipper accept cùng assignment chỉ có một winner.

## 5. Tooling và lệnh ưu tiên

Ưu tiên test có sẵn trong repository:

```powershell
npm run build
npm run test:e2e -- --runInBand --no-cache --cacheDirectory=.tmp/jest
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest <test-files>
```

Manual HTTP smoke dùng `Invoke-WebRequest` hoặc `Invoke-RestMethod`. Không thêm
dependency test mới nếu Jest/Supertest hiện tại đã đủ.

## 6. Side effect và cleanup

- Ưu tiên GET, validation error và unauthorized checks trước write test.
- Nếu phải POST/PUT/PATCH/DELETE, dùng fixture hoặc marker riêng cho test.
- Lưu các ID được tạo trong test, cleanup trong teardown/finally.
- Chỉ xóa record do chính test tạo.
- Không chạy `drop`, `reset`, `down -v`, migration revert hoặc wildcard delete
  trên database không xác định.

## 7. Tiêu chí kết luận

- **PASS:** contract, status, response và side effect đều đúng.
- **FAIL:** request chạy được nhưng sai behavior/contract hoặc có bug.
- **BLOCKED:** thiếu service, credential, fixture hoặc dependency runtime.
- **CONDITIONAL:** smoke/public/auth rejection pass nhưng còn nhóm protected,
  write, provider callback hoặc warning runtime chưa được xác minh.

