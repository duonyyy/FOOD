# 06. Architecture Task Tracker

Đây là file theo dõi triển khai thực tế. Mỗi task phải có mã, dependency, evidence và acceptance criteria. Không đánh dấu `[x]` chỉ vì code đã compile; phải có bằng chứng từ test, source hoặc command đã chạy.

Phân công một model cho một phase nằm tại [07-model-task-allocation.md](./07-model-task-allocation.md); hướng dẫn từng phase nằm trong [phases/README.md](./phases/README.md).

## 1. Trạng thái tổng quan

| Field | Value |
|---|---|
| Last updated | 2026-08-07 |
| Overall status | `PHASE_2_IN_PROGRESS` |
| Current phase | `Phase 2 — Gemini 3.6: Simple Features, Merchants và Catalog` |
| Current phase status | `IN_PROGRESS` |
| Active task IDs | `T3.2–T4.6` |
| Execution mode | `Sequential — chỉ một phase được IN_PROGRESS` |
| Architecture decision | Feature-Sliced Modular Monolith + Selective DDD |
| Runtime migration | Chưa bắt đầu; source hiện tại vẫn ở `src/modules` |
| Tracking rule | Cập nhật status, evidence và blocker sau mỗi task |

### Status convention

- `TODO`: chưa bắt đầu.
- `IN_PROGRESS`: đang thực hiện, chưa đủ acceptance criteria.
- `BLOCKED`: có blocker cụ thể, ghi ở cột Blocker/log.
- `DONE`: tất cả checklist và acceptance criteria pass, có evidence.
- `DEFERRED`: có quyết định hoãn, phải ghi lý do và điều kiện mở lại.

## 2. Dashboard task

