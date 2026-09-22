# Chuẩn cấu trúc Feature của Foodee Backend

Tài liệu này là quy ước chung cho toàn bộ `src/features/**`.

Mục tiêu là giữ modular monolith dễ đọc: mỗi feature có một module chính, một public API, controller và service chia theo vai trò thực tế. Không tạo thêm module, public API, port hoặc adapter chỉ để bọc một service.

## 1. Cấu trúc chuẩn

Đây là cấu trúc tối đa, không phải danh sách file bắt buộc. Feature chỉ tạo file cho những vai trò và nghiệp vụ thật sự tồn tại.

```text
src/features/<feature>/
├── controllers/
│   ├── public-<feature>.controller.ts
│   ├── customer-<feature>.controller.ts
│   ├── merchant-<feature>.controller.ts
│   ├── shipper-<feature>.controller.ts
│   └── admin-<feature>.controller.ts
├── services/
│   ├── public-<feature>.service.ts
│   ├── customer-<feature>.service.ts
│   ├── merchant-<feature>.service.ts
│   ├── shipper-<feature>.service.ts
│   └── admin-<feature>.service.ts
├── dto/
├── types/
├── contracts/
├── <feature>.module.ts
├── public-api.ts
└── README.md
```

Ví dụ: nếu `promotions` không có nghiệp vụ dành cho shipper thì không tạo `shipper-promotions.controller.ts` và `shipper-promotions.service.ts` rỗng.

## 2. Quy tắc đặt tên theo vai trò

| Vai trò | Dùng khi | Ví dụ |
| --- | --- | --- |
| `public` | Không cần đăng nhập | xem menu, xem khuyến mãi công khai |
| `customer` | Khách hàng đã đăng nhập | tạo đơn, áp mã, đánh giá |
| `merchant` | Chủ hoặc nhân viên nhà hàng | xác nhận đơn, cập nhật menu |
| `shipper` | Người giao hàng | nhận chuyến, cập nhật trạng thái giao |
| `admin` | Quản trị hệ thống | khóa tài khoản, duyệt nội dung |
| `system` | Job, event handler, webhook hoặc tác vụ nội bộ | đồng bộ projection, hết hạn dữ liệu |

Không ép mọi feature phải có đủ năm vai trò. Tên file phải phản ánh người thực hiện use case, không phản ánh tên bảng dữ liệu.

## 3. Trách nhiệm của từng nhóm file

### `controllers/`

Controller chỉ xử lý HTTP:

- khai báo route, status code và Swagger;
- áp dụng guard, decorator và validation;
- lấy dữ liệu từ request;
- gọi đúng service theo vai trò;
- trả response.

Controller không chứa luật nghiệp vụ, không truy cập repository, không tự quyết định trạng thái domain và không import entity hoặc service nội bộ của feature khác.

```ts
@Controller('customer/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class CustomerOrdersController {
  constructor(
    private readonly customerOrdersService: CustomerOrdersService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.customerOrdersService.create(user.id, dto);
  }
}
```

### `services/`

Service tổ chức use case của một vai trò. Service được phép dùng repository hoặc entity do chính feature đó sở hữu.

```ts
@Injectable()
export class CustomerOrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
  ) {}

  create(customerId: number, dto: CreateOrderDto) {
    // Điều phối use case và áp dụng luật của Orders.
  }
}
```

Quy tắc chia service:

- chia theo vai trò trước: `customer`, `merchant`, `shipper`, `admin`;
- chỉ tách service nghiệp vụ dùng chung khi có trách nhiệm rõ, ví dụ `order-pricing.service.ts` hoặc `promotion-usage.service.ts`;
- không tạo một service cho từng method;
- không tạo facade chỉ chuyển tiếp nguyên xi sang service khác;
- một luật nghiệp vụ chỉ có một nơi quyết định;
- service không dùng trực tiếp repository hoặc entity của feature khác.

Nếu một service vượt khoảng 400 dòng hoặc chứa nhiều nhóm use case độc lập, cần xem lại cách tách. Đây là tín hiệu review, không phải giới hạn cứng.

### `dto/`

`dto/` chứa dữ liệu đi qua biên HTTP hoặc message:

- request DTO có decorator validation;
- query DTO;
- response DTO khi cần ổn định contract;
- không trả entity trực tiếp làm public contract;
- DTO riêng của feature không chuyển sang `src/shared`.

Tên gợi ý:

```text
create-order.dto.ts
update-order-status.dto.ts
list-orders-query.dto.ts
order-response.dto.ts
```

### `types/`

