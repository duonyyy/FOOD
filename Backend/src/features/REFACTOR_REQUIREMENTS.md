# Yêu cầu chung khi refactor feature — Foodee Backend

> Cập nhật: 2026-09-29. Phạm vi: `src/features/**` và những chỗ phụ thuộc trực tiếp. Đây là tiêu chí để **lập kế hoạch và nghiệm thu từng feature**, không phải xác nhận rằng toàn bộ code hiện tại đã đạt. Đọc `AGENTS.md` và kiểm tra code, test, `git status` trước mỗi đợt làm việc; code đang chạy và kết quả kiểm thử mới nhất là nguồn xác thực hiện trạng.

## 1. Mục tiêu

- Người mới tìm được API của một vai trò trong `controllers/`, rồi tìm được luồng xử lý chính trong `services/` mà không phải đi qua nhiều lớp `reader`, `command`, `facade`, `adapter` chỉ để chuyển tiếp lời gọi.
- Mỗi nghiệp vụ có **một feature sở hữu quyết định và dữ liệu ghi**. Feature khác chỉ dùng bề mặt công khai hẹp; không đi vào file nội bộ, repository hoặc entity của feature sở hữu.
- Không có `forwardRef()` hay vòng phụ thuộc module. Không thêm port/interface chỉ để bọc một service có đúng một implementation. Giữ những abstraction đang thực sự cần cho hạ tầng, kiểm thử hoặc ngăn vòng phụ thuộc; bỏ chúng phải có phương án thay thế và kiểm thử tương ứng.
- Giữ nguyên hành vi HTTP/GraphQL/WebSocket, phân quyền, dữ liệu, transaction và luồng bất đồng bộ, trừ khi task nêu rõ thay đổi sản phẩm. Refactor cấu trúc không được âm thầm đổi nghiệp vụ.
- Làm từng lát nhỏ, kiểm chứng được. Không đặt mục tiêu giảm số file bằng mọi giá, không chuyển sang microservice/monorepo, không viết lại toàn bộ.

## 2. Ảnh chụp code làm căn cứ

Tại commit `9815213`, cộng với working tree ngày 2026-09-29, có 14 feature canonical. Số module/API dưới đây là **hiện trạng**, không phải số bắt buộc phải đạt. Menu, Restaurants, Orders và một số test đang có thay đổi chưa commit; phải đọc `git diff` trước khi sửa các phần đó.

| Feature | Module / public API hiện có | Nhận xét cho lần refactor kế tiếp |
| --- | ---: | --- |
| Analytics | 1 / 1 | Chỉ đọc dữ liệu Orders qua bề mặt hẹp; kiểm tra export controller khỏi API nếu không có consumer. |
| Auth | 1 / 2 | Auth sở hữu xác thực, guard, token; API module hẹp đang phục vụ đồ thị phụ thuộc. |
| Communications | 3 / 1 | Chat và Messenger có module riêng; chỉ gộp sau khi chứng minh đồ thị DI đơn giản hơn và không đổi hành vi. |
| Delivery | 2 / 2 | Module/API Shipper Profile hẹp giúp tránh vòng phụ thuộc với Auth/Users; không ép gộp. |
| Locations | 1 / 1 | Địa chỉ thuộc Locations; không thêm lớp trung gian nếu chỉ chuyển tiếp. |
| Menu | 1 / 1 | Gồm Food, Category, Topping; có nhóm con theo nghiệp vụ và phần controller đang đổi trong working tree. |
| Notifications | 1 / 1 | Thông báo, xử lý thất bại; không nhập nhầm ownership vào Communications. |
| Orders | 1 / 1 | Order và trạng thái Order thuộc Orders; giữ luồng tạo đơn, giao hàng, event/Outbox có trách nhiệm rõ. |
| Payments | 1 / 1 | Checkout, cổng thanh toán và webhook; giữ idempotency và kiểm tra tài liệu feature đã cũ. |
| Promotions | 1 / 1 | Mẫu dễ đọc để tham khảo, không phải khuôn file phải sao chép nguyên xi. |
| Restaurants | 1 / 1 | Hồ sơ, duyệt và dữ liệu nhà hàng; cấu trúc role service đang thay đổi chưa commit. |
| Reviews | 1 / 1 | Sở hữu Review; kiểm tra export controller khỏi API nếu không có consumer. |
| System Constraints | 1 / 1 | Cấu hình ràng buộc hệ thống; không tạo controller/role giả. |
| Users | 3 / 3 | User, Role, Permission thuộc Users; các API/module Identity hẹp giải quyết đồ thị DI, không ép về một module. |