| ID | Nhóm | Task | Estimate | Depends on | Status | Evidence/PR |
|---|---|---|---:|---|---|---|
| T0.1 | Baseline | Inventory route và role/resource matrix | 0.5d | — | `DONE` | [171-route inventory](./evidence/phase-0-route-role-matrix.md) |
| T0.2 | Baseline | Authorization/ownership characterization tests | 1.5d | T0.1 | `DONE` | 6 suites/17 tests PASS; ownership 403, guard 401/403, admin permission và shipper offer |
| T0.3 | Baseline | Audit response exposure và DTO contract | 1d | T0.1 | `DONE` | [Response exposure audit](./evidence/phase-0-response-exposure-audit.md); 6 serialization cases PASS |
| T0.4 | Baseline | Order pricing/state characterization tests | 1.5d | T0.1 | `DONE` | [Pricing/state baseline](./evidence/phase-0-order-pricing-state-baseline.md); 8 cases PASS |
| T0.5 | Baseline | Promotion/payment idempotency tests | 1.5d | T0.1 | `DONE` | [Payment/promotion evidence](./evidence/phase-0-payment-promotion-idempotency.md); 14 cases PASS |
| T0.6 | Baseline | Delivery transition/concurrency tests | 1.5d | T0.1 | `DONE` | [Delivery evidence](./evidence/phase-0-delivery-baseline.md); 9 cases PASS |
| T0.7 | Baseline | Healthcheck và migration smoke test | 0.5d | — | `DONE` | [Health/migration evidence](./evidence/phase-0-health-migration-smoke.md); 23 migrations, API/MinIO/core smoke PASS |
| T1.1 | Platform | Request/correlation context | 1d | T0.1 | `DONE` | [P1.2 execution log](./evidence/phase-1-terra-execution-log.md); 4 focused tests, build and 18 suites/64 tests PASS |
| T1.2 | Platform | Structured logger và request metadata | 1d | T1.1 | `DONE` | [P1.3 execution log](./evidence/phase-1-terra-execution-log.md); 3 focused logging suites, build and 21 suites/68 tests PASS |
| T1.3 | Platform | Global error/response/pagination contract | 1.5d | T1.1 | `DONE` | [P1.4 execution log](./evidence/phase-1-terra-execution-log.md); 5 HTTP-contract E2E tests, build and 21 suites/68 tests PASS |
| T1.4 | Platform | Strict validation compatibility | 1d | T0.3 | `DONE` | [Validation/Swagger evidence](./evidence/phase-0-validation-swagger-security.md); 10 targeted cases PASS |
| T1.5 | Platform | API versioning và Swagger security | 0.5d | T1.4 | `DONE` | [Validation/Swagger evidence](./evidence/phase-0-validation-swagger-security.md); container Swagger/security smoke PASS |
| T1.6 | Platform | Unified entity registry | 1d | — | `DONE` | [P1.5 execution log](./evidence/phase-1-terra-execution-log.md); 20-entity source/runtime/compiled registry, 23 migration source/compiled smoke PASS |
| T1.7 | Platform | `FeaturesModule` composition | 0.5d | T1.6 | `DONE` | [P1.6 execution log](./evidence/phase-1-terra-execution-log.md); root composition test, build, E2E and 23 suites/71 tests PASS |
| T1.8 | Platform | Public API và dependency boundary lint | 1.5d | T1.7 | `DONE` | [P1.7 execution log](./evidence/phase-1-terra-execution-log.md); boundary-rule test 3/3, build and 24 suites/75 tests PASS |
| T2.1 | Contracts | Entity/feature ownership map | 1d | T1.7 | `DONE` | [P1.8 ownership map](./evidence/phase-1-entity-provider-ownership-map.md); 20 persistence entities mapped (the 21st filename is empty `otp.entity.ts`), provider owners, compatibility owners and foreign repository access recorded |
| T2.2 | Contracts | Feature shell và module registry | 1.5d | T2.1 | `DONE` | P1.9: 12 canonical non-empty shells, `public-api.ts`, owner/roadmap README and composition test. No entity/service/provider migration. |
| T2.3 | Contracts | Public facade/port contract | 1.5d | T2.1 | `DONE` | P1.10: six public DI tokens and five contract groups (Menu, Restaurants, Locations/Geocoding, Promotions, Delivery); ID/value/snapshot DTO only, 3 suites/8 tests PASS |
| T2.4 | Contracts | Remove duplicate providers | 1d | T2.2 | `DONE` | Auth/Payment duplicate providers removed; `SystemConstraintsService` has one owner; Payment → Orders uses tested in-process event boundary instead of `OrderService` injection |
| T2.5 | Contracts | Architecture dependency tests | 1d | T1.8, T2.3 | `DONE` | P1.11: feature lint rejects foreign legacy entity/repository imports; boundary, provider ownership, composition and contract tests 12/12 PASS |
| P2.1 | Phase 2 | Receive handoff, baseline and import graph | 0.5d | T2.5 | `DONE` | [P2.1 handoff evidence](./evidence/phase-2-p2.1-handoff.md) |
| T3.1 | Simple features | Category slice | 1.5d | T2.5 | `DONE` | [T3.1 Category evidence](./evidence/phase-2-t3.1-category.md); 30 unit suites/92 tests and 2 E2E suites/7 tests PASS |
| T3.2 | Simple features | Locations/Address slice | 2d | T2.5 | `DONE` | [T3.2 Locations evidence](./evidence/phase-2-t3.2-locations.md); build, 4 focused unit suites/12 tests, policy E2E PASS; legacy Address facade retained for Users/Chat/Order/Restaurant callers |
| T3.3 | Simple features | Identity roles/users query slice | 2d | T2.5 | `DONE` | [T3.3 Identity evidence](./evidence/phase-2-t3.3-identity.md); build, 4 focused unit suites/10 tests and 4 E2E suites/11 tests PASS |
| T3.4 | Simple features | Review slice | 2d | T2.5 | `DONE` | [T3.4 Reviews evidence](./evidence/phase-2-t3.4-reviews.md); build, 5 focused unit suites/14 tests and policy E2E PASS |
| T3.5 | Simple features | Notification slice | 1.5d | T2.5 | `DONE` | [T3.5 Notifications evidence](./evidence/phase-2-t3.5-notifications.md); build, 3 focused unit suites/14 tests PASS; 0 lint errors |
| T4.1 | Merchants | Restaurant profile/onboarding | 2d | T3.2, T3.3 | `DONE` | [T4.1 Restaurant evidence](./evidence/phase-2-t4.1-restaurant-profile-onboarding.md); build, 3 unit suites/6 tests and onboarding policy E2E 3 tests PASS |
| T4.2 | Merchants | Restaurant approval/rejection | 1.5d | T4.1 | `DONE` | [T4.2 Restaurant approval evidence](./evidence/phase-2-t4.2-restaurant-approval.md); build, 4 focused unit suites/10 tests and approval policy E2E 4 tests PASS |
| T4.3 | Catalog | Food command/query slice | 2.5d | T3.1, T4.1 | `DONE` | [T4.3 Food evidence](./evidence/phase-2-t4.3-food-command-query.md) |
| T4.4 | Catalog | Category/topping ownership | 1.5d | T3.1, T4.3 | `DONE` | [T4.4 Category/topping evidence](./evidence/phase-2-t4.4-category-topping.md) |
| T4.5 | Catalog | Owner/resource policies | 1.5d | T0.2, T4.3 | `DONE` | [T4.5 Policy evidence](./evidence/phase-2-t4.5-resource-policies.md) |
| T4.6 | Catalog | `OrderableItemSnapshot` contract | 1.5d | T4.3, T4.4 | `DONE` | [T4.6 Snapshot evidence](./evidence/phase-2-t4.6-orderable-item-snapshot.md) |
| P3.1 | Phase 3 | Ordering handoff và characterization | 0.5d | T4.6 | `DONE` | [P3.1 handoff evidence](./evidence/phase-3-p3.1-handoff-characterization.md); 6 suites/23 tests PASS; compatibility callers and status risks mapped |
| T5.1 | Ordering | Order state machine | 2d | T0.4, T4.6 | `DONE` | [T5.1 Order state machine evidence](./evidence/phase-3-t5.1-order-state-machine.md); 3 suites/30 tests PASS; build PASS |
| T5.2 | Ordering | Split order commands/queries | 2d | T5.1 | `DONE` | [T5.2 Order command/query evidence](./evidence/phase-3-t5.2-order-command-query-split.md); 4 suites/34 tests PASS; build PASS |
| T5.3 | Ordering | Pure pricing service | 1.5d | T0.4, T5.1 | `DONE` | [T5.3 Pure pricing evidence](./evidence/phase-3-t5.3-pure-pricing.md); 2 suites/13 tests PASS; build PASS |
| T5.4 | Ordering | OrderItem immutable snapshots | 1d | T4.6, T5.1 | `DONE` | [T5.4 OrderItem snapshots evidence](./evidence/phase-3-t5.4-order-item-snapshots.md); 3 suites/12 tests PASS; build PASS |
| T5.5 | Promotions | Redemption transaction/idempotency | 2.5d | T0.5, T5.1 | `DONE` | [T5.5 Promotion redemption evidence](./evidence/phase-3-t5.5-promotion-redemption.md); 3 suites/14 tests PASS; build PASS |
| T5.6 | Ordering | Outbox/after-commit event contract | 2d | T5.5 | `DONE` | [T5.6 Outbox evidence](./evidence/phase-3-t5.6-outbox-after-commit.md); 3 suites/12 tests PASS; build PASS |
| T5.7 | Ordering | Customer/merchant/admin controllers | 1.5d | T0.2, T5.2 | `DONE` | [T5.7 Order actor controllers evidence](./evidence/phase-3-t5.7-order-actor-controllers.md); 4 suites/16 tests PASS; build PASS |
| P3.GATE | Phase 3 | Final verification and handoff | 0.5d | T5.1–T5.7 | `CONDITIONAL` | [Phase 3 final verification](./evidence/phase-3-final-verification.md); implementation DONE, Docker runtime smoke and repository-wide lint remain open |
| P4.1 | Phase 4 | Payments/Delivery handoff và risk review | 0.5d | P3.GATE | `CONDITIONAL` | [P4.1 handoff and risk review](./evidence/phase-4-p4.1-handoff-risk-review.md); 8 suites/44 characterization tests PASS; Phase 3 prerequisite not fully cleared |
| T6.1 | Payments | Payment ownership model | 1d | T2.1, T5.1 | `TODO` | — |
| T6.2 | Payments | Gateway port/adapters | 2d | T6.1 | `TODO` | — |
| T6.3 | Payments | Webhook signature/amount/idempotency | 2d | T0.5, T6.2 | `TODO` | — |
| T6.4 | Payments | Payment events và Ordering handler | 1.5d | T5.6, T6.3 | `TODO` | — |
| T6.5 | Payments | Remove direct cross-feature mutations | 1.5d | T6.4 | `TODO` | — |
| T6.6 | Payments | Reconciliation/retry job | 1.5d | T6.3, T6.4 | `TODO` | — |
| T7.1 | Delivery | Delivery/ShipperProfile ownership | 2d | T2.1, T0.6 | `TODO` | — |
| T7.2 | Delivery | Assignment commands và policy | 2d | T7.1 | `TODO` | — |
| T7.3 | Delivery | Queue adapter chỉ schedule/dispatch | 1.5d | T7.2 | `TODO` | — |
| T7.4 | Delivery | Concurrent accept/reassign locking | 2d | T0.6, T7.2 | `TODO` | — |
| T7.5 | Delivery | Pickup/start/complete transitions | 2d | T7.4 | `TODO` | — |
| T7.6 | Delivery | Earnings/performance projection | 1.5d | T7.5 | `TODO` | — |
| T8.1 | Communications | Chat public ports và orchestration | 2d | T4.6, T5.7 | `TODO` | — |
| T8.2 | Communications | Event-driven notifications | 1.5d | T5.6, T6.4, T7.5 | `TODO` | — |
| T8.3 | Analytics | Read model/backoffice queries | 2d | T5.6, T6.4, T7.6 | `TODO` | — |
| T8.4 | Cleanup | Remove old modules/compatibility facade | 2d | T3.1–T8.3 | `TODO` | — |
| T8.5 | Cleanup | Final quality gate và tài liệu | 1.5d | T8.4 | `TODO` | — |

