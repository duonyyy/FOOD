# Kế hoạch làm gọn feature Delivery

Ngày lập: 2026-09-24
Trạng thái kỹ thuật: nhịp 0–4 đã triển khai; sau đó gom sáu service chính vào `services/` nhưng còn hai service hỗ trợ riêng. Chưa đóng feature: PostgreSQL/Redis thật và full lint chưa đạt gate. Trạng thái commit/push mới nhất phải kiểm tra bằng `git log` và `git status`; các ghi chú Git bên dưới là snapshot lịch sử trước lần commit đầu tiên của đợt này.

## 1. Mục tiêu thực tế sau khi kiểm tra phụ thuộc

Ưu tiên ranh giới một chiều, quyền truy cập, transaction/Outbox và khả năng tìm đúng chỗ sửa code. Sáu file service chính dưới đây đã có trong code; hai service hỗ trợ hẹp vẫn tách riêng vì lý do ghi bên dưới:

```text
src/features/delivery/
├── controllers/
│   ├── customer-delivery.controller.ts
│   ├── shipper-delivery.controller.ts
│   ├── admin-delivery.controller.ts
│   ├── legacy-shipper-admin.controller.ts  # Route tương thích
│   └── shipper.resolver.ts
├── services/
│   ├── customer-delivery.service.ts
│   ├── shipper-delivery.service.ts
│   ├── admin-delivery.service.ts
│   ├── delivery-dispatch.service.ts
│   ├── delivery-trip.service.ts
│   ├── delivery-report.service.ts
│   ├── dispatch/active-shipper-tracker.service.ts  # Bộ nhớ/timer riêng
│   └── shipper/shipper-profile.service.ts          # Provider module hồ sơ hẹp
├── handlers/
│   └── delivery-events.handler.ts
├── adapters/              # Redis pending assignment store
├── queue/                 # Worker và tên queue, không tính là service nghiệp vụ
├── dto/
├── types/
├── contracts/             # Command types và quy tắc dispatch hiện có
├── delivery.module.ts
├── public-api.ts
├── shipper-profile.module.ts       # Ngoại lệ hẹp: Auth cần hồ sơ shipper
├── shipper-profile.public-api.ts   # Giữ cho đến khi có hướng phụ thuộc an toàn
└── README.md
```

Không thêm một `DeliveryService` chỉ để chuyển tiếp lời gọi. Không tạo `forwardRef()`, deep import chéo feature hoặc port nghiệp vụ mới. Entity tiếp tục nằm ở `src/entities` theo quyết định hiện tại. Giữ nguyên HTTP/GraphQL route, quyền truy cập, response, queue name, khóa Redis và event contract trừ khi có thay đổi hành vi được duyệt riêng. **Hai module và hai public API là ngoại lệ có chủ đích ở hiện tại**, không phải lỗi cần xóa bằng một lần đổi tên. Sáu service chính không đồng nghĩa với đúng sáu provider hoặc sáu file service tổng cộng.

## 2. Baseline trước nhịp 1 (lịch sử, không phải số liệu hiện tại)

| Điểm hiện tại | Bằng chứng | Hệ quả khi triển khai |
| --- | --- | --- |
| Hai module và hai public API | `delivery.module.ts`, `shipper-profile.module.ts`, `public-api.ts`, `shipper-profile.public-api.ts` | Giữ ngoại lệ hẹp khi Auth còn dùng hồ sơ shipper. |
| 14 file `*.service.ts` gồm cả adapter Redis | `src/features/delivery/services/**`, `adapters/redis-pending-assignment-store.service.ts` | Không đếm số file làm tiêu chí hoàn tất; adapter Redis là hạ tầng Delivery. |
| Vòng DI trực tiếp | `DeliveryDispatchService` inject `ShipperService`; `ShipperService` kế thừa `ShipperDeliveryService` và inject lại `DeliveryDispatchService` | Gỡ vòng trước mọi bước di chuyển file. Build thành công không chứng minh Nest khởi tạo được provider. |
| Vòng module tiềm tàng | Auth import `ShipperProfileModule`; `DeliveryModule` import `AuthModule` | Không thay `ShipperProfileModule` bằng `DeliveryModule` trong Auth khi hai chiều còn tồn tại. |
| Lớp bọc cũ | `ShipperService`, `DeliveryAssignmentCommandService` | Xóa khi đã chuyển hết consumer; không giữ facade chỉ để giảm số import. |
| Luồng bền vững | Assignment và completion dùng transaction + Outbox; earnings projection có `idempotencyKey` | Giữ thứ tự commit, phát event và chống xử lý trùng. Không đổi thành publish in-process đơn thuần. |
| README chưa khớp code | `src/features/delivery/README.md` nhắc một số file không còn tồn tại | Viết lại sau khi code và test đạt. |

