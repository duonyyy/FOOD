# 10 — Backend Hotfix Plan

## 1. Kết luận hiện tại

Backend hiện tại: **NOT READY FOR RELEASE**.

Các blocker cần xử lý trước khi release:

1. Payment ownership.
2. Delivery tracking BOLA/IDOR.
3. GraphQL và WebSocket authorization.
4. Public menu visibility.
5. Upload validation và MinIO access policy.

Đây là kế hoạch hotfix tối thiểu, tập trung vào việc chặn lỗi có thể gây mất tiền, lộ dữ liệu hoặc thao tác trái quyền. Không mở rộng thành refactor toàn bộ backend.

## 2. Nguyên tắc hotfix

- Không thay đổi business rule không liên quan.
- Không release từ worktree chưa biết rõ diff.
- Mỗi blocker có test reproduce trước và test regression sau khi sửa.
- Không dùng production DB hoặc production provider để test.
- Nếu chưa kịp sửa, tạm khóa route nguy hiểm bằng feature flag/API gateway.
- Không đánh dấu `PASS` nếu chỉ build thành công; build không chứng minh ownership hoặc security.

## 3. P0 containment — chặn tạm thời

Trong lúc chưa deploy bản sửa, cân nhắc tạm disable các surface sau:

```text
POST /payment/process/:checkoutId
POST /payment/cancel/:checkoutId
GET  /payment/checkout/:checkoutId
POST /payment/momo/check-status
GET  /customer/deliveries/orders/:orderId/track
GraphQL shipper/order queue và location operations
```

Đảm bảo production có:

```text
ENABLE_DEMO_PAYMENT=false
```

Nếu không thể disable toàn bộ, chỉ cho phép truy cập từ internal/admin network đối với các operation quản trị và provider status.

## 4. Hotfix 1 — Payment ownership

### Evidence

- `src/features/payments/payment.controller.ts:43-89`
- `src/features/payments/payment.controller.ts:111-183`
- `src/features/payments/payment.service.ts:92-143`

### Vấn đề

Các route payment có kiểm tra JWT ở một số route nhưng không truyền actor hiện tại xuống service để xác nhận checkout/order thuộc về user đó.

Ví dụ user B có thể thử dùng ID checkout của user A:

```text
POST /payment/process/{checkout-cua-A}
POST /payment/cancel/{checkout-cua-A}
GET  /payment/checkout/{checkout-cua-A}
```

Ngoài ra, `GET /payment/checkout/:checkoutId` hiện trả placeholder `PENDING` thay vì đọc trạng thái thật trong database. `POST /payment/momo/check-status` nhận `orderId` nhưng không yêu cầu authentication.

### Thay đổi hotfix tối thiểu

1. Lấy `actorId` từ JWT bằng `CurrentActor` hoặc request context.
2. Truyền `actorId` vào `PaymentService`.
3. Load checkout và so sánh với `actorId` bằng ownership snapshot bất biến `checkout.customerId`.
   Snapshot này được Ordering truyền vào lúc tạo checkout và migration backfill từ
   `orders.user_id` cho các checkout cũ.
4. Kiểm tra:

   ```text
   checkout.customerId === actorId
   ```

5. User ngoài scope nhận `403` hoặc `404` theo policy thống nhất.
6. Không gọi payment provider nếu ownership check thất bại.
7. Sửa checkout status endpoint để đọc trạng thái thật từ database.
8. Bảo vệ MoMo/VNPay status bằng owner check hoặc provider-only authentication.
9. Giữ nguyên signature, amount, currency, order reference và idempotency validation của webhook.
10. Payment chỉ lưu snapshot `customerId`; không import hoặc sở hữu repository của Order/User.

### Test đóng blocker

```text
A đọc/process/cancel checkout A       → được phép
B đọc/process/cancel checkout A       → 403/404
Checkout không tồn tại                 → 404
Callback sai signature                 → không đổi database
Callback sai amount/order reference    → không đổi database
Callback hợp lệ gửi hai lần            → một side effect
Hai callback hợp lệ chạy đồng thời     → một state transition
```

### Exit gate

- Không có cross-user payment read/write.
- Checkout status khớp database.
- Không provider call khi actor không hợp lệ.
- Payment idempotency và callback tests pass.

### Migration và kiểm tra dữ liệu trước deploy

Migration `1761000000007-AddCheckoutCustomerOwnership` phải chạy trước khi bật
version code hotfix. Sau khi chạy, kiểm tra các checkout chưa có owner:

```sql
SELECT COUNT(*) AS missing_customer_owner
FROM checkouts
WHERE "customerId" IS NULL;
```

Nếu kết quả lớn hơn `0`, dừng release và xử lý các checkout mồ côi trước; code
hotfix cố ý fail-closed và sẽ không cho user truy cập checkout không có owner.

## 5. Hotfix 2 — Delivery tracking BOLA

### Evidence

