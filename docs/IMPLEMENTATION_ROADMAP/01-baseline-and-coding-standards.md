# Phase 1 — Baseline và Coding Standards

## Mục tiêu

Tạo một điểm xuất phát đo được và ngăn nợ kỹ thuật mới phát sinh trước khi refactor module lớn.

## Hiện trạng cần ghi nhận

- API chạy trong Docker tại port `3000`.
- PostgreSQL và Redis chạy trong Compose.
- Database hiện có 23 migration đã áp dụng và có dữ liệu seed/nghiệp vụ.
- Một số service lớn: food, order, shipper, restaurant.
- Test hiện tập trung ở users/role; auth, chat, order, payment còn thiếu.
- Runtime còn nhiều `console.log`, `any` và DTO chưa đồng nhất.

## Bước 1 — Chụp baseline

- [ ] Lưu commit hash bắt đầu phase.
- [ ] Chạy `npm run build`.
- [ ] Chạy `npm test -- --runInBand` và ghi test pass/fail hiện tại.
- [ ] Chạy `docker compose up -d` và kiểm tra API, PostgreSQL, Redis.
- [ ] Smoke test `/`, `/categories`, `/restaurants/all`, `/foods/top-selling`.
- [ ] Ghi số migration và row count bảng chính.
- [ ] Ghi các warning hiện có, ví dụ mail chưa cấu hình.

## Bước 2 — Chuẩn hóa scripts

- [ ] Giữ `lint` tự sửa cho local nếu cần.
- [ ] Thêm `lint:check` không có `--fix` cho CI.
- [ ] Thêm `test:unit`, `test:integration` nếu cấu trúc test được tách.
- [ ] Thêm `verify` chạy build + lint check + test.
- [ ] Không để script CI ghi lại source file.

## Bước 3 — Coding standards

Tạo `docs/CODING_STANDARDS.md` với quy tắc:

- Controller chỉ parse request, lấy identity, gọi application service và trả response.
- Input public bắt buộc dùng DTO + `class-validator`.
- Không dùng `any` cho auth/order/payment/chat input-output.
- Service được đặt tên theo use case nếu module lớn.
- Không dùng giá, role, userId hoặc trạng thái do client gửi làm nguồn tin cậy.
- Dùng NestJS `Logger`; cấm log secret, token, OTP, password và payment credential.
- Throw NestJS exception hoặc domain error được map tập trung.
- Transaction boundary đặt ở application use case.
- Module chỉ export service/interface thực sự được module khác dùng.

## Bước 4 — Global validation và error format

- [ ] Xác nhận global `ValidationPipe` có `whitelist`, `transform`, `forbidNonWhitelisted`.
- [ ] Định nghĩa response lỗi chuẩn: `statusCode`, `code`, `message`, `requestId`, `timestamp`, `path`.
- [ ] Tạo global exception filter; không trả stack trace ở production.
- [ ] Giữ backward compatibility cho frontend bằng cách document field thay đổi.

## Bước 5 — CI tối thiểu

- [ ] Cài dependency bằng `npm ci`.
- [ ] Chạy `npm run build`.
- [ ] Chạy `npm run lint:check`.
- [ ] Chạy test unit.
- [ ] Không cần khởi động MinIO ở phase này.

## Test và xác minh

```powershell
npm run build
npm run lint:check
npm test -- --runInBand
docker compose ps
```

## Deliverables

- Baseline report.
- Coding standards.
- CI workflow tối thiểu.
- Script kiểm tra không tự sửa source.

## Rủi ro và rollback

- Thay lint config có thể tạo nhiều lỗi cũ: chỉ enforce rule mới theo từng nhóm, không format hàng loạt.
- Global error format có thể ảnh hưởng frontend: rollout bằng compatibility mapper hoặc phối hợp frontend.

## Exit criteria

- Build và test baseline chạy lặp lại được.
- Code mới có chuẩn rõ ràng.
- CI chặn build/type/test failure.
- Không có thay đổi business behavior trong phase này.