### Quyền sở hữu

- Delivery ghi `ShippingDetail`, `PendingShipperAssignment`, `ShipperProfile`, `ShipperCertificateInfo`, `DeliveryEarningsEvent` và trạng thái giao hàng.
- Orders là nơi duy nhất đổi `Order.status`. Delivery chỉ đọc hoặc yêu cầu Orders qua `orders/public-api.ts` và event/outbox hiện có.
- Auth sở hữu xác thực, mật khẩu, JWT. Delivery sở hữu hồ sơ và điều kiện hoạt động của shipper.
- Queue/cache/map là hạ tầng; không import ngược từ `src/features/**`.

## 3. Trách nhiệm cần rõ ràng, không ép số file

| File đích | Trách nhiệm | Nguồn dự kiến |
| --- | --- | --- |
| `customer-delivery.service.ts` | Báo giá, tracking và kiểm tra quyền xem vị trí shipper | `DeliveryIntegrationService`, `DeliverySubscriptionAccessService` |
| `shipper-delivery.service.ts` | API shipper, GPS và kiểm tra quyền của shipper | `ShipperDeliveryService`; giữ `ShipperProfileService` ở module hẹp khi Auth còn cần |
| `admin-delivery.service.ts` | Duyệt/từ chối hồ sơ, tra cứu shipper và tổng quan điều phối | `AdminDeliveryService` |
| `delivery-dispatch.service.ts` | Tìm shipper, giữ cuốc, offer/accept/reject/reassign, retry, cleanup và queue | `DeliveryDispatchService`, phần cần thiết của `ActiveShipperTrackerService` và `DeliveryAssignmentCommandService` |
| `delivery-trip.service.ts` | Dành chuyến, bắt đầu/hoàn tất/hủy chuyến, transaction, Outbox và ghi ledger thu nhập theo event | `DeliveryAssignmentSagaService`, `DeliveryCompletionService`, phần ghi/projection của `DeliveryEarningsService` |
| `delivery-report.service.ts` | Lịch sử, dashboard, thống kê và báo cáo thu nhập | `DeliveryReportService`, phần đọc báo cáo của `DeliveryEarningsService` nếu cần |
| `delivery-events.handler.ts` | Đăng ký/hủy đăng ký các subscriber; chuyển event Orders/Delivery tới đúng service | `OrderStatusDeliveryHandler` và subscriber trong saga/earnings |

Các hàm thuần nhỏ để tính toán có thể nằm trong file nội bộ cùng nhóm nghiệp vụ; chúng không cần một Nest provider mới. Bảng trên **không phải lệnh ghép nguyên văn các file**: trước khi chuyển từng method phải kiểm tra transaction, lock, event và kích thước file. Giữ service riêng khi việc ghép làm file quá lớn, tạo vòng DI hoặc che mất transaction boundary.

## 4. Thứ tự triển khai

### Nhịp 0 — Chốt baseline

- Kiểm tra `git status`, ghi lại file chưa commit ngoài Delivery; không đưa chúng vào thay đổi.
- Lập ma trận consumer/provider của Delivery, Auth, Users, Orders, Queue và EventBus.
- Ghi danh sách route HTTP/GraphQL, guard, permission, response và event/queue/Redis key hiện tại.
- Chạy build và test Delivery/Auth/boundary hiện có, ghi rõ test nào pass, skip hoặc lỗi môi trường. Không dùng kết quả cũ làm kết quả của lần triển khai mới.

**Đầu ra:** bảng baseline và danh sách test có thể chạy. **Qua nhịp:** biết đầy đủ consumer của hai public API và cách tạo provider tại runtime.

### Nhịp 1 — Gỡ vòng DI trong Delivery

- Chuyển các thao tác điều phối đang gọi qua `ShipperService` về owner phù hợp giữa dispatch và trip.
- `DeliveryDispatchService` không còn inject `ShipperService`; `ShipperDeliveryService` không inject ngược dispatch nếu có thể thay bằng một luồng gọi một chiều.
- Cho controller/worker gọi service đích; bỏ `DeliveryAssignmentCommandService` và `ShipperService` khi `rg` xác nhận không còn consumer.
- Kiểm thử **Nest TestingModule khởi tạo provider thật** cùng các dependency liên quan, ngoài build TypeScript.

**Đầu ra:** đồ thị DI không vòng. **Qua nhịp:** dispatch, accept/reject, retry, authorization và concurrency giữ nguyên hành vi.