Tổng estimate là tổng effort, không phải thời gian lịch nếu có thể làm song song. Các task database, payment, authorization và concurrency không nên giao cho AI Agent tự merge mà không có reviewer.

## 3. Task detail và checklist

## T0 — Baseline và safety

### T0.1 — Inventory route và role/resource matrix

**Mục tiêu:** biết endpoint nào public, actor nào được gọi và resource ownership nằm ở đâu.

Checklist:

- [ ] Export route list từ controller/OpenAPI.
- [ ] Ghi method, path, controller, guard, permission metadata.
- [ ] Ghi resource chính: user, address, restaurant, food, order, promotion, delivery.
- [ ] Ghi actor hợp lệ: anonymous, customer, owner, shipper, admin.
- [ ] Ghi route đang dùng `body.userId`, `body.total`, `body.status` hoặc ID của client.
- [ ] Link kết quả vào `docs/architecture/` hoặc PR evidence.

Acceptance: không còn endpoint nhạy cảm nằm ngoài inventory.

### T0.2 — Authorization/ownership characterization tests

Checklist:

- [ ] Customer A không đọc/sửa order/address của Customer B.
- [ ] Owner A không sửa food/restaurant/order của Owner B.
- [ ] Shipper không accept/complete delivery không được assign.
- [ ] Anonymous bị chặn ở endpoint nhạy cảm.
- [ ] Admin permission được kiểm tra riêng với ownership.
- [ ] Test phân biệt `401` và `403`.

