# Kế hoạch làm gọn feature Delivery

Ngày lập: 2026-09-24
Trạng thái: nhịp 0–1 đã triển khai; nhịp 2–4 chưa triển khai

## 1. Mục tiêu đã thống nhất

Delivery có một `delivery.module.ts`, một `public-api.ts`, controller theo vai trò và đúng sáu service nghiệp vụ cùng một event handler:

```text
src/features/delivery/
├── controllers/
│   ├── customer-delivery.controller.ts
│   ├── shipper-delivery.controller.ts
│   ├── admin-delivery.controller.ts
│   └── shipper-delivery.resolver.ts
├── services/
│   ├── customer-delivery.service.ts
│   ├── shipper-delivery.service.ts
│   ├── admin-delivery.service.ts
│   ├── delivery-dispatch.service.ts
│   ├── delivery-trip.service.ts
│   └── delivery-report.service.ts
├── handlers/
│   └── delivery-events.handler.ts
├── adapters/              # Redis pending assignment store
├── queue/                 # Worker và tên queue, không tính là service nghiệp vụ
├── dto/
├── types/
├── delivery.module.ts
├── public-api.ts
└── README.md
```

Không thêm một `DeliveryService` chỉ để chuyển tiếp lời gọi. Không tạo `forwardRef()`, deep import chéo feature hoặc port nghiệp vụ mới. Entity tiếp tục nằm ở `src/entities` theo quyết định hiện tại. Giữ nguyên HTTP/GraphQL route, quyền truy cập, response, queue name, khóa Redis và event contract trừ khi có thay đổi hành vi được duyệt riêng.

## 2. Hiện trạng đã đối chiếu với code

| Điểm hiện tại | Bằng chứng | Hệ quả khi triển khai |
| --- | --- | --- |
| Hai module và hai public API | `delivery.module.ts`, `shipper-profile.module.ts`, `public-api.ts`, `shipper-profile.public-api.ts` | Phải xử lý hướng phụ thuộc Auth trước khi gộp module. |
| 14 file `*.service.ts` gồm cả adapter Redis | `src/features/delivery/services/**`, `adapters/redis-pending-assignment-store.service.ts` | Đếm sáu service **nghiệp vụ**; adapter Redis là hạ tầng của Delivery, không phải service theo vai trò. |
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

## 3. Trách nhiệm của sáu service và handler

| File đích | Trách nhiệm | Nguồn dự kiến |
| --- | --- | --- |
| `customer-delivery.service.ts` | Báo giá, tracking và kiểm tra quyền xem vị trí shipper | `DeliveryIntegrationService`, `DeliverySubscriptionAccessService` |
| `shipper-delivery.service.ts` | API shipper, hồ sơ, GPS, kiểm tra quyền của shipper | `ShipperDeliveryService`, `ShipperProfileService`; phần chuyến giao chuyển sang `DeliveryTripService` |
| `admin-delivery.service.ts` | Duyệt/từ chối hồ sơ, tra cứu shipper và tổng quan điều phối | `AdminDeliveryService` |
| `delivery-dispatch.service.ts` | Tìm shipper, giữ cuốc, offer/accept/reject/reassign, retry, cleanup và queue | `DeliveryDispatchService`, phần cần thiết của `ActiveShipperTrackerService` và `DeliveryAssignmentCommandService` |
| `delivery-trip.service.ts` | Dành chuyến, bắt đầu/hoàn tất/hủy chuyến, transaction, Outbox và ghi ledger thu nhập theo event | `DeliveryAssignmentSagaService`, `DeliveryCompletionService`, phần ghi/projection của `DeliveryEarningsService` |
| `delivery-report.service.ts` | Lịch sử, dashboard, thống kê và báo cáo thu nhập | `DeliveryReportService`, phần đọc báo cáo của `DeliveryEarningsService` nếu cần |
| `delivery-events.handler.ts` | Đăng ký/hủy đăng ký các subscriber; chuyển event Orders/Delivery tới đúng service | `OrderStatusDeliveryHandler` và subscriber trong saga/earnings |

Các hàm thuần nhỏ để tính toán có thể nằm trong file nội bộ cùng nhóm nghiệp vụ; chúng không cần một Nest provider mới. Bảng trên là đích trách nhiệm, **không phải lệnh ghép nguyên văn các file**: trước khi chuyển từng method phải kiểm tra transaction, lock, event và kích thước file. Nếu sáu service tạo file quá lớn hoặc vòng DI mới, dừng nhịp đó và sửa cách phân chia trách nhiệm trước khi xóa nguồn.

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