Entity hiện đặt tập trung ở `src/entities/**`. **Không chuyển entity vào feature trong đợt chuẩn hóa này.** Ownership là quyền quyết định/ghi và quyền đăng ký repository, không phải vị trí vật lý của file entity. `OutboxEvent` thuộc hạ tầng sự kiện; không tự gán cho một feature nghiệp vụ.

## 3. Cấu trúc ưu tiên, không phải bộ thư mục bắt buộc

```text
src/features/<feature>/
├── controllers/             # Chia theo actor/use case thực sự: public, customer, merchant, shipper, admin
├── services/                # Service theo role + một số service nghiệp vụ có trách nhiệm rõ
├── dto/                     # Input/output và validation của feature
├── types/                   # Kiểu nội bộ của feature, chỉ khi cần
├── contracts/               # Policy, cache key, event payload nội bộ, chỉ khi cần
├── handlers/                # Chỉ khi có event/queue consumer thật
├── <feature>.module.ts      # Module chính, nếu không có lý do kỹ thuật cho module hẹp khác
├── public-api.ts            # Bề mặt công khai chính, export tối thiểu
└── README.md                # Ownership, routes, dependency và ngoại lệ còn tồn tại
```

Các nhóm con như `menu/foods`, `menu/categories`, `menu/toppings` được giữ khi giúp tìm code nhanh hơn; không bắt buộc dàn phẳng. Không tạo đủ năm controller/service role cho một feature nếu role đó không có API. Không tạo thư mục rỗng. Tên file nói rõ nghiệp vụ: `order-creation.service.ts`, `delivery-trip.service.ts`; tên `reader`/`command`/`adapter` chỉ giữ khi chúng diễn đạt trách nhiệm thật và có consumer rõ. Một service quá lớn có thể tách theo trách nhiệm; nhiều service một-hàm chỉ chuyển tiếp thì nên xem xét gộp. Số file và số dòng không phải tiêu chí nghiệm thu độc lập.

**Một module chính và một public API chính là mặc định, không phải luật ép gộp.** Module/API hẹp chỉ tồn tại khi có consumer cụ thể và đồ thị DI chứng minh cần thiết; ghi lý do trong README và có test bảo vệ. Trường hợp hiện tại cần thận trọng gồm `users`, `auth`, `delivery`, `communications`. Không dùng `forwardRef()` để đổi lấy vẻ ngoài “chỉ một module”.

### 3.1. Trách nhiệm của từng loại file