- `src/features/delivery/controllers/customer-delivery.controller.ts:7-19`
- `src/features/delivery/services/integration/delivery-integration.service.ts:63-97`

### Vấn đề

Route chỉ yêu cầu user đăng nhập:

```text
GET /customer/deliveries/orders/:orderId/track
```

Service tìm trực tiếp theo `orderId` và có thể trả:

```text
shipper.id
shipper.name
shipper.phone
shipper.rating
```

Chưa thấy ownership/participation check trước khi trả thông tin.

### Thay đổi hotfix tối thiểu

Đổi service thành dạng có actor:

```text
getDeliveryTracking(orderId, actorId)
```

Trước khi trả tracking, kiểm tra actor thuộc một trong các scope được business chấp nhận:

- customer sở hữu order;
- restaurant owner của order;
- shipper được assign;
- admin có quyền vận hành.

Nếu chưa chốt rõ policy, default an toàn là chỉ customer sở hữu order và operational actor được xem tracking.

Response cũng chỉ trả thông tin cần thiết. Không trả số điện thoại shipper nếu frontend không thực sự cần.

### Test đóng blocker

```text
Customer A xem order A       → được phép
Customer B xem order A       → 403/404
User chưa login               → 401
Order không tồn tại           → 404
User unrelated không thấy PII → pass
```

### Exit gate

- Không thể đổi `orderId` để xem order khác.
- Không lộ shipper phone/location ngoài scope.
- Tracking flow của customer hợp lệ vẫn hoạt động.

## 6. Hotfix 3 — GraphQL và WebSocket authorization

### Evidence

- `src/features/orders/controllers/order.resolver.ts:27-137`
- `src/features/delivery/controllers/shipper.resolver.ts:18-26`
- `src/features/communications/messenger/messenger.resolver.ts:109-135`

### Vấn đề

Một số operation nhận ID từ client nhưng chưa ràng buộc ID đó với actor trong JWT:

```text
getShipperQueueStatus(orderId)
orderStatusUpdated(userId)
orderCreated(restaurantId)
orderConfirmedForShippers(shipperId, ...)
shipperLocationUpdated(shipperId)
```

`triggerShipperCleanup` còn được khai báo như GraphQL Query nhưng thực tế gọi cleanup làm thay đổi state.

Messenger có `WebSocketAuthGuard`, nhưng filter chủ yếu so sánh `conversationId`; chưa đủ để chứng minh subscriber là participant.

### Thay đổi hotfix tối thiểu

1. Xóa `triggerShipperCleanup` khỏi public GraphQL schema hoặc chuyển thành internal worker/cron operation.
2. Thêm authentication guard cho HTTP GraphQL operation nhạy cảm.
3. Thêm `WebSocketAuthGuard` cho subscription.
4. Không tin `userId`/`shipperId` từ client; so sánh với user trong context.
5. Với order subscription, kiểm tra customer/restaurant owner/shipper/admin trước khi subscribe.
6. Với shipper location, chỉ cho self hoặc actor có quan hệ delivery hợp lệ.
7. Với messenger subscription, kiểm tra participant trước khi tạo iterator và tiếp tục filter theo server-side user context.

### Test đóng blocker

```text
Unauthenticated GraphQL query        → rejected
User B subscribe order status của A  → rejected/no event
Shipper B subscribe location của A   → rejected/no event
Non-participant subscribe conversation → rejected/no event
Client truyền userId giả             → không vượt được context JWT
Client gọi triggerShipperCleanup     → không có public mutation
```

### Exit gate

- Không còn sensitive GraphQL operation public ngoài chủ đích.
- Subscription authorization được test bằng hai user khác nhau.
- Không operation đọc có side effect quản trị.

## 7. Hotfix 4 — Public menu visibility

### Evidence

- `src/features/menu/foods/services/customer-food.service.ts:157-185`
- `src/features/menu/foods/services/customer-food.service.ts:229-247`

### Vấn đề

Một số public query chỉ lọc `food.status` khi client truyền query `status`. Nếu không truyền, food hidden có khả năng xuất hiện.

Một số query cũng chưa lọc nhất quán restaurant phải ở trạng thái `APPROVED`.

Hậu quả:

- user thấy món merchant đã ẩn;
- food của restaurant pending/rejected có thể xuất hiện;
- public menu không nhất quán với orderability rule.

### Thay đổi hotfix tối thiểu

Tạo điều kiện public dùng chung:

```text
restaurant.status = APPROVED
food.status = available
```

Áp dụng cho toàn bộ public food path:

```text
/foods
/foods/search
/foods/by-name
/foods/:id
/foods/:id/toppings
/foods/restaurant/:restaurantId
/foods/category/:categoryId
/foods/top-selling
/foods/newest
/foods/with-discount
```

Sau deploy phải invalidate menu cache hoặc restart cache phù hợp. Nếu không, query đã sửa vẫn có thể trả dữ liệu cũ.

### Test đóng blocker