### Nhịp 2 — Gom service theo trách nhiệm

- Chuyển tracking/quote/subscription access vào customer service; bảo đảm kiểm tra ownership trước khi trả tracking hoặc vị trí.
- Chuyển hồ sơ/GPS vào shipper service; chuyển thao tác chuyến giao vào trip service.
- Chuyển active shipper matching vào dispatch; giữ lifecycle timer/cleanup và điều kiện shipper khả dụng.
- Chuyển command types nội bộ từ `contracts/` sang `types/`; đặt quy tắc dispatch gần service. Chỉ xóa `contracts/` khi không còn consumer của hai file hiện tại.
- Chuyển earnings projection có khóa chống trùng vào trip service; report service đọc báo cáo. Chuyển subscriber sang một handler, chỉ đăng ký **một lần** cho mỗi event.
- Giữ Redis store là adapter, `FindShipperProcessor` là queue worker. Không chuyển chúng thành role service để đủ số lượng file.

**Đầu ra:** đúng sáu service nghiệp vụ và một event handler. **Qua nhịp:** transaction/Outbox, earnings idempotency, cleanup/restore và subscription đều có test đạt.

### Nhịp 3 — Một module, một public API

- Giải quyết luồng Auth đang dùng `ShipperProfileService` cho đăng ký, kiểm tra trạng thái và đăng nhập shipper. Xác định hướng gọi một chiều cùng transaction/compensation khi tạo user thành công nhưng hồ sơ thất bại.
- Chỉ sau khi không còn `AuthModule → DeliveryModule → AuthModule`, đăng ký provider hồ sơ tại `DeliveryModule`, cập nhật Auth consumer qua `delivery/public-api.ts` hoặc chuyển điểm điều phối phù hợp và xóa module/API hồ sơ riêng.
- Thu hẹp `public-api.ts` theo consumer thực tế. Không export controller, worker, adapter, handler hay service nội bộ chỉ vì có sẵn.
- Gộp route admin legacy vào controller admin nếu không đổi đường dẫn, guard và permission; giữ route tương thích. Đổi tên resolver khi test GraphQL xác nhận schema không đổi.

**Đầu ra:** một module, một public API, route và auth contract như cũ. **Qua nhịp:** không có import vòng, `forwardRef()` hoặc deep import; DI runtime khởi tạo thành công.

### Nhịp 4 — Khóa chất lượng và cập nhật tài liệu

- Cập nhật boundary test cho cấu trúc mới; bỏ assertion đang bảo vệ module/API cũ sau khi migration hoàn tất.
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
- Scan: đúng một `*.module.ts` và một `*public-api.ts` trong Delivery; sáu service nghiệp vụ đúng tên; không `forwardRef`, không cross-feature deep import, không Delivery repository `Order` hoặc ghi `Order.status`.

Không tuyên bố pass dựa trên tên test hay báo cáo cũ; lưu lệnh, exit code và số suite/test của lần chạy thực tế.

## 6. Phạm vi và điểm cần quyết định khi triển khai

- Chỉ sửa Delivery và consumer trực tiếp cần thiết ở Auth, Users, Orders cùng test/tài liệu liên quan. Không đụng file Docker, AI, GJobs hoặc thay đổi chưa commit của người dùng.
- Không thay đổi schema hay migration chỉ để làm gọn cây thư mục.
- Không bỏ Outbox/idempotency/lock để giảm file. Chỗ gộp có rủi ro cao nhất là dispatch ↔ trip và Auth ↔ hồ sơ shipper; hoàn thành từng nhịp rồi mới tiếp tục.
- Sáu service là cấu trúc đã chốt; nếu kiểm tra thực tế cho thấy một service trở thành điểm nghẽn rõ ràng, ghi bằng chứng và cập nhật kế hoạch trước khi thêm provider mới.

**Bước triển khai đầu tiên:** chạy baseline nhịp 0, sau đó gỡ vòng DI ở nhịp 1. Không gộp hai module trước bước đó.

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

Sau nhịp 1, `delivery-dispatch.service.ts` dài khoảng 699 dòng. Việc giảm kích thước file và đi tới sáu service thuộc nhịp 2; không gộp tiếp vào nhịp này. Delivery vẫn có hai module và hai public API vì Auth đang dùng profile module/API hẹp. Các file chưa commit ngoài phạm vi vẫn nguyên trạng. Không commit hoặc push trong nhịp 0–1 này.