| Loại file | Nên chứa | Không nên chứa |
| --- | --- | --- |
| `*.controller.ts` / `*.resolver.ts` | Route/schema, guard, lấy actor, gọi use case, mô tả Swagger/GraphQL, chuyển input/output khi cần. | Query repository, đổi trạng thái, tính tiền, quyết định ownership nghiệp vụ. |
| Service theo role | Điều phối use case của actor đó, kiểm tra điều kiện truy cập tài nguyên, gọi service nghiệp vụ/feature khác qua API công khai. | Sao chép cùng một quy tắc vào nhiều role; lớp chỉ gọi tiếp một hàm cùng tên mà không thêm ý nghĩa. |
| Service nghiệp vụ | Một trách nhiệm ổn định như tạo Order, dispatch chuyến giao, tính quy tắc khuyến mãi, xử lý thanh toán. Đây có thể là nơi đặt transaction boundary. | Gộp mọi nghiệp vụ của feature vào một `FeatureService` khổng lồ; tạo mỗi service cho một thao tác CRUD nhỏ. |
| `dto/` | DTO request/response, validation và mapping gắn với API; đặt mapper gần đối tượng được map nếu việc tách file không có ích. | Entity TypeORM hoặc kiểu trung lập dùng bởi nhiều feature. |
| `types/` | Kiểu chỉ dùng trong feature, không biểu diễn hợp đồng lâu dài giữa hai feature. | Bản sao của DTO/entity, kiểu `any` để lách ranh giới. |
| `contracts/` | Policy, cache key, event payload, snapshot công khai hẹp khi có consumer thực. | “Port” một-implementation chỉ chuyển tiếp lời gọi; nơi gom mọi kiểu của cả hệ thống. |
| `handlers/` | Consumer của event/queue, retry và idempotency ở điểm nhận; gọi service owner để đổi trạng thái. | Nghiệp vụ chính không thể kiểm thử nếu bỏ hạ tầng event/queue. |
| `*.module.ts` | Controllers, providers, imports/exports cần cho DI; `TypeOrmModule.forFeature` chỉ cho entity thuộc owner. | Provide lại service của feature khác; nhập module rộng gây vòng phụ thuộc. |
| `public-api.ts` | Export tối thiểu module/service/DTO/snapshot mà consumer ngoài feature thực sự dùng. | Export tất cả file nội bộ hoặc vô tình phơi controller/repository/entity. |

“Theo role” là cách tìm API, **không phải cách chia domain**. Ví dụ `customer-orders.service.ts` và `merchant-orders.service.ts` có thể cùng gọi `order-rules.service.ts`, nhưng Orders vẫn là một owner của `Order`. Public endpoint không có actor đăng nhập thì đặt `public-*`; không tạo `shipper-*` ở feature không có luồng shipper. Nếu một file đang phục vụ nhiều vai trò, chỉ tách khi quyền truy cập, workflow hoặc mức thay đổi của các vai trò thực sự khác nhau.

### 3.2. Quyết định tách/gộp service và module

Trước khi thêm hoặc xóa một service, trả lời bốn câu hỏi: (1) nó sở hữu quy tắc hay chỉ chuyển tiếp? (2) có nhiều hơn một consumer/use case thật không? (3) nếu gộp, transaction/authorization có khó nhìn hơn không? (4) nếu tách, người mới có tìm đúng entrypoint nhanh hơn không? Gộp lớp chuyển tiếp rỗng; giữ lớp có boundary giao dịch, side effect, retry, rule dùng lại, hoặc tránh cycle. Không dùng ngưỡng số dòng hay số file làm mệnh lệnh tự động.

Trước khi gộp module hoặc public API hẹp, ghi đường phụ thuộc `A → B → C`, provider cần export và consumer cụ thể. Nếu gộp tạo `A → B → A`, cần giữ module/API hẹp hoặc thiết kế lại chiều phụ thuộc; **không dùng `forwardRef()`**. Ví dụ hiện tại có `ShipperProfileModule`/`shipper-profile.public-api.ts` trong Delivery và các module Identity hẹp trong Users. `CommunicationsModule` cũng đang bao gồm Chat/Messenger; chưa có bằng chứng rằng ép ba module thành một sẽ tốt hơn.

## 4. Ranh giới và ownership bắt buộc

