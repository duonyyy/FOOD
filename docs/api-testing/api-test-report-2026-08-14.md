# Báo cáo kiểm thử API Foodee

Ngày test: 2026-08-14  
Môi trường: Local Docker / development  
Base URL: `http://localhost:3000`  
Source commit: `31c3f27`  
OpenAPI: 3.0.0 — `FOODEE API` 1.0

## 1. Tóm tắt kết quả

| Hạng mục | Kết quả |
|---|---|
| API boot | PASS |
| API health/root/Swagger smoke | PASS |
| Public read smoke | PASS |
| Unauthorized checks | PASS |
| Webhook validation check | PASS |
| Docker dependency health | PASS |
| Migration runtime | PASS — 29 migrations applied |
| Phase 3 unit regression | PASS — 8 suites / 50 tests |
| Full E2E regression | PASS — 9 suites / 26 tests |
| Valid authenticated CRUD | BLOCKED — chưa có test credential/fixture an toàn |
| Real Momo/VNPay callback | BLOCKED — chưa có sandbox signature/provider fixture |

Kết luận tổng thể: **CONDITIONAL**. Các smoke/public/auth rejection và E2E
policy pass, nhưng chưa đủ bằng chứng để khẳng định toàn bộ 168 endpoint hoặc
payment provider flow đã pass.

## 2. Docker/runtime evidence

Các service đã được kiểm tra:

- `fooddie_api`: running, port `3000`.
- `fooddie_db`: healthy, port `5432`.
- `fooddie_redis`: healthy, port `6379`.
- `fooddie_minio`: healthy, port `9000/9001`.
- `fooddie_ai_server`: healthy, port `8000`.
- `fooddie_migrate`: exit `0`.

PostgreSQL xác nhận:

- 29 migration records đã được áp dụng.
- Có bảng `promotion_redemptions`.
- Có bảng `outbox_events`.
- Có snapshot columns trong `orderDetails`.

## 3. Manual endpoint smoke

| Method | Endpoint | Expected | Actual | Result |
|---|---|---:|---:|---|
| GET | `/health` | 200 | 200 | PASS |
| GET | `/` | 200 | 200 | PASS |
| GET | `/api` | 200 | 200 | PASS |
| GET | `/api-json` | 200 | 200 | PASS |
| GET | `/categories` | 200 | 200 | PASS |
| GET | `/foods` | 200 | 200 | PASS |
| GET | `/restaurants/all` | 200 | 200 | PASS |
| GET | `/orders/my` không token | 401 | 401 | PASS |
| GET | `/notifications` không token | 401 | 401 | PASS |
| GET | `/users/me` không token | 401 | 401 | PASS |
| GET | `/shippers/profile` không token | 401 | 401 | PASS |
| POST | `/payment/webhook` body rỗng/thiếu signature | 400 | 400 | PASS |

Các request POST trên chỉ kiểm tra validation và dừng trước side effect payment.

## 4. Swagger endpoint inventory

`GET /api-json` trả thành công và phát hiện **168 endpoint**:

| Tag | Count |
|---|---:|
| addresses | 6 |
| Admin restaurants | 4 |
| Auth | 13 |
| categories | 5 |
| Chat | 1 |
| Dashboard | 4 |
| delivery | 15 |
| DemoPayment | 9 |
| foods | 23 |
| Merchant restaurants | 5 |
| Messenger | 10 |
| Notifications | 2 |
| orders | 14 |
| payments | 9 |
| promotions | 6 |
| Restaurant discovery | 4 |
| reviews | 7 |
| roles | 18 |
| system | 3 |
| users | 10 |

Danh sách path chi tiết nằm trong response Swagger tại `/api-json`; không ghi
raw response vào report để tránh làm phình evidence hoặc lộ dữ liệu runtime.

## 5. Automated test evidence

### Phase 3 regression

```text
8 suites passed, 50 tests passed
```

Đã bao phủ state machine, pricing, snapshots, promotion redemption, outbox,
order authorization và actor policy.

### Full E2E

```text
9 suites passed, 26 tests passed
```

Các suite pass gồm category policy, locations/address policy, identity query,
notifications policy, restaurants policy, restaurant approval policy, reviews
policy, order policy và HTTP contract.

Lưu ý: Jest E2E hiện là in-process test app; nó xác nhận controller/module
contract nhưng không thay thế hoàn toàn việc gọi từng endpoint qua Docker API.

## 6. Warning/risk phát hiện

### [FAIL/RISK] Outbox scheduler thiếu entity metadata

Log API lặp lại:

```text
No metadata for "OutboxEvent" was found.
```

Nguyên nhân cần xử lý: `OutboxService` dùng `OutboxEvent`, và `OrderModule` có
đăng ký entity cục bộ, nhưng entity registry runtime tại
`src/infra/database/entity-registry.ts` chưa có `OutboxEvent`/các entity Phase 3
tương ứng. Scheduler retry outbox vì vậy không hoạt động đúng trong Docker.

Đây là lỗi runtime cần sửa trước khi đánh dấu outbox Phase 3 hoàn toàn PASS.

### [WARNING] Provider credentials

API log cảnh báo thiếu credential VNPay và biến môi trường mail. API vẫn boot,
nhưng payment provider thật và email flow chưa thể kết luận PASS.

### [NOT TESTED] Write/authenticated/provider flows

Chưa chạy valid-token CRUD, order creation thật, admin/merchant mutation,
Momo/VNPay signature callback hoặc destructive endpoint vì chưa có fixture và
sandbox credential được phê duyệt.

## 7. Kết luận và việc cần làm

API hiện **boot được và các smoke/E2E policy chính đều PASS**. Tuy nhiên chưa
đủ điều kiện nói toàn bộ API pass vì:

1. Cần thêm `OutboxEvent` vào entity registry dùng chung và chạy lại Docker smoke.
2. Cần cung cấp test identities/credentials an toàn cho authenticated matrix.
3. Cần sandbox fixture để test Momo/VNPay signature, amount, replay và failure.
4. Cần bổ sung write-data cleanup verification cho Order/Review/Notification.

Trạng thái báo cáo: **CONDITIONAL — ready for targeted follow-up, not full API
acceptance**.