Acceptance: role-resource matrix có test allowed và forbidden cho mọi nhóm route P0.

### T0.3 — Audit response exposure và DTO contract

Checklist:

- [ ] Tìm `password`, token, secret, credential trong response relation.
- [ ] Tạo response DTO cho User, Restaurant owner, Order và Shipper.
- [ ] Kiểm tra GraphQL resolver không trả ORM entity ngoài contract.
- [ ] Test snapshot/serialization không chứa hash hoặc secret.

Acceptance: không response credential/hash và API schema được ghi rõ.

### T0.4 — Order pricing/state characterization tests

Checklist:

- [ ] Test subtotal, topping, discount, shipping fee và total.
- [ ] Test món hết hàng, restaurant không hoạt động, địa chỉ không hợp lệ.
- [ ] Test status transition hợp lệ/không hợp lệ.
- [ ] Test COD và online payment hiện tại.
- [ ] Lưu kết quả làm baseline trước refactor.

Acceptance: refactor sau này phải giữ hoặc có quyết định thay đổi rõ ràng cho baseline.

### T0.5 — Promotion/payment idempotency tests

Checklist:

- [x] Gọi promotion usage hai lần cho cùng order.
- [x] Retry payment callback cùng provider reference.
- [x] Callback amount/status không khớp.
- [x] Order rollback sau promotion failure.
- [x] Concurrent payment callback.

Acceptance: test hiện rõ behavior đang có và behavior mục tiêu; lỗi hiện tại phải được ghi blocker/bug riêng.

### T0.6 — Delivery transition/concurrency tests