```text
Available food + approved restaurant → public thấy
Hidden food                         → mọi public route không thấy
Pending restaurant                  → food không thấy
Rejected restaurant                 → food không thấy
Direct /foods/:id hidden            → 404 hoặc response theo policy, không trả food
```

### Exit gate

- Tất cả public menu variants dùng cùng visibility predicate.
- Hidden/unapproved resource không thể order qua public path.
- Cache sau update status không trả dữ liệu cũ.

## 8. Hotfix 5 — Upload validation và MinIO policy

### Evidence

- `src/features/restaurants/controllers/merchant-profile.controller.ts:43-50`
- `src/infra/minio/minio.service.ts:34-46,75-103`

### Vấn đề

Upload hiện có giới hạn 5 MB nhưng chưa đủ bằng chứng về:

- MIME allow-list;
- magic bytes/file signature;
- file thực sự là ảnh;
- SVG chứa script;
- executable đổi tên thành `.jpg`.

MinIO có public read policy cho toàn bucket khi bucket được tạo và content type lấy từ client.

### Thay đổi hotfix tối thiểu

1. Chỉ nhận JPEG/PNG/WebP ở hotfix đầu tiên.
2. Kiểm tra magic bytes, không tin mỗi `Content-Type`.
3. Tạm reject SVG nếu chưa có sanitizer an toàn.
4. Dùng object key do server sinh; không dùng path/filename raw của client.
5. Tách certificate khỏi public image bucket nếu certificate là dữ liệu riêng tư.
6. Dùng private bucket + signed URL cho file riêng tư.
7. Giữ giới hạn 5 MB và `maxCount=1`.
8. Bổ sung cleanup khi DB save thất bại sau upload.

### Test đóng blocker

```text
.exe đổi tên .jpg              → rejected
SVG chứa script                → rejected
MIME giả                       → rejected
File bytes không phải ảnh      → rejected
File > 5 MB                    → rejected
Filename ../../x               → safe/rejected
Certificate URL public         → phải theo policy private
DB failure sau upload         → object được cleanup
```

### Exit gate

- File giả không được lưu.
- Object key không bị path traversal.
- Certificate không public ngoài policy.
- Upload failure không tạo orphan object/record.

## 9. Trình tự thực hiện

| Thứ tự | Việc | Kết quả cần có |
|---:|---|---|
| 1 | Freeze commit/refactor target | Biết chính xác source được hotfix. |
| 2 | Reproduce bằng actor A/B | Có test chứng minh từng blocker. |
| 3 | Payment ownership | Không cross-user payment action/read. |
| 4 | Delivery tracking ownership | Không cross-user tracking/PII. |
| 5 | GraphQL/WS authorization | Không unauthorized event/state mutation. |
| 6 | Public menu predicate | Không lộ hidden/unapproved food. |
| 7 | Upload/MinIO policy | File validation và ACL pass. |
| 8 | Targeted regression | Các test P0 pass. |
| 9 | Staging smoke/canary | Flow chính pass trên environment gần production. |

## 10. Verification sau hotfix

Chạy trên test/staging environment:

```text
npm run build
```

Sau đó chạy targeted tests cho:

- payment ownership/idempotency;
- order actor policy;
- delivery ownership;
- GraphQL/WS subscription authorization;
- public menu visibility;
- upload validation;
- HTTP error/envelope contract.

Tiếp theo chạy smoke flow:

```text
login
→ restaurant approval
→ create menu
→ create order
→ payment
→ delivery
→ tracking
→ review/notification
→ GraphQL subscription
```

Không dùng production database. Ghi lại commit SHA, environment, seed version, DB/migration version, provider mode và request IDs.

## 11. Rollback plan

- Tách mỗi blocker thành commit nhỏ hoặc nhóm commit có thể revert độc lập.
- Không gộp migration không cần thiết vào hotfix.
- Trước deploy lưu version image/commit đang chạy.
- Nếu payment hoặc order flow lỗi sau deploy, rollback ngay về version trước; không tiếp tục xử lý payment bằng cách sửa tay trong production DB.
- Nếu chỉ lỗi public menu, có thể tạm disable public discovery/cache layer trong khi giữ order data nguyên vẹn.
- Sau rollback vẫn giữ containment đối với endpoint có nguy cơ BOLA/payment.

## 12. Release gate

Chỉ chuyển sang `READY WITH RISKS` hoặc `READY FOR RELEASE` khi:

- Payment A/B ownership test pass.
- Delivery tracking A/B test pass.
- GraphQL unauthorized query/subscription test pass.
- Hidden food và unapproved restaurant không xuất hiện trên public API.
- Malicious upload bị reject và object ACL đúng.
- Không còn Critical/High chưa có fix hoặc risk acceptance có owner/thời hạn.
- Smoke test pass hai lần trên staging/test DB.
- Có rollback plan đã thử hoặc được xác nhận.

Nếu bất kỳ P0 nào fail hoặc bị block vì thiếu provider/test environment, trạng thái vẫn là:

```text
NOT READY FOR RELEASE
```