1. Cross-feature import chỉ qua `public-api.ts` của feature sở hữu hoặc `*.public-api.ts` hẹp đã được giải thích. Cấm deep-import vào `controllers/`, `services/`, `entities/`, repository, module nội bộ hoặc barrel không được công bố của feature khác. Public API phải export đúng thứ consumer cần, không `export *` cả feature.
2. Feature không inject repository/entity của feature khác để đọc hoặc ghi tắt. Truyền ID hoặc snapshot/DTO hẹp. Nhu cầu đọc nhiều dữ liệu nên có phương thức đọc công khai rõ nghĩa; nhu cầu đổi trạng thái phải đi qua feature sở hữu. Không tạo hai chiều import service để “tiện”.
3. `orders` là nơi duy nhất quyết định và ghi trạng thái `Order`; `delivery` quyết định chuyến giao/shipper/trạng thái giao; `analytics` và `reviews` chỉ dùng dữ liệu Orders qua API đọc hẹp. `auth` sở hữu xác thực và guard; `users` sở hữu User/Role/Permission. `restaurants` sở hữu Restaurant; `menu` sở hữu Food/Category/Topping, dù một route tổng hợp có thể nằm ở nơi khác vì tương thích API. `notifications` sở hữu Notification; `communications` sở hữu Conversation/Message.
4. `src/infra/**` không import ngược từ `src/features/**`. Feature dùng API/contract công khai của hạ tầng, không import file triển khai nội bộ. Không chuyển kiểu chỉ của một feature sang `src/shared/**`; `shared` dành cho kiểu/tiện ích trung lập, thực sự được nhiều miền dùng mà không mang quyết định nghiệp vụ.
5. Không có `forwardRef()`, provider đăng ký trùng ở nhiều owner, hoặc dependency cycle bị che bằng barrel. Nếu xuất hiện vòng: vẽ đường đi, chọn một chiều sở hữu; dùng API đọc hẹp hoặc event/Outbox khi phù hợp, không thêm port hình thức.
6. `contracts/` của feature không mặc định chứa port. Nó chỉ chứa hợp đồng/policy có lý do tồn tại: payload sự kiện, cache key, quy tắc nội bộ hoặc contract công khai cần ổn định. Không chuyển hàng loạt contract sang `src/shared` chỉ để làm cây thư mục gọn hơn.

### 4.1. Mẫu phụ thuộc được chấp nhận và bị cấm

```text
Được:    Delivery service → Orders/public-api → Orders service sở hữu Order
Được:    Reviews service → Orders/public-api → snapshot/thông tin cần để đánh giá
Được:    Feature → Infra/public-api → queue/cache/map/storage service
Không:   Delivery service → Orders/services/... hoặc Orders/entities/...
Không:   Infra/queue → Features/delivery/...
Không:   OrdersModule ↔ DeliveryModule rồi thêm forwardRef()
Không:   Feature A provide lại service của Feature B trong module của A
```

Khi cần đọc liên feature, phương thức công khai phải nói rõ thông tin được phép xem; tránh trả nguyên entity rồi để consumer tự quyết định. Khi cần ghi liên feature, owner cung cấp thao tác có kiểm tra trạng thái/quyền, hoặc xử lý sự kiện bền vững nếu không cần đồng bộ. Sự tồn tại của một `public-api.ts` không chứng minh boundary đã đúng: phải xem nó export gì, ai import và ai nắm repository.

### 4.2. Khi nào dùng `src/shared`, `src/infra`, `contracts`

- Đặt trong **feature** nếu kiểu, policy hoặc cache key mang ngôn ngữ nghiệp vụ của một owner, kể cả khi feature khác tiêu thụ nó qua public API.
- Đặt trong **`src/shared`** khi khái niệm trung lập, không phụ thuộc feature/hạ tầng và có từ hai consumer độc lập thật sự. Không chuyển entity, DTO riêng của một API, hoặc business rule vào đây để tránh import công khai.
- Đặt trong **`src/infra`** nếu đó là triển khai cơ chế queue, cache, storage, map, email, event bus/outbox. Infra không quyết định trạng thái Order/Delivery/Payment. Feature gọi qua entrypoint công khai; cấu hình queue hoặc event payload thuộc owner phải được tách khỏi implementation hạ tầng.
- Giữ một **port/token cũ** nếu nó đang đại diện nhiều implementation, tài nguyên hạ tầng, hoặc là điểm nối DI cần thiết. Muốn bỏ phải liệt kê token → provider → tất cả consumer, đổi từng consumer, rồi mới xóa alias và test. “Không tạo port mới vô ích” không có nghĩa “xóa toàn bộ port đang tồn tại”.