Checklist:

- [x] Test offer, accept, reject, pickup, start, complete.
- [x] GET order không làm đổi status sau khi sửa.
- [x] Hai shipper accept cùng assignment.
- [x] Retry/timeout assignment.
- [x] Tính earnings một lần.

Acceptance: có test xác định một actor duy nhất thắng concurrent accept.

### T0.7 — Healthcheck và migration smoke test

Checklist:

- [x] API health endpoint trả `200` qua đúng port/API prefix.
- [x] PostgreSQL container chạy migration từ database rỗng.
- [x] App boot sau migration thành công.
- [x] Core API smoke test sau migration.
- [x] Ghi rõ MinIO health là native port hay API proxy.

Acceptance: Docker compose có healthcheck phản ánh đúng service cần kiểm tra.

## T1 — Platform foundation

### T1.1–T1.3 — Request context, logger, error/response contract

- [ ] Tạo correlation/request ID middleware.
- [ ] Gắn actor ID, route, status code, duration vào structured log.
- [ ] Chuẩn hóa error envelope và không leak stack/secret.
- [ ] Chuẩn hóa pagination metadata.
- [ ] Test request ID được giữ qua service/event log.

Acceptance: một request production có thể trace qua controller, service và provider adapter.

### T1.4–T1.5 — Validation, versioning và Swagger

- [x] Đánh giá breaking change trước khi bật `forbidNonWhitelisted`.
- [x] Bổ sung DTO cho body/query/param P0 còn thiếu contract; legacy ngoài scope được ghi debt.
- [x] Bổ sung `ApiTags`, `ApiBearerAuth`, `ApiOperation`, `ApiResponse`.
- [x] Swagger production được bảo vệ, không dùng credential mặc định.
- [x] Health endpoint và API versioning decision được ghi trong evidence.

Acceptance: Swagger phản ánh đúng DTO và error contract của route đã migrate.

### T1.6–T1.8 — Composition, entity registry và boundaries

- [ ] `AppModule` chỉ compose `InfraCoreModule` và `FeaturesModule`.
- [ ] Tạo entity registry dùng chung runtime/CLI.
- [ ] Tạo `public-api.ts` cho feature đã migrate.
- [ ] Cấm deep import bằng ESLint/dependency rule.
- [ ] Kiểm tra không có duplicate import/provider.
- [ ] Không thêm `forwardRef` mới.

Acceptance: architecture test fail khi feature import nội bộ feature khác.

## T2 — Feature contracts

### T2.1–T2.5 — Ownership và compatibility

- [x] Lập bảng entity/table → owning feature.
- [x] Lập bảng provider → owning module.
- [ ] Tạo shell `identity`, `locations`, `merchants`, `catalog`, `promotions`, `ordering`, `payments`, `delivery`, `communications`, `analytics`, `backoffice`.
- [ ] Định nghĩa facade/port: Catalog reader, Merchant reader, Location reader, Promotion redemption, Delivery quote.
- [ ] Xóa provider bị provide lại trong Auth/Payment.
- [ ] Tạo architecture test cho ownership và import boundary.

Acceptance: module contract tồn tại trước khi di chuyển business implementation.

## T3 — Feature đơn giản

Mỗi task T3 phải hoàn tất trọn vertical slice: module, controller, DTO, service, entity ownership, policy, test và public API.

- [x] **T3.1 Category:** public read, owner/admin write, DTO, policy, test. Evidence: [T3.1 Category](./evidence/phase-2-t3.1-category.md).
- [x] **T3.2 Locations:** address ownership, geocoding port, temporary order address contract, test. Evidence: [T3.2 Locations](./evidence/phase-2-t3.2-locations.md).
- [x] **T3.3 Identity:** roles/users query, current actor, không expose credential, test. Evidence: [T3.3 Identity](./evidence/phase-2-t3.3-identity.md).
- [x] **T3.4 Reviews:** eligibility query port, target invariant, duplicate review constraint, test. Evidence: [T3.4 Reviews](./evidence/phase-2-t3.4-reviews.md).
- [x] **T3.5 Notifications:** read/write contract, event handler boundary, retry/logging, test.

Acceptance chung: không feature nào của T3 import repository của feature khác.

## T4 — Merchants và Catalog