### Nhịp 2 — Giữ các thay đổi có giá trị kiểm chứng được

- Chuyển tracking/quote/subscription access vào customer service; bảo đảm kiểm tra ownership trước khi trả tracking hoặc vị trí.
- Chỉ chuyển hồ sơ/GPS, chuyến giao hoặc active matching khi có vấn đề cụ thể cần giải quyết và test chứng minh không đổi hành vi. Không ghép `DeliveryDispatchService` đang lớn chỉ để bớt file.
- Giữ command types và quy tắc dispatch trong `contracts/`; việc chuyển chỗ đơn thuần không có lợi ích runtime.
- Giữ earnings projection có khóa chống trùng. Gom subscriber sang một handler, chỉ đăng ký **một lần** cho mỗi event.
- Giữ Redis store là adapter, `FindShipperProcessor` là queue worker. Không chuyển chúng thành role service để đủ số lượng file.

**Đầu ra:** ít lớp bọc thừa hơn, trách nhiệm rõ, một event handler; số service không phải gate. **Qua nhịp:** transaction/Outbox, earnings idempotency, cleanup/restore, quyền xem tracking/location và subscription đều có test đạt. Test cần PostgreSQL thật phải ghi riêng nếu chưa chạy.

### Nhịp 3 — Quyết định riêng về module hồ sơ shipper

- Mặc định giữ `ShipperProfileModule` và `shipper-profile.public-api.ts` làm ranh giới hẹp; không coi đây là nợ phải xóa để đạt chỉ tiêu một module.
- Nếu thực sự cần một module/API, phải lập đồ thị Auth–Identity–Orders–Delivery đầy đủ và chứng minh hướng gọi một chiều trước khi sửa. Không chỉ bỏ import Auth trực tiếp vì Delivery còn đi qua Identity và Orders.
- Thiết kế riêng transaction hoặc compensation cho tình huống tạo account thành công nhưng tạo profile thất bại; không xóa account tự động khi chưa chứng minh an toàn.
- Thu hẹp export dựa trên consumer thực tế, không export controller/worker/adapter/handler nội bộ chỉ để có sẵn. Route admin legacy và resolver chỉ đổi khi test xác nhận không thay contract.

**Đầu ra:** quyết định có bằng chứng: giữ ngoại lệ hẹp hoặc kế hoạch migration được kiểm thử. **Qua nhịp:** không có import vòng, `forwardRef()` hoặc deep import; route/auth contract giữ nguyên. Chưa có quyết định migration thì giữ cấu trúc hẹp hiện hành.

### Nhịp 4 — Khóa chất lượng và cập nhật tài liệu

- Cập nhật boundary test theo cấu trúc thực tế; chỉ bỏ assertion bảo vệ module/API hẹp nếu có migration được duyệt và kiểm thử.
- Kiểm tra chỉ Delivery ghi entity giao hàng/shipper và chỉ Orders đổi `Order.status`.
- Viết lại `src/features/delivery/README.md` và cập nhật `PROJECT_CODEBASE_AUDIT.md` theo code/test thực chạy.

**Đầu ra:** tài liệu đúng trạng thái code. **Qua nhịp:** toàn bộ gate dưới đây đạt; nếu có test phụ thuộc PostgreSQL/Redis thật không chạy được, ghi rõ chưa kiểm chứng, không đánh dấu pass.

## 5. Gate kiểm thử

Sau mỗi nhịp thay code: `npm run build`, scoped ESLint trên file thay đổi, unit test Delivery liên quan và `git diff --check`.

Trước khi coi Delivery hoàn tất:

- Unit: dispatch cleanup/restore, assignment, completion, earnings projection, report, profile, admin, tracking, GraphQL subscription authorization.
- Integration: `feature-ownership-boundaries`, `provider-ownership`, `public-contracts`, shipping detail concurrency và queue processor.
- Auth: đăng ký, trạng thái xét duyệt và đăng nhập shipper; test lỗi giữa bước tạo user và tạo profile.
- E2E: `delivery-tracking-policy.e2e-spec.ts` và các route shipper/admin bị ảnh hưởng.
- Runtime: Nest TestingModule khởi tạo `DeliveryModule` với các hạ tầng cần thiết được mock có chủ đích; kiểm tra provider và event subscription không bị nhân đôi.
- Scan: hai module/API có lý do và consumer rõ ràng; không `forwardRef`, cross-feature deep import, Delivery repository `Order` hoặc ghi `Order.status`. Chỉ đổi gate sang một module/API sau khi migration được quyết định và chạy test.