## 5. Hành vi phải bảo toàn

- Giữ route, method, request/response DTO, validation, Swagger, mã lỗi, GraphQL và WebSocket contract hiện có; thay đổi có chủ đích phải ghi rõ trong task và test.
- Auth guard, role, ownership/BOLA và cách lấy actor phải còn đúng. Không tin ID chủ thể từ client cho thao tác nhạy cảm.
- Các thao tác nhiều bảng phải giữ transaction boundary; webhook, hàng đợi, mã khuyến mãi và nhận chuyến giao phải giữ idempotency/concurrency guard. Không làm mất migration hoặc thay schema trong một refactor cấu trúc thuần túy.
- Phân biệt event trong process với luồng cần bền vững. Không bỏ Outbox/retry chỉ vì chuyển service hoặc handler sang folder khác. Kiểm tra event payload, consumer, queue/cache key và thời điểm phát sự kiện.
- Xóa file cũ **sau khi** xác nhận không còn import, provider, route, job hoặc test dùng nó. Không giữ facade rỗng chỉ để tránh sửa consumer.

## 6. Quy trình cho từng feature

1. **Chụp hiện trạng:** `git status`, `git log`, đọc `AGENTS.md`, README, module, public API, controller/service/entity, test. Lập bảng consumer → API → owner, tuyến gọi ghi dữ liệu, và dependency graph. Phân biệt code đã commit với working tree của người khác.
2. **Chốt lát cắt nhỏ:** chọn một actor/luồng hoặc một lớp trung gian dư thừa. Ghi file dự kiến đổi, route/contract giữ nguyên, module/API hẹp cần giữ, và các file tuyệt đối ngoài phạm vi.
3. **Đổi cấu trúc:** chuyển trách nhiệm theo owner và role thật; giữ DI một chiều. Chỉ sửa consumer liên quan thông qua public API. Không mở rộng sang feature khác vì thấy “tiện tay”.
4. **Kiểm thử và đối chiếu:** chạy build, lint phần ảnh hưởng, unit/integration/boundary liên quan, E2E cho route đã chạm. Kiểm tra thủ công import graph và `forwardRef`. Nếu test bỏ qua vì thiếu PostgreSQL/Redis hoặc lỗi Windows/dependency, ghi `SKIPPED`/`BLOCKED`; không gọi là pass.
5. **Dọn và ghi nhận:** xóa lớp/file không còn dùng trong đúng phạm vi, cập nhật README và boundary test theo **kiến trúc mới đã được triển khai**. Không sửa hoặc nới test chỉ để có màu xanh. Báo cáo file đổi, hành vi giữ/đổi, lệnh thực chạy với kết quả, rủi ro còn lại. Commit/push chỉ khi được yêu cầu riêng.

