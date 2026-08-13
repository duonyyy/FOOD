# Phase 3 — T5.7 Order actor controllers

Date: 2026-08-13

## Scope completed

- Thêm `OrderActorPolicy` cho quyền đọc, xóa, thanh toán và merchant status.
- Customer routes lấy actor bằng `@CurrentActor()` từ JWT; không dùng
  `body.userId` hoặc user id do client gửi.
- Merchant status route kiểm tra `restaurant.owner.id` với actor JWT.
- Admin status route `PUT /orders/admin/:id/status` dùng `RolesGuard` và
  `Permission.ORDER.WRITE`; admin list route dùng `ORDER.READ`.
- Customer read/detail/payment/delete routes dùng policy chung.
- Customer, merchant, shipper participant read policy được test riêng.

## Actor matrix

| Actor | Read related order | Delete | Pay | Merchant status | Admin status |
|---|---:|---:|---:|---:|---:|
| Customer | yes | yes | yes | no | no |
| Merchant owner | yes | no | no | yes | no |
| Assigned shipper | yes | no | no | no | no |
| Admin with write capability | guarded | no implicit customer action | no implicit customer action | via admin route | yes |

## Verification

```text
npm run build
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/features/orders/policy/order-actor.policy.spec.ts \
  src/modules/order/order.authorization.spec.ts \
  src/common/events/outbox.service.spec.ts

npx jest --config test/jest-e2e.json --runInBand --no-cache \
  test/orders-policy.e2e-spec.ts
```

Result: **4 suites / 16 tests PASS**; build PASS.

Tests cover unrelated customer denial, participant read, customer-only
delete/pay, merchant-only status, admin route guard/capability metadata and
JWT actor ownership during create.

The e2e suite verifies customer create ownership, merchant status ownership and
admin capability denial/allowance through HTTP routes.

## Compatibility note

Legacy controller still contains pending-assignment/pubSub side effects around
merchant status. They do not decide actor identity; moving all status side
effects to command/outbox is a later cleanup boundary.

## Verdict

T5.7: **DONE**. Customer/merchant/admin ownership boundaries are explicit and
actor identity comes from authenticated JWT context.