Không tuyên bố pass dựa trên tên test hay báo cáo cũ; lưu lệnh, exit code và số suite/test của lần chạy thực tế.

## 6. Phạm vi và điểm cần quyết định khi triển khai

- Chỉ sửa Delivery và consumer trực tiếp cần thiết ở Auth, Users, Orders cùng test/tài liệu liên quan. Không đụng file Docker, AI, GJobs hoặc thay đổi chưa commit của người dùng.
- Không thay đổi schema hay migration chỉ để làm gọn cây thư mục.
- Không bỏ Outbox/idempotency/lock để giảm file. Chỗ gộp có rủi ro cao nhất là dispatch ↔ trip và Auth ↔ hồ sơ shipper; hoàn thành từng nhịp rồi mới tiếp tục.
- Sáu nhóm trách nhiệm là định hướng đọc code, không phải quota file/provider. Giữ tách biệt khi cần để tránh service quá lớn hoặc che giấu Outbox, idempotency và transaction.

**Bước tiếp theo:** chạy test concurrency/rollback trên PostgreSQL thật trong môi trường an toàn; sau đó xử lý riêng join báo cáo thu nhập và luồng hủy chuyến. Không gộp module khi còn chiều phụ thuộc Auth–Delivery.

## 7. Bằng chứng nhịp 0–1 (2026-09-24)

### Baseline trước khi sửa

- `git status`: nhánh `main` đồng bộ `origin/main`; có thay đổi Docker, AI và các thư mục/file tham chiếu chưa commit. Các mục này không thuộc Delivery và không được sửa.
- Delivery có hai module, hai public API, 14 file `*.service.ts` tính cả adapter Redis.
- Dependency: Delivery import Auth, Orders, Users, SystemConstraints, Events, cache và queue. Auth chỉ import module/API hồ sơ shipper hẹp của Delivery; **chưa gộp hai module** vì vòng module tiềm tàng.
- Provider cycle: `DeliveryDispatchService → ShipperService → ShipperDeliveryService → DeliveryDispatchService`. `DeliveryAssignmentCommandService` chỉ là lớp bọc không được đăng ký trong `DeliveryModule`.
- Route giữ lại: `/shippers/**`, `/delivery/assignments/**`, `/customer/deliveries/**`, `/admin/deliveries/**`, `/users/shippers/**`; resolver shipper vẫn có guard cho subscription.
- Event giữ lại: `ordering.order.status-changed`, `delivery.assignment-requested`, `delivery.assignment-claimed`, `delivery.assignment-rejected`, `delivery.completed`, `delivery.shipper-offer-requested`.
- Queue giữ tên `find-shipper`; Redis store giữ các key `pending-assignment:*` cho assignment, order, notified, shipper hold, order hold và lock.
- Lệnh baseline thực chạy: `npm run build` đạt; Jest scoped Delivery/public contract/boundary đạt **22 suite, 90 test**. Log ERROR/WARN trong test mô phỏng nhánh lỗi, không phải test fail.

### Thay đổi của nhịp 1

- Dispatch tự xử lý offer/accept/reject/reassign, xác thực hồ sơ shipper và gọi `DeliveryAssignmentSagaService.assign()` để dành chuyến. `ShipperDeliveryService` gọi dispatch một chiều cho các method điều phối còn được route cũ dùng.
- Xóa `ShipperService` facade và `DeliveryAssignmentCommandService` không có provider runtime; cập nhật export của Delivery và test consumer.
- Thêm test Nest `TestingModule` khởi tạo hai provider thật, cùng test authorization, offer, expired hold, saga và reassign.
- Test PostgreSQL concurrency được cập nhật theo saga/Outbox hiện hành. Test này chỉ chạy khi `FOODEE_RUN_POSTGRES_INTEGRATION=1`; ở môi trường mặc định là skip, chưa có bằng chứng pass với PostgreSQL thật.
- Auth chưa có test trực tiếp cho đăng ký/đăng nhập shipper trong `test/unit/features/auth`; cần bổ sung ở nhịp 3 khi đổi hướng phụ thuộc Auth/Delivery.

### Kết quả kiểm tra sau sửa