Lệnh chuẩn phải lấy từ `package.json` hiện tại: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`. Để chạy một test cụ thể, dùng Jest với đường dẫn test phù hợp. **Không có script `test:boundary` hiện tại**; boundary được kiểm trong lint và các spec integration liên quan. Với lint toàn repo đang có nợ format/CRLF, báo riêng kết quả lint phạm vi sửa và kết quả toàn repo; không suy ra toàn repo pass từ lint phạm vi.

## 7. Điều kiện nghiệm thu

- [ ] Owner của từng thao tác đọc/ghi và dependency graph được ghi rõ; không còn cross-feature deep import, foreign repository/entity hoặc `forwardRef()` trong phần vừa sửa.
- [ ] Tên controller/service theo role hoặc trách nhiệm thực, số lớp trung gian giảm khi an toàn; không tạo module, API, port hoặc folder chỉ để đạt hình thức.
- [ ] Module/API hẹp còn lại có consumer và lý do tránh cycle/giữ DI; public export tối thiểu; provider không bị đăng ký trùng.
- [ ] Route, DTO, response, authorization, transaction, event/Outbox và idempotency được đối chiếu bằng test phù hợp.
- [ ] Build, lint, unit/integration/boundary và E2E liên quan có **bằng chứng lệnh chạy thực tế**; phần không chạy hoặc skip được nêu rõ.
- [ ] README/test phản ánh code sau đổi; các thay đổi không liên quan của người dùng được giữ nguyên.

## 8. Nợ tài liệu cần xử lý riêng

`AGENTS.md` hiện còn mô tả entity nằm trong feature và coi port là lối giải mặc định; điều này không khớp `src/entities/**` hiện tại và quyết định không tạo thêm port hình thức. Một số README feature cũng còn mô tả cấu trúc/ownership cũ; `src/features/README.md` diễn đạt “một module/API” quá tuyệt đối và có ví dụ lệnh test không tồn tại. **File này không tự thay thế thứ tự ưu tiên trong `AGENTS.md`**. Trước khi triển khai một task có xung đột, áp dụng yêu cầu cụ thể đã được người dùng thống nhất, đối chiếu source/test, rồi cập nhật tài liệu cấp trên trong một thay đổi riêng để tránh hai bộ quy chuẩn cùng tồn tại.

## 9. Yêu cầu cụ thể khi đến từng feature

Đây là **điểm phải kiểm tra**, không phải lệnh refactor đồng loạt. Đọc lại code và test ngay trước khi làm vì working tree/commit có thể thay đổi.

| Feature | Owner và luồng cần giữ | Điểm cần chứng minh nếu đổi cấu trúc |
| --- | --- | --- |
| `analytics` | Read model/dashboard và projection của riêng Analytics; đọc Orders qua API của Orders. | Projection/reconciliation không ghi ngược Order; số liệu, thời điểm cập nhật và đường xử lý event không đổi. Kiểm tra consumer trước khi thu hẹp public export. |
| `auth` | JWT, đăng nhập, OTP, reset mật khẩu, social auth, guard. | Không đẩy guard sang Users; giữ DI từ Auth tới các API Identity/Shipper Profile hẹp, security contract và token behavior. `auth-module.public-api.ts` không được xóa chỉ để đủ một API. |
| `communications` | Conversation/Message, Messenger và Chat. | Messenger chỉ lưu entity của mình; Chat đọc Orders/Menu/Restaurants qua public API; GraphQL/WebSocket guard và subscription ownership không đổi. Ba module hiện có phải được đánh giá theo provider/consumer, không ép gộp. |
| `delivery` | ShippingDetail, chuyến giao, shipper, điều phối, báo cáo và event giao hàng. | Giữ sáu service chính hiện có và support service nếu trách nhiệm thật; `ShipperProfileModule` hẹp, legacy route, queue/pending assignment, claim/complete idempotency. Delivery chỉ gọi Orders API để đổi Order, không dùng repository Order. |
| `locations` | Address và quyền sở hữu địa chỉ của người dùng. | Không để Users/Orders thao tác repository Address; giữ geocoding/cache và kiểm tra actor trước truy cập địa chỉ. Không thêm proxy chỉ chuyển tiếp. |
| `menu` | Food, Category, Topping; trạng thái hiển thị món, giá server-side và lựa chọn topping. | Giữ Category/Food consumer contracts, cache invalidation, ảnh/storage cleanup, điều kiện quán được duyệt. Nhóm con `foods/categories/toppings` được giữ nếu giúp đọc; public Restaurant discovery controller trong Menu là composition/route compatibility, không biến Menu thành owner của Restaurant. |
| `notifications` | Notification, dead-letter và kênh gửi; nhận event phù hợp. | Không chuyển Notification sang Communications; giữ retry, lỗi gửi, quyền xem thông báo và ranh giới Orders runtime. |
| `orders` | Order/OrderDetail, tạo đơn, tính tiền, state machine, phân quyền khách/quán/admin, event/Outbox. | Orders là writer duy nhất của `Order.status`; giữ route/resolver, snapshot cho Delivery/Analytics/Reviews/Chat, transaction tạo đơn, giá server-side và event bền vững. Không đẩy toàn bộ tích hợp vào một service hay tạo adapter rỗng. |
| `payments` | Checkout, gateway, callback/webhook, reconciliation. | Kiểm tra chữ ký, idempotency, thứ tự cập nhật Checkout/Order và đường retry; không bỏ gateway abstraction nhiều implementation vì mục tiêu “bỏ port”. Tách demo route khỏi hành vi thật khi lập phạm vi. |
| `promotions` | Promotion, PromotionRedemption, quy tắc áp mã và lượt dùng. | Giữ kiểm tra điều kiện, giới hạn lượt dùng, cache key/TTL, transaction và tên dễ hiểu. Dùng làm tham khảo cách đặt role service, không nhân bản cứng cấu trúc sang mọi feature. |
| `restaurants` | Restaurant, RestaurantApprovalAudit, hồ sơ và duyệt quán. | Giữ quyền merchant/admin, upload/response mapping, trạng thái duyệt và route public đang được compose từ Menu. Cần kiểm tra transaction hồ sơ/Address và `MenuModule → RestaurantsModule` một chiều; working tree đang có refactor dở, không ghi đè. |
| `reviews` | Review và điều kiện đánh giá. | Xác minh đơn/món/chuyến giao qua API công khai của owner; không import Order repository/entity. Giữ quyền người đánh giá và điều kiện được review. |
| `system-constraints` | Giá trị ràng buộc/cấu hình hệ thống. | Module/service thật vẫn cần được đăng ký; không tạo controller hoặc service theo role khi không có API đó. |
| `users` | User, Role, Permission, hồ sơ và query theo quyền. | Giữ Auth là owner guard/JWT; không nhập IdentityUserProfile/Users/Identity module nếu tạo cycle với Auth/Delivery. Kiểm tra admin/current-user query, role/permission và provider registration. |

Nếu bảng trên và source bất đồng, ghi **bất đồng + bằng chứng file/test** trước khi sửa; không lấy bảng này làm lý do bỏ một luồng hiện hữu.

## 10. Cách khảo sát trước khi mở một nhịp refactor

Với mỗi feature được chọn, tạo một bảng ngắn trong kế hoạch/PR/báo cáo (không nhất thiết tạo file riêng):

| Thông tin | Câu hỏi phải trả lời |
| --- | --- |
| Phạm vi | Feature nào, role/use case nào, file nào được đổi? File nào cấm đụng? |
| Owner | Ai sở hữu entity, repository, trạng thái và transaction? Ai chỉ đọc snapshot? |
| Bề mặt API | Route/GraphQL/WebSocket nào đang phục vụ client? Public API nào có consumer bên ngoài? |
| Đồ thị DI | Module A import B vì provider nào? B có import ngược A không? Module/API hẹp nào đang ngắt vòng? |
| Phụ thuộc hạ tầng | Queue/cache/map/storage/gateway/event được gọi qua entrypoint nào? Ai sở hữu key/payload? |
| Dữ liệu và side effect | Những bảng nào được ghi, lúc nào phát event, retry/idempotency ở đâu? |
| Bằng chứng baseline | Build/lint/test nào đã chạy **trước** khi sửa và kết quả thật ra sao? Test nào bị skip vì môi trường? |
| Kết quả mong muốn | File sẽ còn/xóa/chuyển, consumer sẽ gọi chỗ nào, hành vi nào giữ nguyên, test nào chứng minh? |

Ví dụ với một luồng Delivery → Orders: tìm import của Delivery, điểm nó cần đọc/đổi Order, phương thức Orders public API tương ứng, provider Orders export, rồi vẽ chiều `DeliveryModule → OrdersModule`. Nếu một đề xuất khiến Orders import ngược Delivery, dừng và thiết kế lại. Với refactor thuần cấu trúc, không tự đổi trạng thái Order hoặc payload event để “dễ tách” hơn.

## 11. Ma trận kiểm thử tối thiểu theo loại thay đổi

| Thay đổi | Kiểm tra bắt buộc ngoài build/lint phần ảnh hưởng |
| --- | --- |
| Đổi import, public API, module/provider | `test/integration/architecture-boundaries.spec.ts`, `test/integration/feature-ownership-boundaries.spec.ts`, `test/unit/features/public-contracts.spec.ts`; chạy test DI liên quan. |
| Đổi controller/resolver/DTO | Unit service và E2E route bị chạm; kiểm tra guard, role, ownership, status code, body/response, route cũ và Swagger/schema khi có. |
| Đổi repository/service ghi dữ liệu | Unit rule + integration giao dịch/migration liên quan; kiểm tra ghi nhiều bảng, rollback, concurrent request và idempotency. Mock-only test không thay thế kiểm chứng DB thật. |
| Đổi event/handler/queue/cache | Unit producer/consumer, integration outbox/queue/cache boundary; kiểm tra payload, publish sau commit, retry, dead-letter, key/TTL và xử lý trùng. |
| Đổi Auth/Users hoặc resource cá nhân | Security/E2E policy cho actor hợp lệ, sai role, truy cập tài nguyên người khác, thiếu token; GraphQL/WebSocket nếu liên quan. |
| Đổi Menu/Restaurants/Orders/Delivery/Payments | Chạy thêm regression xuyên feature tương ứng, không chỉ test của feature đang sửa; kiểm tra giao diện public, giá và trạng thái. |

Ví dụ lệnh chọn lọc (chỉ là lệnh dự kiến; kết quả phải báo theo lần chạy thật):

```powershell
npm run build
npx eslint src/features/<feature> test/unit/features/<feature> test/integration/architecture-boundaries.spec.ts
npm test -- --runTestsByPath test/integration/architecture-boundaries.spec.ts test/integration/feature-ownership-boundaries.spec.ts test/unit/features/public-contracts.spec.ts
npm run test:unit
npm run test:integration
npm run test:e2e
```

Không chạy lệnh có `<feature>` nguyên văn: thay bằng đường dẫn thật. E2E có config riêng; chọn một E2E cụ thể bằng Jest kèm `--config ./test/jest-e2e.json`. Nếu lệnh lint toàn repo lỗi vì nợ format/CRLF, vẫn phải chứng minh file vừa sửa không tạo lỗi boundary mới và ghi rõ baseline. Nếu Windows chặn Jest cache hoặc PostgreSQL không sẵn, phân biệt lỗi môi trường với assertion fail; không ghi `PASS` cho test bị skip/chưa chạy.

## 12. Mẫu báo cáo sau mỗi nhịp và điều kiện dừng

```text
Feature / nhịp:
Owner và dependency trước → sau:
File đã sửa / đã xóa / mới thêm:
Route, DTO, quyền, giao dịch, event được giữ hoặc thay đổi có chủ đích:
Ngoại lệ module/API hẹp còn lại và lý do:
Lệnh kiểm thử thật → PASS / FAIL / SKIPPED / BLOCKED (kèm lỗi chính):
Thay đổi chưa commit của người dùng đã bảo toàn:
Rủi ro còn lại và bước nhỏ nhất kế tiếp:
```

**Dừng nhịp và báo người dùng** nếu cần đổi contract sản phẩm, đổi ownership, đổi schema/transaction chưa thống nhất, phải xóa module/API hẹp để đạt số lượng file, hoặc không thể tránh `forwardRef`/deep-import với thiết kế đề xuất. Build xanh không phải bằng chứng đủ để vượt qua các điểm dừng này.
