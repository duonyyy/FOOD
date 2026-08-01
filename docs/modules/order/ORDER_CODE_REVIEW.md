# Code Review — `src/modules/order`

---

## Tóm tắt trạng thái

| Vấn đề | Mức độ | Trạng thái |
| :--- | :---: | :---: |
| `getOrderById` luôn trả về `null` | P0 | ✅ Đã sửa |
| Timer leak (`setInterval` không clear) | P0 | ✅ Đã sửa |
| Transaction boundary Promotion | P1 | ✅ Đã sửa |
| Race condition Promotion (Double Spend) | P1 | ✅ Đã sửa |
| DTO validation bị bypass (`body: any`) | P2 | ✅ Đã sửa |
| Publish `orderStatusUpdated` trùng lặp | P2 | ✅ Đã sửa |
| Import `log` từ `console` thừa | Minor | ✅ Đã sửa |
| `clearPromotionCache()` trước khi outer tx commit | Minor | ✅ Đã sửa |
| Active shippers lưu trong RAM (`Map`) | Infra | 🔵 Cần Redis |
| Cron job chạy trên mọi instance | Infra | 🔵 Cần distributed scheduler |
| Mapbox không có timeout/fallback | Infra | 🔵 Cần SLA policy |
| Cascading deletes chưa kiểm tra FK | Design | 🔵 Cần kiểm tra schema |

---

## Kết quả kiểm tra chi tiết

### ✅ P0 — `getOrderById` đã được sửa

**File:** `order.resolver.ts` (line 747–766)

Trước đây hàm `getOrderById` trong `ActiveShipperTracker` luôn trả về `null` khiến toàn bộ luồng gán shipper pending bị tê liệt. Hiện tại đã inject `orderRepository` vào tracker và query DB thật:

```typescript
private async getOrderById(orderId: string): Promise<Order | null> {
  if (!this.orderRepository) {
    this.logger.error('❌ OrderRepository not initialized');
    return null;
  }
  return this.orderRepository.findOne({
    where: { id: orderId },
    relations: [
      'user', 'restaurant', 'restaurant.address',
      'orderDetails', 'orderDetails.food',
      'shippingDetail', 'shippingDetail.shipper',
      'promotionCode', 'address',
    ],
  });
}
```

`orderRepository` được truyền qua constructor của cả `ActiveShipperTracker` và `OrderResolver`. Luồng `processPendingAssignmentsForShipper` hoạt động đúng.

---

### ✅ P0 — Timer leak đã được sửa (`OnModuleDestroy`)

**File:** `order.resolver.ts` (line 792, 823–826)

`OrderResolver` giờ implements `OnModuleDestroy`. Khi NestJS shutdown ứng dụng, `destroy()` được gọi để clear `setInterval`:

```typescript
export class OrderResolver implements OnModuleDestroy {
  onModuleDestroy() {
    activeShipperTracker?.destroy();
    activeShipperTracker = null;
  }
}
```

---

### ✅ P1 — Transaction boundary Promotion đã được sửa

**File:** `order.service.ts` (line 224–229)

`queryRunner.manager` đã được truyền vào `usePromotion`, đảm bảo việc tăng `numberOfUsed` nằm trong cùng transaction với việc tạo đơn hàng:

```typescript
if (order.promotionCode) {
  await this.orderPromotionService.usePromotion(
    order.promotionCode.code,
    orderCalculation.subtotal,
    queryRunner.manager, // ← đúng rồi
  );
}
```

Nếu `createOrder` rollback sau bước này, `numberOfUsed` cũng sẽ được rollback theo. Người dùng không còn mất lượt dùng promotion khi tạo đơn thất bại.

---

### ✅ P1 — Race condition Promotion đã được khắc phục

**File:** `promotion.service.ts` (line 265–284)

`usePromotion` khi nhận `manager` sẽ thực hiện toàn bộ validate + increment trong cùng 1 transaction với `pessimistic_write` lock:

```typescript
const promotion = await promotionRepository.findOne({
  where: { code },
  lock: { mode: 'pessimistic_write' }, // ← các request khác phải đợi
});
// validate → increment → save: nguyên tử, không thể double spend
```

Khi một request giữ lock, các request song song phải xếp hàng. Sau khi request đầu commit, request sau mới đọc lại `numberOfUsed` cập nhật và thất bại nếu đã đạt `maxUsage`.

---