| Lệnh/kiểm tra | Kết quả thực chạy |
| --- | --- |
| `npm run build` | Đạt, exit 0. |
| ESLint trên file TypeScript thay đổi | Đạt, exit 0. |
| Jest Delivery/Auth/public contract/boundary/queue/concurrency scoped | 27 suite, 102 test đạt; 1 suite/2 test PostgreSQL skip theo cấu hình. Exit 0. |
| E2E `delivery-tracking-policy.e2e-spec.ts` | 1 suite, 4 test đạt. Exit 0. |
| Nest `TestingModule` với `DeliveryDispatchService` và `ShipperDeliveryService` thật | Đạt; hai provider được khởi tạo với dependency ngoài được mock. |
| Scan source Delivery | Không còn `ShipperService`, `DeliveryAssignmentCommandService` hoặc `forwardRef()`; không có chiều inject từ dispatch về shipper service. |
| `git diff --check` trên code/test của nhịp 1 | Đạt. Git chỉ cảnh báo quy đổi LF/CRLF trên Windows. |

Log ERROR/WARN trong các test mô phỏng Redis lỗi, job không hợp lệ và quyền bị từ chối; kết luận dựa vào exit code và tổng kết Jest. Test PostgreSQL concurrency mới **chưa được xác minh với PostgreSQL thật**. E2E đã chạy chỉ bao phủ tracking; chưa phải kiểm chứng mọi route shipper/admin.

Sau nhịp 1, `delivery-dispatch.service.ts` dài khoảng 699 dòng; không tiếp tục ghép thêm logic vào file này chỉ để giảm số service. Delivery vẫn có hai module và hai public API vì Auth đang dùng profile module/API hẹp. Các file chưa commit ngoài phạm vi vẫn nguyên trạng. Không commit hoặc push trong nhịp 0–1 này.

## 8. Tiến độ nhịp 2 (2026-09-24)

- Đã gom quote, tracking và quyền xem vị trí vào `CustomerDeliveryService`. Service kiểm tra quyền sở hữu Order trước khi đọc chi tiết giao hàng; controller vẫn loại số điện thoại shipper khỏi response.
- Đã thử chuyển command types và quy tắc dispatch khỏi `contracts/`, rồi đưa về vị trí cũ sau rà soát: đây chỉ là đổi đường dẫn import, không sửa hành vi. Không giữ phần churn đó.
- Đã gom việc đăng ký bốn event Delivery vào `DeliveryEventsHandler`. Saga và earnings service chỉ xử lý nghiệp vụ, không tự subscribe nữa. Vẫn dùng transaction, Outbox và idempotency key cũ.
- **Không còn gate sáu service:** `ShipperProfileService` vẫn phục vụ Auth qua `ShipperProfileModule` riêng. Xóa/gộp provider này sẽ kéo vòng `AuthModule → DeliveryModule → AuthModule`, kể cả đường gián tiếp qua Identity và Orders. `DeliveryDispatchService` hiện đã lớn, nên không ghép thêm toàn bộ active tracker chỉ để giảm số file.
- Phần còn lại chỉ làm khi có vấn đề cụ thể: đánh giá trip/earnings/report/shipper và active matching theo kích thước, transaction và test. Test runtime handler đã bổ sung ở dưới. Không tuyên bố hoàn tất toàn bộ Delivery chỉ vì build qua.

### Kiểm tra tiếp theo: Auth, event runtime và gate (2026-09-24)

- Test Nest `TestingModule` mới khởi tạo `DeliveryEventsHandler` thật, xác nhận đúng bốn subscriber khác tên, gọi `onModuleInit()` lại không đăng ký trùng, và `module.close()` hủy subscriber. Test khác xác nhận `DeliveryModule` đăng ký handler đúng một lần. Đây là gate runtime cho handler; chưa thay thế test toàn bộ `DeliveryModule` với database/queue thật.
- Test Auth mới bao phủ thứ tự tạo tài khoản rồi hồ sơ, trường hợp tạo hồ sơ lỗi, và đăng nhập chỉ cấp token cho hồ sơ đã duyệt. Test này phát hiện `AuthService` dùng default import `bcryptjs` không hoạt động ở CommonJS hiện tại; đã đổi sang named import `compare`.
- Đồ thị module hiện tại: `AuthModule → ShipperProfileModule`; `DeliveryModule → AuthModule`; đồng thời `DeliveryModule → IdentityModule → AuthModule` và `DeliveryModule → OrdersModule → AuthModule`. Vì vậy thay import của Auth từ `ShipperProfileModule` sang toàn bộ `DeliveryModule` sẽ tạo vòng. Chỉ bỏ import `AuthModule` trực tiếp trong Delivery **không đủ**. Cần thu hẹp các module guard/query/order được Delivery tiêu thụ trước khi gộp hồ sơ vào module chính; không thêm `forwardRef()`.
- Đăng ký shipper vẫn có khoảng hở: `UsersService.createShipperAccount()` lưu account trước, `ShipperProfileService.createPending()` lưu profile sau; nếu bước hai lỗi thì account đã tạo có thể còn lại. Test hiện xác nhận API không báo thành công, **chưa chứng minh rollback/compensation**. Không xóa account tự động khi chưa có phương án transaction/compensation an toàn.
- Gate chạy lại **sau khi bỏ phần dời `contracts/`**: `npm run build` đạt; Jest scoped Delivery/Auth shipper/public contracts/boundary/provider/queue đạt 26 suite, 99 test; 1 suite/2 test PostgreSQL skip theo cấu hình. E2E tracking đạt 1 suite/4 test. Scoped ESLint cho các file liên quan đạt khi tắt riêng quy tắc Prettier vì nhiều file có CRLF cũ; không gọi lint mặc định là pass. `git diff --check` đạt. Không cộng trùng test hoặc tính PostgreSQL skip là pass.