`types/` chứa type và interface thuần, chỉ dùng trong feature hoặc được public API xuất có chọn lọc:

```text
order-summary.type.ts
promotion-validation-result.type.ts
delivery-location.type.ts
```

Chỉ chuyển một type sang `src/shared/types/` khi nó thật sự trung lập và có cùng ý nghĩa ở ít nhất hai feature độc lập. Không chuyển type sang shared chỉ để né boundary.

### `contracts/`

`contracts/` thuộc về feature và mặc định là nội bộ. Không chuyển cả thư mục này sang `src/shared`.

Nơi này phù hợp cho:

- cache key và TTL của feature;
- event payload do feature phát ra;
- hằng số hoặc pure policy nội bộ;
- cấu trúc dữ liệu trao đổi giữa các service trong cùng feature;
- tên queue hoặc metadata nghiệp vụ do feature sở hữu.

Ví dụ:

```text
contracts/
├── order-events.ts
├── order-cache.ts
└── order-transition-policy.ts
```

Không đặt vào `contracts/`:

- controller, service, module;
- entity hoặc repository;
- DTO HTTP;
- application port chỉ có một implementation;
- token `Symbol(...)` và `useExisting` chỉ để gián tiếp hóa một service cụ thể.

Nếu feature chỉ có một contract rất ngắn thì có thể dùng một file rõ nghĩa như `promotion-cache.ts`; không cần tạo nhiều lớp thư mục rỗng.

### `<feature>.module.ts`

Mỗi feature chỉ có một module chính. Module này đăng ký:

