# Phase 3 — Final verification and handoff

Date: 2026-08-14

## Scope

T5.1–T5.7 đã được triển khai và commit riêng trên `main`: state machine,
command/query split, pure pricing, immutable item snapshots, transactional
promotion redemption, outbox sau commit và controller actor policies.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| Build | PASS | `npm run build` |
| Phase 3 unit regression | PASS | 8 suites / 50 tests PASS sau T5.7; lần chạy cuối 5 suite / 36 test PASS |
| Role/order e2e | PASS | 9 suites / 26 tests PASS, gồm `test/orders-policy.e2e-spec.ts` |
| Remaining split unit suites | PASS | 12 suites / 25 tests PASS |
| Changed-files lint | PASS with warnings | 0 errors, 85 warnings; chủ yếu `any`/compatibility code |
| Repository-wide lint | NOT PASS | Baseline hiện tại có khoảng 1.550+ lỗi format/Prettier ngoài phạm vi Phase 3 |
| Docker/DB runtime smoke | PASS | Rebuilt current images; migration exit 0, 29 migrations applied, Phase 3 tables exist, API `/health` returns 200 |

Full aggregate Jest command đã được chạy hai lần với timeout 180s và 300s;
nó không trả summary trước timeout. Các suite quan sát được và toàn bộ phần
còn lại khi chạy tách đều PASS, nhưng không ghi nhận aggregate command là PASS.

## Known follow-ups and risks

- Cần sửa baseline lint toàn repository hoặc giới hạn lint gate theo phạm vi
  package/module đã chuẩn hóa; không nên chạy format toàn repo trong commit Phase 3.
- Runtime smoke đã phát hiện và sửa hai blocker: `promotion_redemptions.customer_id`
  phải là `varchar(28)` để khớp `users.id`, và `OrderController` không được import
  policy qua Orders public barrel vì tạo circular module import khi boot Nest.
- Cần sửa baseline lint toàn repository hoặc giới hạn lint gate theo phạm vi
  package/module đã chuẩn hóa; không nên chạy format toàn repo trong commit Phase 3.
- Một số legacy `OrderService` private implementation và pub/sub compatibility
  paths vẫn còn. Active public create path đã đi qua `OrderCreateService`, còn
  việc xóa hẳn compatibility code nên làm sau khi xác nhận không còn caller.
- Outbox lifecycle contracts đã có retry/idempotency; audit trail đầy đủ cho
  nghiệp vụ admin không nên được hiểu là đã có chỉ vì có outbox event.

## Verdict

Implementation Phase 3: **DONE**.

Phase gate: **CONDITIONAL / NOT FULLY CLEARED**. Docker runtime đã pass; chỉ còn
repository-wide lint baseline và aggregate Jest timeout chưa được đóng.