## 9. Rà soát đóng nhịp 2

| Luồng | Owner và bằng chứng code | Quyết định |
| --- | --- | --- |
| Điều phối | `DeliveryDispatchService` xử lý offer/accept/reject, queue, retry, cleanup/restore; `ActiveShipperTrackerService` giữ trạng thái shipper trong bộ nhớ, timer và quy tắc xếp hạng | Giữ hai service: ghép tracker vào dispatch sẽ làm file đã lớn hơn nữa và trộn lifecycle bộ nhớ với queue/Redis. |
| Dành chuyến | `DeliveryAssignmentSagaService.assign/activate/cancelReservation` ghi `ShippingDetail` trong transaction; event yêu cầu Orders đi qua Outbox | Giữ riêng transaction boundary, không chuyển thành wrapper trong role service. |
| Hoàn tất chuyến | `DeliveryCompletionService.complete` khóa chuyến trong transaction, enqueue `delivery.completed` cùng transaction rồi dispatch sau commit | Giữ riêng để không che thứ tự commit/event. |
| Thu nhập | `DeliveryEarningsService.project` ghi ledger và cập nhật profile trong transaction, kiểm tra `idempotencyKey` | Giữ riêng để bảo toàn chống xử lý event trùng. |
| Báo cáo | `DeliveryReportService` chỉ đọc cho lịch sử/dashboard; không có subscriber hoặc Outbox | Giữ riêng khỏi projection ghi dữ liệu. |
| API shipper | `ShipperDeliveryService` còn kiểm tra chủ chuyến, hủy/từ chối và ghép dữ liệu lịch sử; controller vẫn dùng ba entry point chuyển tiếp | Bỏ sáu method chuyển tiếp sang dispatch không có caller; giữ ba entry point đang phục vụ route để controller không phải inject thêm service chỉ vì giảm dòng code. |

Sau khi bỏ sáu method không dùng, `npm run build` đạt; Jest scoped Delivery/Auth shipper/public contracts/boundary/provider/queue đạt **26 suite, 99 test**, **1 suite/2 test PostgreSQL skip**; E2E tracking **1 suite, 4 test**; scoped ESLint với quy tắc Prettier tắt riêng đạt. Nhịp 2 **đạt có điều kiện** về mục tiêu làm rõ trách nhiệm và không tạo vòng/deep import mới. Chưa xác minh concurrency trên PostgreSQL thật; lint mặc định còn nhiễu CRLF cũ.

Không gọi toàn bộ Delivery là hoàn tất: `DeliveryReportService.getIncomeReport` còn join qua `ShippingDetail.order` để đọc tiền/khối lượng từ Order; `ShipperDeliveryService.cancelOrder` gọi Orders trước rồi lưu Delivery bằng các lần save riêng; đăng ký tài xế còn khoảng hở account/profile. Đây là ba việc dữ liệu/transaction cụ thể cần thiết kế và test riêng, không giải quyết bằng việc ép số file service.

## 10. Kết quả nhịp 3 (2026-09-24)