- [x] **T4.1 Restaurant:** onboarding, owner mapping, address reference, public discovery, test. Evidence: [T4.1 Restaurant](./evidence/phase-2-t4.1-restaurant-profile-onboarding.md).
- [x] **T4.2 Approval:** admin approve/reject, audit event, state transition test. Evidence: [T4.2 Restaurant approval](./evidence/phase-2-t4.2-restaurant-approval.md).
- [x] **T4.3 Food:** command/query split, image storage port, availability/status, owner policy.
- [x] **T4.4 Category/Topping:** ownership, menu relation, duplicate/name constraints. Evidence: [T4.4 Category/topping](./evidence/phase-2-t4.4-category-topping.md).
- [x] **T4.5 Policies:** owner A không sửa resource của owner B; customer/shipper bị chặn; admin capability test. Evidence: [T4.5 Policies](./evidence/phase-2-t4.5-resource-policies.md).
- [x] **T4.6 Snapshot:** tạo `OrderableItemSnapshot`; test giá/tên/topping không đổi theo live catalog. Evidence: [T4.6 Snapshot](./evidence/phase-2-t4.6-orderable-item-snapshot.md).

Acceptance: Catalog không inject Order/Review repository; Merchants không inject Food/Order repository.

## T5 — Ordering và Promotions

- [x] **T5.1 State machine:** định nghĩa transition và invalid transition errors. Evidence: [T5.1 Order state machine](./evidence/phase-3-t5.1-order-state-machine.md).
- [x] **T5.2 Use cases:** tách CreateOrder/read/confirm/reject/cancel/paid/complete; payment transaction vẫn tiếp tục là compatibility facade để tách ở T5.5. Evidence: [T5.2 Order command/query](./evidence/phase-3-t5.2-order-command-query-split.md).
- [x] **T5.3 Pricing:** pure pricing tests, không đọc client total. Evidence: [T5.3 Pure pricing](./evidence/phase-3-t5.3-pure-pricing.md).
- [x] **T5.4 OrderItem:** lưu price/name/topping snapshot. Evidence: [T5.4 OrderItem snapshots](./evidence/phase-3-t5.4-order-item-snapshots.md).
- [x] **T5.5 Redemption:** cùng Unit of Work, unique order redemption, locking/idempotency. Evidence: [T5.5 Promotion redemption](./evidence/phase-3-t5.5-promotion-redemption.md).
- [x] **T5.6 Outbox:** event chỉ được dispatch sau commit và có retry. Evidence: [T5.6 Outbox](./evidence/phase-3-t5.6-outbox-after-commit.md).
- [x] **T5.7 Controllers:** customer/merchant/admin API, actor lấy từ JWT. Evidence: [T5.7 Order actor controllers](./evidence/phase-3-t5.7-order-actor-controllers.md).

Acceptance: rollback, retry, concurrent promotion và invalid status transition đều có test pass.

## T6 — Payments

- [ ] **T6.1 Ownership:** Payment sở hữu Checkout/PaymentTransaction; chỉ giữ `orderId`.
- [ ] **T6.2 Gateway:** tạo `PaymentGatewayPort`, adapter Momo/VNPay, timeout/error mapping.
- [ ] **T6.3 Webhook:** verify signature, amount, currency, provider reference, idempotency key.
- [ ] **T6.4 Events:** `PaymentSucceeded`/`PaymentFailed` sau commit; Ordering handler idempotent.
- [ ] **T6.5 Cleanup:** bỏ direct update Order/Food/Promotion từ Payment.
- [ ] **T6.6 Reconciliation:** retry provider success nhưng internal event chưa xử lý.

Acceptance: Payment không inject repository hoặc service thuộc Ordering, Catalog, Promotions.

## T7 — Delivery

- [ ] **T7.1 Ownership:** Delivery sở hữu ShippingDetail, PendingAssignment, ShipperProfile, certificate, policy.
- [ ] **T7.2 Commands:** offer/accept/reject/reassign rõ actor và state.
- [ ] **T7.3 Queue adapter:** Bull/Redis chỉ schedule, dispatch, retry technical; rule nằm trong Delivery.
- [ ] **T7.4 Concurrency:** conditional update/locking cho concurrent accept.
- [ ] **T7.5 Transitions:** pickup/start/complete là command; query không mutate.
- [ ] **T7.6 Projection:** earnings/performance không làm User thành god entity.

Acceptance: một assignment không thể được accept bởi hai shipper và queue không sở hữu business rule.

