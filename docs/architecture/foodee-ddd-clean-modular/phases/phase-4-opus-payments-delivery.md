# Phase 4 — Opus 4.6: Payments và Delivery

## Phase metadata

| Field | Value |
|---|---|
| Owner | Opus 4.6 |
| Task IDs | `T6.1–T6.6`, `T7.1–T7.6` |
| Prerequisite | Phase 3 `DONE` |
| Next phase | Phase 5 — Luna |
| Expected effort | 12–18 ngày |
| Branch | `architecture/phase-4-opus-payments-delivery` |

## Mục tiêu

Tách Payment và Delivery thành hai feature có ownership rõ ràng, idempotency/concurrency được bảo vệ ở database, và giao tiếp với Ordering qua event/command contract từ Phase 3. Phase này xử lý vùng rủi ro tài chính và giao hàng cao nhất.

## Ngoài phạm vi

- Không thay đổi Catalog/Merchant ownership.
- Không để Payment trực tiếp sửa Food/Promotion/Order repository.
- Không để Queue sở hữu business assignment rule.
- Không gộp ShipperProfile trở lại User để tiết kiệm migration.

## Thứ tự thực hiện

### P4.1 — Nhận handoff và risk review

- [ ] Xác nhận Phase 3 `DONE` — implementation DONE và Docker/DB smoke đã PASS,
  nhưng final gate còn `CONDITIONAL` do repository-wide lint và aggregate Jest
  timeout.
- [x] Đọc Order state/event/Unit of Work contracts.
- [x] Chạy payment/promotion/delivery characterization tests: 8 suites / 44 tests PASS.
- [x] Map gateway callback, assignment job và status callers.
- [x] Ghi data migration/concurrency risks trước khi sửa.

Evidence: [P4.1 handoff and risk review](../evidence/phase-4-p4.1-handoff-risk-review.md).

## Payments

### P4.2 — T6.1 Payment ownership

- [x] Payments sở hữu Checkout/PaymentTransaction.
- [x] Payment chỉ tham chiếu `orderId` và server-side amount snapshot.
- [x] Định nghĩa Payment status machine.
- [x] Gỡ duplicate `OrderService`, `PromotionService`, `UsersService` provider.
- [x] Không serialize provider secret/payload nhạy cảm.

Evidence: [T6.1 Payment ownership](../evidence/phase-4-t6.1-payment-ownership.md).

### P4.3 — T6.2 Gateway ports/adapters

- [x] Định nghĩa `PaymentGatewayPort`.
- [x] Momo adapter implement port.
- [x] VNPay adapter implement port.
- [x] Timeout, retryable/non-retryable error mapping rõ ràng.
- [x] Config fail-fast; không fallback secret mẫu.
- [x] Contract tests cho signature/request mapping.

Evidence: [T6.2 Gateway ports/adapters](../evidence/phase-4-t6.2-payment-gateway-ports.md).

### P4.4 — T6.3 Webhook integrity/idempotency

- [x] Verify signature trước side effect.
- [x] Verify amount, currency, provider reference và order reference.
- [x] Unique provider transaction/reference và idempotency key.
- [x] Concurrent/replayed callbacks chỉ tạo một transition.
- [x] Response callback ổn định cho retry provider.
- [x] Không tin status/amount từ client.

Evidence: [T6.3 Webhook integrity](../evidence/phase-4-t6.3-payment-webhook-integrity.md).

### P4.5 — T6.4 Payment events

- [ ] PaymentSucceeded/PaymentFailed lưu sau transaction/outbox đúng contract.
- [ ] Ordering handler gọi MarkOrderPaid idempotently.
- [ ] Event handler retry không cập nhật order lặp.
- [ ] Notification/analytics không nằm trong payment transaction.

### P4.6 — T6.5 Remove cross-feature mutations

- [ ] Bỏ Payment cập nhật Order repository trực tiếp.
- [ ] Bỏ Payment tăng Food sales trực tiếp.
- [ ] Bỏ Payment gọi promotion usage lần nữa.
- [ ] Bỏ deep import service/repository feature khác.
- [ ] Architecture tests xác nhận boundary.

### P4.7 — T6.6 Reconciliation

- [ ] Job tìm payment provider success nhưng internal state chưa hoàn tất.
- [ ] Job idempotent và có bounded retry.
- [ ] Structured logs/metrics cho mismatch.
- [ ] Không tự sửa amount/reference không xác minh.

## Delivery

### P4.8 — T7.1 Delivery/ShipperProfile ownership

- [ ] Delivery sở hữu ShippingDetail/Delivery.
- [ ] Delivery sở hữu PendingAssignment.
- [ ] Delivery sở hữu ShipperProfile/certificate/policy/earnings reference.
- [ ] Identity User chỉ giữ account/actor reference.
- [ ] Có migration/backfill/rollback plan.

### P4.9 — T7.2 Assignment commands/policy

- [ ] OfferDelivery command.
- [ ] AcceptDelivery command.
- [ ] Reject/Reassign commands.
- [ ] Eligibility, timeout, exclusion và hold rules nằm trong Delivery.
- [ ] Actor/assignment ownership enforced.

### P4.10 — T7.3 Queue adapter boundary

- [ ] Bull processor chỉ parse job và gọi application command.
- [ ] Redis store chỉ lưu technical state theo contract.
- [ ] Business validation/retry policy không nằm trong `infra/queue`.
- [ ] Queue job idempotency và retry classification rõ ràng.
- [ ] Dead-letter/logging behavior có test.

### P4.11 — T7.4 Concurrent accept/reassign

- [ ] Dùng conditional update, optimistic hoặc pessimistic locking.
- [ ] Hai shipper accept cùng lúc chỉ một người thành công.
- [ ] Retry không tạo ShippingDetail duplicate.
- [ ] Reassign không mất assignment active hợp lệ.
- [ ] Integration test chạy trên PostgreSQL thực.

### P4.12 — T7.5 Delivery transitions

- [ ] Pickup/Start/Complete là command rõ ràng.
- [ ] `getOrder` chỉ đọc và không mutate.
- [ ] DeliveryCompleted phát event sau commit.
- [ ] Ordering handler hoàn tất order idempotently.
- [ ] Invalid actor/status transition có test.

### P4.13 — T7.6 Earnings/performance projection

- [ ] Earnings tính đúng một lần từ DeliveryCompleted.
- [ ] Retry event không tăng earnings lặp.
- [ ] Performance là read model/projection, không làm User thành god entity.
- [ ] Rebuild/reconciliation strategy được ghi rõ.

## Phase gate

- [ ] Gateway contract và webhook replay/concurrency tests pass.
- [ ] Payment không inject Ordering/Catalog/Promotions repository/service.
- [ ] Order được mark paid qua contract/event idempotent.
- [ ] Assignment concurrent accept test pass trên PostgreSQL.
- [ ] Queue không chứa business rule.
- [ ] Query delivery không mutate.
- [ ] Earnings không duplicate.
- [ ] Migration run/revert/smoke có evidence.
- [ ] Build/lint/unit/integration/e2e pass.
- [ ] Handoff report cho Luna hoàn tất.

## Handoff cho Phase 5

Opus phải chuyển:

- Payment/Delivery event contracts.
- Notification events cần consume.
- Analytics projection inputs.
- Reconciliation jobs/runbook.
- Schema/migration/rollback information.
- Known provider/queue operational risks.

Chỉ khi phase gate đạt mới mở [Phase 5](./phase-5-luna-communications-release.md).