- **Quyết định module:** giữ `ShipperProfileModule`/`shipper-profile.public-api.ts` hẹp. `AuthModule` import module này; module hồ sơ chỉ import `UsersModule` và `IdentityUserProfileModule`, không import ngược `AuthModule`/`DeliveryModule`. Module Delivery chính vẫn cần Auth/Orders, nên không gộp hai module và không thêm `forwardRef()`.
- **Đăng ký shipper mới:** `ShipperProfileService.registerPending()` mở một `DataSource.transaction()`. Trong cùng transaction, `UsersService.createShipperAccount()` dùng repository User/Role từ manager được truyền vào; `ShipperProfileService.createPending()` dùng repository ShipperProfile từ chính manager đó. Nếu lưu profile lỗi, callback ném lỗi để TypeORM rollback cả account; Auth không trả thành công. Mỗi feature vẫn ghi entity của mình, Auth chỉ gọi public API hẹp.
- **Export thực dùng:** `shipper-profile.module.ts` chỉ export `ShipperProfileService`; `delivery.module.ts` export `CustomerDeliveryService` và `DeliveryDispatchService` (worker đăng ký `FindShipperProcessor` ở `WorkerModule` cần dispatch qua DI). `delivery/public-api.ts` còn `DeliveryModule`, `CustomerDeliveryService`, `FindShipperProcessor`. Không export controller, handler, adapter hoặc các service nội bộ không có consumer ngoài feature.
- **Giới hạn:** test unit xác nhận cùng manager và lỗi profile được đẩy ra ngoài transaction; test PostgreSQL mới được thêm nhưng mặc định skip nếu không có `FOODEE_RUN_POSTGRES_INTEGRATION=1`. Chưa có bằng chứng rollback trên DB thật ở lần chạy này. Các account mồ côi tạo từ phiên bản cũ không tự được sửa/xóa; cần rà dữ liệu và phương án xử lý riêng. Không đổi route, guard, response hoặc schema.
- **Gate thực chạy sau sửa:** `npm run build` exit 0; scoped ESLint trên file nhịp 3 exit 0 khi tắt riêng `prettier/prettier` vì CRLF cũ; Jest Delivery/Auth/Users/public contract/boundary/provider/app composition exit 0 với **28 suite, 110 test đạt**, **2 suite/3 test PostgreSQL skip**; E2E tracking **1 suite, 4 test đạt**. `git diff --check` không có lỗi whitespace, chỉ cảnh báo quy đổi LF/CRLF của Git trên Windows. Đây không phải bằng chứng toàn bộ route admin/shipper hoặc PostgreSQL thật đã pass.
- **Ngoài nhịp 3:** báo cáo thu nhập còn join Order và luồng hủy chuyến còn khoảng hở nhiều lần ghi; không gộp vào thay đổi đăng ký.

## 11. Kết quả nhịp 4 (2026-09-24)

- Đã bổ sung boundary test theo cấu trúc **hai module/hai public API có chủ đích** của Delivery. Test quét source các business feature để chặn import entity Order ngoài Orders và import entity giao hàng/shipper ngoài Delivery; Delivery không được inject repository Order, gán trực tiếp `order.status` hoặc dùng SQL `UPDATE orders`. Registry TypeORM ở infra chỉ khai báo entity. Demo payment có `DummyOrder` trong Map bộ nhớ, không phải Order lưu DB.
- `WorkerModule` và `DeliveryModule` trước đây có thể cùng provide `FindShipperProcessor` khi `QUEUE_PROCESSOR_ENABLED=true`. Worker giờ đọc provider metadata thực tế của DeliveryModule và chỉ provide processor khi còn thiếu; điều này cũng tránh lệch do `.env` được nạp giữa hai lần đánh giá module. Test module metadata xác nhận đúng một đăng ký với cờ mặc định và khi bật cờ `true`; không đổi queue name hay logic xử lý job.
- Đã cập nhật `src/features/delivery/README.md` và `PROJECT_CODEBASE_AUDIT.md` theo code/working tree và kết quả lệnh chạy mới. Không xóa assertion bảo vệ `ShipperProfileModule`/`shipper-profile.public-api.ts`.

| Gate thực chạy sau nhịp 4 | Kết quả |
| --- | --- |
| `npm run build` | Exit 0. |
| `npm run test:unit -- --silent` | 111 suite, 391 test đạt; exit 0. |
| `npm run test:integration -- --silent` | 26 suite, 76 test đạt; 2 suite/3 test PostgreSQL skip; exit 0. |
| `npm run test:e2e -- --silent` | 10 suite, 32 test đạt; exit 0. |
| `QUEUE_PROCESSOR_ENABLED=true` + test `delivery.ownership.spec.ts` | 1 suite, 6 test đạt; exit 0. |
| Scoped ESLint file nhịp 4, tắt riêng `prettier/prettier` | Exit 0. |
| `npm run lint` toàn repository | Exit 1: 15.468 vấn đề, chủ yếu CRLF/Prettier; không gọi pass. |
| Full ESLint với Prettier tắt và `--quiet` | Exit 1: 6 lỗi `unbound-method` ở 2 file test ngoài Delivery. |