### ✅ P2 — DTO Validation đã được bật

**File:** `order.controller.ts` (line 42), `dto/create-order.dto.ts`

Controller không còn nhận `@Body() body: any`. Thay vào đó dùng `CreateOrderRequestDto`:

```typescript
@Post()
async createOrder(@Body() body: CreateOrderRequestDto)
```

`CreateOrderRequestDto` extends `CreateOrderDto`, override `addressId` thành optional và thêm `address?: CustomOrderAddressDto`. Tất cả field đều có decorator `class-validator`. `ValidationPipe` sẽ tự động kích hoạt kiểm tra dữ liệu đầu vào.

---

### ✅ P2 — Không còn publish `orderStatusUpdated` trùng lặp

**File:** `order.controller.ts` (line 286–367)

Controller `updateOrderStatus` không còn gọi `pubSub.publish('orderStatusUpdated', ...)`. Toàn bộ việc publish được delegate duy nhất cho `OrderService.updateOrderStatus()` (line 485).

---

## Vấn đề mới phát hiện (sau khi review lại)

### ⚠️ Minor — Import thừa `log` từ `console`

**File:** `order.resolver.ts` (line 15)

```typescript
import { log } from 'console'; // không được dùng ở bất kỳ đâu trong file
```

Đây là deadcode. ESLint sẽ báo `no-unused-vars`.

**Đã sửa:** Xóa dòng `import { log } from 'console';` khỏi `order.resolver.ts` line 15.

---

### ⚠️ Minor — `clearPromotionCache()` gọi trước khi outer transaction commit

**File:** `promotion.service.ts` (line 280–282)

```typescript
promotion.numberOfUsed = Number(promotion.numberOfUsed || 0) + 1;
const updatedPromotion = await promotionRepository.save(promotion);
await this.clearPromotionCache(); // ← cache bị xóa ngay đây
return updatedPromotion;
// ← outer transaction của createOrder chưa commit tại thời điểm này
Khi `usePromotion` được gọi với `manager` từ `queryRunner` của `createOrder`, `clearPromotionCache()` chạy ngay sau `save()` nhưng outer transaction vẫn chưa `commit`. Nếu `createOrder` rollback sau đó (ví dụ lỗi bước khác), cache đã bị invalidate nhưng `numberOfUsed` trong DB không thực sự tăng.

**Hậu quả thực tế:** Không gây sai dữ liệu vì lần đọc kế tiếp sẽ hit DB và thấy giá trị đúng. Tuy nhiên vi phạm nguyên tắc *"chỉ invalidate cache sau khi dữ liệu thực sự được persist"* và gây cache thrashing không cần thiết.

**Đã sửa với 3 thay đổi:**

1. `promotion.service.ts` — bỏ `clearPromotionCache()` khỏi nhánh `manager`, đổi visibility thành `public`.
2. `order-promotion.service.ts` — thêm method `clearCache()` public để delegate.
3. `order.service.ts` — gọi `clearCache()` **sau** `commitTransaction()`:

```typescript
await queryRunner.commitTransaction();
// Cache chỉ bị xóa SAU KHI commit thành công
if (order.promotionCode) {
  await this.orderPromotionService.clearCache();
}
```

---

## Các rủi ro hạ tầng còn lại (cần quyết định kiến trúc)

> [!NOTE]
> Các mục dưới đây **không phải bug code**, mà là giới hạn kiến trúc cần hạ tầng/thiết kế để giải quyết. Chấp nhận được nếu hệ thống chỉ chạy 1 instance.

| Rủi ro | Vấn đề | Giải pháp đề xuất |
| :--- | :--- | :--- |
| **In-memory shipper state** | `Map` trong RAM mất khi restart; không chia sẻ giữa nhiều instance | Redis GEOADD + ZRANGEBYSCORE cho shipper location |
| **Cron job mỗi instance** | `@Cron` chạy đồng loạt trên tất cả pods | BullMQ / pg-boss / tách scheduler service riêng |
| **Mapbox sync dependency** | Timeout Mapbox → toàn bộ `createOrder` bị block | Thêm timeout wrapper + fallback Haversine |
| **deleteOrder FK** | Chỉ xóa thủ công `OrderDetail`; `ShippingDetail`, `Checkout` có thể vướng FK | Kiểm tra DB schema, thêm `onDelete: 'CASCADE'` hoặc xóa thủ công trước |
