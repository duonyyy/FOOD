# Kế hoạch bỏ Snapshot và chuẩn hóa data contract

> Tuân theo `SIMPLIFY_CONTRACTS_PLAN.md`: bỏ port một implementation, không `forwardRef`,
> không deep-import và chuyển contract thuần dùng chung sang `src/shared`.

## 1. Mục tiêu

- Bỏ snapshot chỉ dùng để hỏi “có được phép hay không”.
- Đổi snapshot cần thiết thành command, record, view hoặc value object đúng mục đích.
- Chuyển type thật sự dùng chung sang `src/shared`.
- Giữ projection đặc thù ở feature owner.
- Không truyền entity/repository qua boundary.

## 2. Quy tắc quyết định

| Trường hợp | Cách xử lý |
|---|---|
| Chỉ kiểm tra quyền/trạng thái | Concrete `assert...Service` hoặc public method trả `void`/lỗi |
| Dữ liệu phục vụ một use case của owner | Giữ tại owner, export service qua narrow public API |
| Cùng contract thuần ở nhiều feature | Chuyển type sang `src/shared` |
| Dữ liệu lịch sử đã chốt | Giữ record/history, đổi tên rõ nghĩa |
| Entity/repository/runtime policy | Không chuyển shared và không truyền qua feature boundary |

Không tạo `*Port`, DI Symbol hoặc compatibility interface để thay Snapshot.

## 3. Nhóm ưu tiên bỏ hoàn toàn

- `CustomerOrderTrackingSnapshot` → Orders tự xác minh quyền track.
- `OrderReviewEligibilitySnapshot` → Orders cung cấp concrete eligibility service/method.
- `FoodReviewTargetSnapshot` → Menu cung cấp concrete existence/eligibility service.
- `DeliveryOrderSnapshot` → Delivery dùng Orders concrete reader/command, không đọc Order entity.

Xóa type, export và alias cũ trong cùng nhóm migration sau khi consumer đã chuyển.

## 4. Nhóm đổi tên nhưng giữ dữ liệu

| Tên cũ | Tên đích | Owner |
|---|---|---|
| `IdentityUserSnapshot` | `UserIdentity` hoặc shared auth identity sau audit | Users/shared |
| `ShipperProfileSnapshot` | `ShipperProfileView` | Delivery |
| `ActiveShipperSnapshot` | `ActiveShipperState` | Delivery |
| `DeliveryEarningsProjectionSnapshot` | `DeliveryEarningsProjection` | Delivery |
| `DeliveryQuoteSnapshot` | `DeliveryQuote` | Delivery |
| `OrderableItemSnapshot` | `OrderableMenuItem` | Menu |
| `OrderAnalyticsSnapshot` | `OrderAnalyticsRecord` | Orders/Analytics boundary |
| `PaymentOrderSnapshot` | `CreateCheckoutCommand` | Payments |
| `OrderItemSnapshot` | `OrderLineHistory` | Orders |

Tên trong bảng không mặc định thuộc shared. Chỉ chuyển khi qua đủ điều kiện trong
`SHARED_TYPES_EXTRACTION_PLAN.md`.

## 5. Thứ tự triển khai

### Đợt 0 — Kiểm kê

Tìm toàn bộ `*Snapshot`, ghi field/consumer/owner/hành vi lỗi và chạy baseline tests.

### Đợt 1 — Authorization snapshots

Xử lý tracking, review eligibility và food target bằng concrete public service/method;
không tạo port mới.

### Đợt 2 — Shared primitive/data contract

Chuyển type thực sự chung sang `src/shared`; chuyển import trực tiếp; xóa duplicate và
re-export tạm thời.

### Đợt 3 — Orders và Delivery

Orders giữ state transition; Delivery giữ assignment/shipping/shipper state. Synchronous
interaction dùng concrete service, async transaction/retry dùng EventBus/Outbox. Không port,
foreign repository/entity hoặc `forwardRef`.

### Đợt 4 — Payment và Analytics

Payment dùng command chứa giá trị đã chốt; Analytics dùng record tối thiểu/event. Không tạo
universal Order model trong shared.

### Đợt 5 — Lịch sử đơn hàng

Giữ tên/giá/topping tại thời điểm mua trừ khi có quyết định nghiệp vụ riêng cho phép đổi
hành vi đơn cũ. Đây không phải cleanup boundary thông thường.

## 6. Exit gate

- Không còn Snapshot của nhóm vừa xử lý.
- Không có port/token mới thay Snapshot.
- Không deep-import, foreign entity hoặc foreign repository.
- Không `forwardRef`.
- Type chuyển vào shared không có runtime dependency.
- Build, unit, integration, authorization và ownership tests pass.