Các test PostgreSQL bị skip vì `FOODEE_RUN_POSTGRES_INTEGRATION` không bật; E2E dùng mock và không xác nhận PostgreSQL/Redis/MinIO/Mapbox/payment gateway thật. `DeliveryReportService.getIncomeReport()` vẫn join Order để đọc số liệu; `ShipperDeliveryService.cancelOrder()` còn rủi ro cập nhật dở dang giữa Orders và Delivery. Vì vậy **nhịp 4 đã làm, nhưng Delivery chưa đạt gate production/đóng feature**. Các thay đổi nhịp 0–4 còn ở working tree; Docker, AI, GJobs và các thư mục không liên quan không được sửa/stage.

Ghi chú thời điểm: full unit/integration/E2E ở bảng trên chạy trước chỉnh sửa cuối của `WorkerModule` để đọc provider metadata. Sau chỉnh sửa đó đã chạy lại `npm run build` (exit 0), scoped ESLint (exit 0), ba suite boundary/composition/ownership với 27 test đạt và riêng cờ `QUEUE_PROCESSOR_ENABLED=true` với 6 test đạt. Chưa chạy lại toàn bộ ba tập test sau chỉnh sửa cuối; không suy diễn rằng full suite đã được chạy trên chính xác trạng thái cuối.

## 12. Gom service sau nhịp 4 (2026-09-24)

- Sáu service chính hiện nằm trực tiếp trong `services/`: customer, shipper, admin, dispatch, trip và report. `DeliveryTripService` nhận ba luồng trước đây ở assignment saga, completion và earnings projection. Các method vẫn giữ transaction riêng, Outbox enqueue trong transaction, dispatch sau commit và khóa chống trùng của ledger; không đổi event/route/queue contract.
- Tổng cộng còn tám file service nghiệp vụ trong `services/`: sáu file chính cộng `ActiveShipperTrackerService` (bộ nhớ/timer, điều kiện shipper hoạt động) và `ShipperProfileService` (provider của `ShipperProfileModule` mà Auth dùng). Adapter Redis ở `adapters/` không tính vào tám file này. Không ghép hai service hỗ trợ vào file chính chỉ để đủ đúng sáu file: điều đó có thể tạo vòng phụ thuộc hoặc làm dispatch hơn 800 dòng.
- `DeliveryModule` đăng ký một `DeliveryTripService`; dispatch, shipper API và event handler cùng inject provider đó. Test bảo vệ các luồng assignment, completion, earnings, DI graph, ownership và public contract đã được cập nhật theo đường dẫn mới.

| Gate chạy **sau lần gom** | Kết quả |
| --- | --- |
| `npm run build` | Exit 0. |
| Unit toàn dự án sau dọn tên test và assertion DI | 111 suite, 392 test đạt; exit 0. |
| Integration toàn dự án | 26 suite, 76 test đạt; 2 suite/3 test PostgreSQL skip; exit 0. |
| E2E toàn dự án | 10 suite, 32 test đạt; exit 0. |
| ESLint Delivery/boundary/public contract, tắt riêng `prettier/prettier` | Exit 0. |
| Test boundary/provider graph sau assertion cấu trúc và DI cuối | 2 suite, 21 test đạt; exit 0. |
| `QUEUE_PROCESSOR_ENABLED=true` + ownership/provider graph | 2 suite, 8 test đạt; exit 0. |

Full unit đã chạy lại sau assertion DI và dọn tên file test: 392 test đạt. Integration/E2E ở bảng chạy trước lần đổi tên test, nhưng không có runtime code đổi sau đó; hai suite boundary/provider graph, trường hợp bật queue processor và scoped ESLint cũng đã chạy lại. Các kết quả trên chứng minh refactor cấu trúc không làm hỏng các hành vi đã được test, **không** chứng minh PostgreSQL/Redis thật, mọi route shipper/admin hoặc full lint đã đạt. Rủi ro join Order trong báo cáo thu nhập và cập nhật dở dang khi hủy chuyến vẫn còn. Tại thời điểm ghi kết quả này, các thay đổi chưa được commit/push.

### Dọn file sau khi gom

Các source service cũ của assignment saga, completion và earnings đã không còn trên filesystem; chức năng của chúng ở `services/delivery-trip.service.ts`. Ba service admin/dispatch/report và shipper API cũng đã chuyển lên `services/` và đường dẫn cũ không còn import. Không xóa tám service hiện tại vì đều còn provider/consumer. Năm file unit test mang tên service cũ được **đổi tên**, giữ nội dung kiểm thử: ba test `delivery-trip.*`, `customer-delivery.access.spec.ts` và `delivery-events.handler.spec.ts`. Đã xóa ba thư mục rỗng `services/admin`, `services/integration`, `services/subscription`; không xóa dữ liệu. Unit Delivery sau đổi tên: **21 suite, 70 test đạt**, exit 0.
