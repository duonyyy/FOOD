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

- [ ] Tách CreateOrder.
- [ ] Tách Get/List orders.
- [ ] Tách Confirm/Reject/Cancel.
- [ ] Tách MarkPaid/Complete handlers nhưng chưa sở hữu payment gateway/delivery.
- [ ] Service cũ chỉ là compatibility facade hoặc được xóa khi không còn caller.
- [ ] Không copy business logic giữa customer/merchant/admin.

### P3.4 — T5.3 Pure pricing

- [ ] Pricing nhận server-side snapshots, không nhận trusted total từ client.
- [ ] Tính subtotal, topping, discount, shipping fee và total bằng pure function/service.
- [ ] Rounding/currency rule rõ ràng.
- [ ] Test table-driven cho edge cases.
- [ ] Không gọi database/provider trong pure pricing.

### P3.5 — T5.4 OrderItem snapshots

- [ ] OrderItem lưu foodId, name, unit price, quantity và topping snapshots.
- [ ] Order history không phụ thuộc live Food relation để dựng giá/tên.
- [ ] Tạo migration/backfill nếu schema cần thay đổi.
- [ ] Có rollback/data compatibility plan.
- [ ] Test live Catalog thay đổi không làm đổi order cũ.

### P3.6 — T5.5 Promotion redemption

- [ ] Định nghĩa reservation/redemption status và owner.
- [ ] Unique `orderId`/idempotency constraint.
- [ ] Order + items + redemption dùng cùng Unit of Work/EntityManager.
- [ ] Không mở transaction phụ khi outer transaction đang chạy.
- [ ] Rollback order kéo theo rollback redemption.
- [ ] Retry không tăng usage hai lần.
- [ ] Loại promotion usage duplicate khỏi call sites cũ trong phạm vi Ordering.

### P3.7 — T5.6 Outbox/after-commit events

- [ ] Lưu Order event/outbox trong cùng transaction.
- [ ] Dispatch chỉ sau commit.
- [ ] Có retry/idempotency cho handler.
- [ ] Định nghĩa OrderCreated, OrderConfirmed, OrderCancelled, OrderPaid contracts.
- [ ] Không emit side effect bắt buộc giữa transaction trước commit.

### P3.8 — T5.7 Role controllers

- [ ] Customer controller lấy customerId từ `CurrentActor`.
- [ ] Merchant controller enforce restaurant ownership.
- [ ] Admin controller dùng capability + audit.
- [ ] DTO/Swagger/error response đúng contract.
- [ ] Xóa/khóa route cũ không bảo vệ khi compatibility cho phép.
- [ ] E2E role-resource matrix pass.

## Phase gate

- [ ] State machine và pricing tests pass.
- [ ] Query không gây mutation.
- [ ] OrderItem snapshot hoạt động và migration smoke pass.
- [ ] Order/promotion rollback và retry tests pass.
- [ ] Event chỉ dispatch sau commit.
- [ ] Không repository chéo Catalog/Merchant/Locations.
- [ ] Role/ownership e2e pass.
- [ ] Build/lint/unit/integration/e2e pass.
- [ ] Handoff report cho Opus 4.6 hoàn tất.

## Handoff cho Phase 4

5.5 phải chuyển:

- Order state/event contracts.
- `MarkOrderPaid` input contract.
- OrderConfirmed/DeliveryCompleted integration contract.
- Transaction/outbox implementation details.
- Schema/migration changes và rollback plan.
- Compatibility facade còn lại.

Chỉ khi phase gate đạt mới mở [Phase 4](./phase-4-opus-payments-delivery.md).