## T8 — Communications, Analytics và cleanup

- [ ] **T8.1 Chat:** query qua public ports; LLM output validate; explicit confirmation trước CreateOrder.
- [ ] **T8.2 Notifications:** consume events, retry và dead-letter/log policy.
- [ ] **T8.3 Analytics:** read model/projection, không inject write service của domain nguồn.
- [ ] **T8.4 Cleanup:** xóa `src/modules` slice đã migrate, duplicate providers, deep imports và compatibility facade hết hạn.
- [ ] **T8.5 Final gate:** build, lint, unit, integration, e2e, migration smoke, Swagger review và cập nhật tài liệu.

## 4. Log blocker và quyết định

| Date | Task | Blocker/decision | Owner | Resolution/evidence |
|---|---|---|---|---|
| 2026-08-01 | Phase 0 | Bắt đầu trên `architecture/phase-0-sol-safety-api`; bảo toàn worktree hiện hữu | Sol | Build PASS; unit 5/5 suites PASS; lint baseline 15 errors/915 warnings; Docker pipe unavailable |
| 2026-08-02 | T1.4/T1.5 + Phase 0 gate | Strict DTO/Swagger/security hoàn tất; legacy lint ngoài scope còn 15 errors/808 warnings; Phase 1 chưa mở | Sol | Full Jest 17 suites/60 tests PASS; build/targeted lint/diff check PASS; Compose redeploy + Swagger/health/MinIO/demo smoke PASS; [handoff](./evidence/phase-0-handoff-terra.md) |
| 2026-08-04 | P1.1 | Baseline completed on `main`; owner accepted `/docs/` as local-only, so no `.gitignore` change is required | Terra | `DONE`; build and 17 suites/60 tests PASS; all 23 migrations applied; lint and E2E suite gaps are recorded in [P1.1 execution log](./evidence/phase-1-terra-execution-log.md) |
| 2026-08-04 | P1.4 / T1.3 | Global success wrapping rejected as breaking for unversioned legacy routes; contract is explicitly opt-in | Terra | `DONE`; five self-contained E2E cases and full unit regression PASS; repository-wide Prettier debt remains out of scope |
| 2026-08-04 | P1.5 / T1.6 | Registry contains 20, not 21, persistence entities because `otp.entity.ts` is empty and has no `@Entity` decorator | Terra | `DONE`; registry is shared by runtime/source CLI/compiled CLI; 23 migrations are applied and compiled run has no pending migration |
| 2026-08-04 | P1.6 / T1.7 | Composition-only split: Queue stays feature-imported because it is already required by Order, Payment and Shipper; adding it to root core would duplicate the graph | Terra | `DONE`; AppModule has exactly InfraCoreModule and FeaturesModule; no business provider/repository relocation |
| 2026-08-04 | P1.7 / T1.8 | Existing Auth `forwardRef` calls and duplicate Payment `PromotionService` provider are legacy debt; new violations are lint errors with narrow line-level baseline exceptions | Terra | `DONE`; public API convention, custom ESLint boundaries and 3-rule architecture test added; cleanup remains T2.4 |
| 2026-08-07 | P2.2 / T3.1 | Category had no caller outside the legacy Menu composition; its module also registered foreign `Food` and `Restaurant` entities | Gemini 3.6 | `DONE`; Category moved to `features/menu/categories`, public read snapshot and permission-protected writes added, legacy module removed; [T3.1 evidence](./evidence/phase-2-t3.1-category.md) |
| 2026-08-07 | P2.3 / T3.2 | Address has active legacy callers in Users, Chat, Order and Restaurant, so deleting the old path would break composition | Gemini 3.6 | `DONE`; Address moved to `features/locations/addresses`, legacy paths became facades, ownership/DTO/snapshot/geocoding tests pass; [T3.2 evidence](./evidence/phase-2-t3.2-locations.md) |

Quy tắc: blocker liên quan schema, payment, security hoặc data migration phải ghi trước khi tiếp tục task phụ thuộc. Không đánh dấu `DONE` nếu còn blocker P0/P1 chưa có risk acceptance.

## 5. Báo cáo sau mỗi task

Mỗi task hoàn tất cần ghi:

```text
Task: T?.?
Status: DONE / BLOCKED
Changed files:
Tests/commands:
Evidence:
Remaining risks:
Next task:
```
