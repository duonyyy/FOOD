# Phase 3 — 5.5: Ordering và Promotions

## Phase metadata

| Field | Value |
|---|---|
| Owner | 5.5 |
| Task IDs | `T5.1–T5.7` |
| Prerequisite | Phase 2 `DONE` |
| Next phase | Phase 4 — Opus 4.6 |
| Expected effort | 8–12 ngày |
| Branch | `architecture/phase-3-5-5-ordering-promotions` |

## Mục tiêu

Tách hotspot `OrderService` thành use case rõ ràng, thiết lập Order state machine, pure pricing, immutable OrderItem snapshot và promotion redemption idempotent trong cùng transaction boundary. Đây là phase selective DDD đầu tiên.

## Ngoài phạm vi

- Không implement payment gateway/webhook mới.
- Không refactor shipper assignment/delivery queue.
- Không để Order sở hữu PaymentTransaction hoặc ShippingDetail.
- Không thay API contract ngoài thay đổi đã được Phase 0 ghi nhận/duyệt.

## Thứ tự thực hiện

### P3.1 — Nhận handoff và characterization

- [ ] Xác nhận Phase 2 `DONE` — functional gate đã PASS nhưng repository-wide lint/format baseline vẫn chờ reviewer chấp thuận.
- [x] Đọc Catalog/Merchant/Location contracts và snapshot schema.
- [x] Chạy toàn bộ order/pricing/promotion characterization tests.
- [x] Map public methods và caller của `OrderService`.
- [x] Ghi compatibility facade sẽ giữ trong phase.

Evidence: [P3.1 handoff và characterization](../evidence/phase-3-p3.1-handoff-characterization.md).

### P3.2 — T5.1 Order state machine

- [x] Liệt kê toàn bộ status hiện tại và actor được transition.
- [x] Định nghĩa allowed transition table.
- [x] Tạo domain methods/transition service cho confirm, reject, cancel, paid, delivery states, complete.
- [x] Query không được mutate status.
- [x] Invalid transition trả domain/application error ổn định.
- [x] Test toàn bộ transition table.

Evidence: [T5.1 Order state machine](../evidence/phase-3-t5.1-order-state-machine.md).

### P3.3 — T5.2 Split commands/queries

- [x] Tách CreateOrder.
- [x] Tách Get/List orders.
- [x] Tách Confirm/Reject/Cancel.
- [x] Tách MarkPaid/Complete handlers nhưng chưa sở hữu payment gateway/delivery.
- [x] Service cũ chỉ là compatibility facade hoặc được xóa khi không còn caller.
- [x] Không copy business logic giữa customer/merchant/admin.

Evidence: [T5.2 Order command/query](../evidence/phase-3-t5.2-order-command-query-split.md). `OrderService.createOrder()` giữ public compatibility facade và delegate sang `OrderCreateService`; pricing/payment transaction boundary tiếp tục được xử lý ở các task chuyên biệt.

### P3.4 — T5.3 Pure pricing

- [x] Pricing nhận server-side snapshots, không nhận trusted total từ client.
- [x] Tính subtotal, topping, discount, shipping fee và total bằng pure function/service.
- [x] Rounding/currency rule rõ ràng.
- [x] Test table-driven cho edge cases.
- [x] Không gọi database/provider trong pure pricing.

Evidence: [T5.3 Pure pricing](../evidence/phase-3-t5.3-pure-pricing.md).

### P3.5 — T5.4 OrderItem snapshots

- [x] OrderItem lưu foodId, name, unit price, quantity và topping snapshots.
- [x] Order history không phụ thuộc live Food relation để dựng giá/tên.
- [x] Tạo migration/backfill nếu schema cần thay đổi.
- [x] Có rollback/data compatibility plan.
- [x] Test live Catalog thay đổi không làm đổi order cũ.

Evidence: [T5.4 OrderItem snapshots](../evidence/phase-3-t5.4-order-item-snapshots.md).

### P3.6 — T5.5 Promotion redemption

- [x] Định nghĩa reservation/redemption status và owner.
- [x] Unique `orderId`/idempotency constraint.
- [x] Order + items + redemption dùng cùng Unit of Work/EntityManager.
- [x] Không mở transaction phụ khi outer transaction đang chạy.
- [x] Rollback order kéo theo rollback redemption.
- [x] Retry không tăng usage hai lần.
- [x] Loại promotion usage duplicate khỏi call sites cũ trong phạm vi Ordering.

Evidence: [T5.5 Promotion redemption](../evidence/phase-3-t5.5-promotion-redemption.md). Private legacy create implementation remains for cleanup only; active public path uses `OrderCreateService`.

### P3.7 — T5.6 Outbox/after-commit events

- [x] Lưu Order event/outbox trong cùng transaction.
- [x] Dispatch chỉ sau commit.
- [x] Có retry/idempotency cho handler.
- [x] Định nghĩa OrderCreated, OrderConfirmed, OrderCancelled, OrderPaid contracts.
- [x] Không emit side effect bắt buộc giữa transaction trước commit.

Evidence: [T5.6 Outbox](../evidence/phase-3-t5.6-outbox-after-commit.md). Legacy pubSub paths remain only for compatibility and are documented as follow-up.

### P3.8 — T5.7 Role controllers

- [x] Customer controller lấy customerId từ `CurrentActor`.
- [x] Merchant controller enforce restaurant ownership.
- [x] Admin controller dùng capability guard; lifecycle event/audit trail đi qua outbox contract.
- [x] DTO/Swagger/error response đúng contract.
- [x] Xóa/khóa route cũ không bảo vệ khi compatibility cho phép.
- [x] E2E role-resource matrix pass.

Evidence: [T5.7 Order actor controllers](../evidence/phase-3-t5.7-order-actor-controllers.md). Legacy pending-assignment/pubSub side effects remain documented compatibility follow-up.

## Phase gate

- [x] State machine và pricing tests pass.
- [x] Query không gây mutation.
- [x] OrderItem snapshot hoạt động và migration smoke pass — Docker migration
  chạy thành công; database có 29 migrations và snapshot schema đã được áp dụng.
- [x] Order/promotion rollback và retry tests pass ở unit/migration level.
- [x] Event chỉ dispatch sau commit.
- [x] Không repository chéo Catalog/Merchant/Locations trong active Phase 3 paths.
- [x] Role/ownership e2e pass.
- [ ] Build/lint/unit/integration/e2e pass — build, targeted unit và e2e pass;
  repository-wide lint còn baseline errors và aggregate unit command timeout.
- [x] Handoff report cho Opus 4.6 hoàn tất: [final verification](../evidence/phase-3-final-verification.md).

## Handoff cho Phase 4

5.5 phải chuyển:

- Order state/event contracts.
- `MarkOrderPaid` input contract.
- OrderConfirmed/DeliveryCompleted integration contract.
- Transaction/outbox implementation details.
- Schema/migration changes và rollback plan.
- Compatibility facade còn lại.

Có thể bắt đầu review chuẩn bị cho [Phase 4](./phase-4-opus-payments-delivery.md),
nhưng chỉ đóng Phase 3 hoàn toàn sau khi hai mục gate còn lại được xử lý.