- entity và repository do feature sở hữu;
- controller của feature;
- service và event handler của feature;
- module hạ tầng hoặc public API của feature khác mà nó thực sự cần;
- những provider cần thiết được export có chọn lọc.

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion]),
    CacheModule,
  ],
  controllers: [
    PublicPromotionsController,
    AdminPromotionsController,
  ],
  providers: [
    PublicPromotionsService,
    AdminPromotionsService,
    PromotionUsageService,
  ],
  exports: [
    PromotionUsageService,
  ],
})
export class PromotionsModule {}
```

Không dùng `forwardRef()`. Nếu xuất hiện vòng phụ thuộc, phải sửa hướng phụ thuộc bằng một trong các cách:

- chuyển luồng thông báo một chiều sang EventBus/Outbox;
- đưa pure type hoặc utility thật sự trung lập vào `src/shared`;
- để feature sở hữu quyết định và feature còn lại chỉ gọi public API hẹp;
- gộp module phụ quay về module chính nếu việc tách module tạo vòng phụ thuộc giả.

Module phụ chỉ được chấp nhận khi có bằng chứng về runtime isolation rõ ràng, ví dụ worker độc lập. Nó vẫn phải là chi tiết nội bộ, không trở thành public API thứ hai.

### `public-api.ts`

Mỗi feature chỉ có một `public-api.ts`. Đây là cửa duy nhất để feature khác sử dụng feature đó.

Có thể export:

- module chính;
- service cụ thể được feature khác thật sự gọi;
- type hoặc DTO cần cho giao tiếp liên feature;
- event type công khai có owner rõ ràng.

Không export:

- controller;
- repository;
- entity;
- policy, cache key hoặc helper nội bộ;
- toàn bộ thư mục bằng wildcard nếu không cần thiết.

```ts
export { OrdersModule } from './orders.module';
export { OrderQueryService } from './services/order-query.service';
export type { OrderSummary } from './types/order-summary.type';
```

Chỉ export thứ đang có consumer thật. Không dự đoán trước rồi mở rộng API.

### `README.md`

README của mỗi feature phải trả lời ngắn gọn:

1. Feature sở hữu dữ liệu và quyết định nào?
2. Có những controller/service theo vai trò nào?
3. Feature khác được phép dùng gì qua `public-api.ts`?
4. Feature phát và nhận event nào?
5. Những dependency hạ tầng nào đang dùng?
6. Những phần legacy hoặc migration debt nào còn lại?

## 4. Quy tắc dependency bắt buộc

### Trong cùng feature

Dùng relative import trực tiếp:

```ts
import { CustomerOrdersService } from '../services/customer-orders.service';
```

Không import chính `public-api.ts` của feature mình vì sẽ tạo vòng phụ thuộc không cần thiết.

### Giữa hai feature

Chỉ import qua public API duy nhất:

```ts
import { OrderQueryService } from 'src/features/orders/public-api';
```

Cấm deep import:

```ts
// Cấm
import { OrderService } from 'src/features/orders/services/order.service';
import { Order } from 'src/features/orders/entities/order.entity';
import { OrderRepository } from 'src/features/orders/repositories/order.repository';
```

Một feature không được dùng trực tiếp repository hoặc entity của feature khác, kể cả chỉ để đọc.

### Từ feature sang hạ tầng

Feature dùng public API của hạ tầng:

```ts
import { QueueModule, QueueService } from 'src/infra/queue/public-api';
import { CacheModule, CacheService } from 'src/infra/cache/public-api';
```

`src/infra/**` không được import ngược từ `src/features/**`. Queue, cache, storage và map phải trung lập với nghiệp vụ.

## 5. Ownership chuẩn

| Feature | Quyền sở hữu chính |
| --- | --- |
| `orders` | Order và mọi quyết định chuyển trạng thái Order |
| `delivery` | Chuyến giao, shipper, assignment và trạng thái giao hàng |
| `payments` | Checkout, transaction, callback và đối soát thanh toán |
| `promotions` | Điều kiện áp dụng, redemption và campaign khuyến mãi |
| `restaurants` | Hồ sơ, trạng thái và chính sách vận hành nhà hàng |
| `menu` | Menu, món ăn, option và availability |
| `reviews` | Nội dung, moderation và tổng hợp đánh giá |
| `users` | Hồ sơ người dùng, role và trạng thái tài khoản |
| `locations` | Địa chỉ và dữ liệu vị trí của người dùng |
| `communications` | Hội thoại và tin nhắn |
| `notifications` | Thông báo và trạng thái gửi/đọc |
| `analytics` | Projection và số liệu tổng hợp; chỉ đọc nguồn qua API hẹp hoặc event |

Các nguyên tắc quan trọng:

- chỉ Orders được quyết định trạng thái `Order`;
- Delivery không cập nhật trực tiếp Order;
- Analytics và Reviews không đọc repository/entity của Orders;
- feature cần dữ liệu của feature khác phải gọi public service hẹp hoặc dùng projection được xây từ event.

## 6. Khi nào gọi trực tiếp, khi nào dùng event

Gọi public service trực tiếp khi:

- caller cần kết quả ngay trong request;
- đây là query hoặc validation hẹp;
- quan hệ phụ thuộc có một chiều rõ ràng.

Dùng EventBus/Outbox khi:

- owner đã hoàn tất thay đổi và chỉ cần thông báo;
- nhiều feature phản ứng độc lập;
- không cần kết quả đồng bộ;
- cần retry và độ bền sau transaction.

Event không được dùng để che một lời gọi đồng bộ bắt buộc. Public API cũng không được mở rộng chỉ để tránh thiết kế đúng event.

## 7. Không tạo application port không cần thiết

Trong cấu trúc hiện tại, feature khác được inject service cụ thể đã export từ module owner:

```ts
constructor(private readonly orderQueryService: OrderQueryService) {}
```

Không tạo thêm cặp sau nếu chỉ có một implementation:

```ts
export const ORDER_READER = Symbol('ORDER_READER');

{ provide: ORDER_READER, useExisting: OrderQueryService }
```

Port chỉ hợp lý ở biên kỹ thuật thật sự có nhiều implementation hoặc cần thay thế adapter, ví dụ SDK thanh toán ngoài, mail provider hoặc storage provider. Những token đó thuộc lớp hạ tầng phù hợp, không phải cách mặc định để hai feature giao tiếp.

## 8. Ví dụ cho `promotions`

```text
promotions/
├── controllers/
│   ├── public-promotions.controller.ts
│   └── admin-promotions.controller.ts
├── services/
│   ├── public-promotions.service.ts
│   ├── admin-promotions.service.ts
│   └── promotion-usage.service.ts
├── dto/
├── types/
├── contracts/
│   └── promotion-cache.ts
├── promotions.module.ts
├── public-api.ts
└── README.md
```

`promotion-usage.service.ts` là service nghiệp vụ dùng chung vì Orders cần ghi nhận lượt dùng mã khuyến mãi. Nó không cần được đổi thành một application port nếu chỉ có một implementation.

## 9. Ví dụ cho feature lớn như `orders`

Feature lớn vẫn giữ một module và một public API:

```text
orders/
├── controllers/
│   ├── public-orders.controller.ts
│   ├── customer-orders.controller.ts
│   ├── merchant-orders.controller.ts
│   └── admin-orders.controller.ts
├── services/
│   ├── customer-orders.service.ts
│   ├── merchant-orders.service.ts
│   ├── admin-orders.service.ts
│   ├── order-query.service.ts
│   ├── order-pricing.service.ts
│   ├── order-maintenance.service.ts
│   └── order-events.service.ts
├── dto/
├── types/
├── contracts/
├── orders.module.ts
├── public-api.ts
└── README.md
```

Không tạo riêng `orders-delivery.module.ts`, `orders-analytics.module.ts`, `orders-review.module.ts` hoặc nhiều file `*.public-api.ts`. Nếu Delivery, Reviews hoặc Analytics cần Orders, chúng chỉ dùng service được chọn lọc trong `orders/public-api.ts` hoặc nhận event. Nếu hình thành vòng phụ thuộc, sửa hướng giao tiếp; không dùng `forwardRef()` và không tạo module mới để né vòng.

## 10. Gợi ý role cho từng feature

| Feature | Controller/service chính có thể cần |
| --- | --- |
| `auth` | chia theo use case đăng nhập, token, OAuth; không ép đủ role |
| `users` | customer/self, admin, role-management |
| `restaurants` | public, merchant, admin |
| `menu` | public, customer nếu có use case riêng, merchant, admin |
| `promotions` | public, admin, usage |
| `orders` | customer, merchant, admin, system |
| `delivery` | customer tracking, shipper, admin, dispatch/system |
| `payments` | customer, webhook/system, reconciliation/admin |
| `reviews` | public, customer, admin nếu có moderation |
| `communications` | customer, merchant, shipper nếu hành vi khác nhau |
| `notifications` | customer/current-user, system |
| `analytics` | admin, system/projection |
| `locations` | customer; admin chỉ khi có use case thật |

Đây là bản đồ khởi đầu, không phải yêu cầu tạo đủ file.

## 11. Test đi cùng cấu trúc

Test nên phản ánh cùng ranh giới:

```text
test/
├── unit/features/<feature>/
│   ├── customer-<feature>.service.spec.ts
│   ├── merchant-<feature>.service.spec.ts
│   └── admin-<feature>.service.spec.ts
├── integration/features/<feature>/
├── boundary/
└── e2e/
```

Các gate tối thiểu khi refactor một feature:

```bash
npm run build
npm run test:unit -- --runInBand
npm run test:integration -- --runInBand
npm run test:boundary -- --runInBand
```

Nếu project chưa có script đúng tên, chạy test liên quan trực tiếp bằng Jest và ghi lại chính xác lệnh cùng kết quả. Không kết luận pass nếu chưa chạy lệnh thực tế.

## 12. Checklist refactor một feature

- [ ] Xác định owner dữ liệu và quyết định nghiệp vụ.
- [ ] Liệt kê các vai trò thật sự có use case.
- [ ] Không tạo controller/service rỗng chỉ để đủ cấu trúc.
- [ ] Controller chỉ xử lý HTTP và gọi service.
- [ ] Service chỉ dùng repository/entity của feature mình.
- [ ] Luật nghiệp vụ không bị sao chép giữa các service theo vai trò.
- [ ] Chỉ còn một `<feature>.module.ts`.
- [ ] Chỉ còn một `public-api.ts`.
- [ ] `contracts/` vẫn nằm trong feature và chỉ chứa contract nội bộ.
- [ ] Chỉ pure type/utility thật sự trung lập mới được đưa vào `src/shared`.
- [ ] Không có application port/token/`useExisting` không cần thiết.
- [ ] Không có `forwardRef()`.
- [ ] Không deep import sang feature khác.
- [ ] Không dùng repository/entity của feature khác.
- [ ] Infra không import ngược feature.
- [ ] Public route, guard và response contract được giữ ổn định hoặc có migration rõ.
- [ ] Build, boundary test và test nghiệp vụ liên quan có bằng chứng chạy thực tế.
- [ ] README của feature phản ánh đúng code hiện tại.

## 13. Thứ tự migration an toàn

1. Dùng `promotions` làm feature mẫu và chốt quy ước.
2. Làm `orders`, nhưng giữ nguyên ownership trạng thái Order.
3. Làm `delivery`, kiểm tra kỹ giao tiếp với Orders và queue.
4. Làm `users` và role/authorization.
5. Làm `reviews`, `communications`, `notifications`, `analytics`.
6. Làm `menu`, `restaurants`, `locations` nếu chúng chưa theo chuẩn.

Mỗi lần chỉ refactor một feature, có build/test trước và sau, và commit riêng. Không trộn thay đổi Docker, schema dữ liệu hoặc API behavior vào commit sắp xếp cấu trúc nếu không bắt buộc.
