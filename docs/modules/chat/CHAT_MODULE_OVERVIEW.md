# Chat Module Overview

Tài liệu này giải thích toàn bộ `src/modules/chat` theo góc nhìn sản phẩm và kỹ thuật. Mục tiêu là giúp bạn đọc nhanh module, hiểu flow chính, biết file nào chịu trách nhiệm gì, và nhận ra các điểm cần cẩn thận khi nâng cấp.

## 1. Module Này Làm Gì?

`ChatModule` cung cấp API chat cho user đã đăng nhập:

```http
POST /chat
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "userMessage": "đặt món",
  "metadata": {}
}
```

Response chính:

```ts
{
  reply: string;
  suggestions?: ChatSuggestion[];
  action?: string;
  metadata?: ChatMetadata | Record<string, any> | null;
}
```

Chat hiện hỗ trợ 3 nhóm hành vi:

1. Trò chuyện/gợi ý món thông thường.
2. Đặt món theo hội thoại từng bước.
3. Đặt lại đơn gần đây.

## 2. Cấu Trúc File

```txt
src/modules/chat
├── chat.controller.ts
├── chat.module.ts
├── chat.service.ts
├── dto
│   └── chat-request.dto.ts
├── flows
│   ├── general-chat-flow.service.ts
│   ├── order-conversation-flow.service.ts
│   └── quick-reorder-flow.service.ts
├── services
│   ├── chat-context.service.ts
│   ├── chat-llm.service.ts
│   ├── chat-order-validation.service.ts
│   ├── chat-prompt.service.ts
│   ├── chat-response-parser.service.ts
│   └── order-created-publisher.service.ts
├── types
│   └── chat.types.ts
└── utils
    └── chat-metadata.factory.ts
```

## 3. Vai Trò Từng Thành Phần

### `dto/chat-request.dto.ts`

Định nghĩa hợp đồng dữ liệu đầu vào của endpoint `POST /chat`.

Trách nhiệm:

- Bắt buộc `userMessage` là chuỗi không rỗng.
- Cho phép `metadata` tùy chọn và yêu cầu metadata là object.
- Được NestJS kết hợp với `ValidationPipe` để validate request trước khi vào controller.

DTO chỉ kiểm tra hình dạng request; nó không kiểm tra state hội thoại, món ăn, địa chỉ hay quyền tạo order.

### `chat.controller.ts`

Nhận request `POST /chat`.

Trách nhiệm:

- Bảo vệ route bằng `AuthGuard`.
- Lấy `userId` từ token.
- Validate body bằng `ChatRequestDto`.
- Gọi `ChatService.generateReply()`.

Controller không xử lý nghiệp vụ chat.

### `chat.service.ts`

Đây là facade điều phối chính.

Trách nhiệm:

- Chuẩn hóa `userMessage`.
- Chuẩn hóa `metadata`.
- Xử lý lệnh hủy.
- Route message sang flow phù hợp:
  - quick reorder
  - order conversation
  - general chat

Điểm quan trọng: `ChatService` không nên chứa logic tạo order, parse LLM, build prompt, hay validate order. Những phần đó đã được tách ra service/flow riêng.

### `chat.module.ts`

Khai báo dependency của chat.

Module hiện import:

- `FoodModule`
- `OrderModule`
- `AddressModule`
- `RestaurantModule`

Và register các provider nội bộ của chat.

### `types/chat.types.ts`

Chứa các type/interface dùng chung trong module:

- `ChatReply`: cấu trúc response trả về frontend.
- `ChatSuggestion`: món ăn được dùng trong gợi ý và menu context.
- `ChatOrderItem`: món đang nằm trong state đặt hàng.
- `ChatMetadata`: state hội thoại mà frontend gửi lại giữa các lượt chat.
- `QuickOrderOption`: dữ liệu rút gọn của một đơn dùng cho quick reorder.
- `ChatContext` và `ChatMenuItem`: dữ liệu menu/lịch sử đơn cung cấp cho flow và prompt.

Đây là lớp định nghĩa kiểu dữ liệu, không thực hiện validate runtime. Vì vậy dữ liệu nhận từ client vẫn phải được chuẩn hóa và kiểm tra ở các service tương ứng.

## 4. Các Service Hỗ Trợ

### `services/chat-context.service.ts`

Tập hợp dữ liệu cần thiết để chat hiểu ngữ cảnh của user.

Trách nhiệm:

- Lấy menu hiện tại của user từ `FoodService`.
- Lấy tối đa 5 đơn gần đây từ `OrderService`.
- Chuyển menu dạng nhà hàng/food lồng nhau thành `menuFlat` để đưa vào prompt.
- Tạo link, ảnh mặc định và danh sách `orderedFoods`.

Service này chỉ xây dựng context; nó không điều hướng flow và không tạo order.

### `services/chat-llm.service.ts`

Đóng vai trò adapter giao tiếp với các mô hình ngôn ngữ.

- `callLocalLLM()`: gọi endpoint tương thích OpenAI tại LM Studio; đây là phương thức các flow hiện đang sử dụng.
- `callGemini()`: gọi Gemini API, hiện được giữ sẵn nhưng chưa được flow sử dụng.
- Đọc model, base URL, timeout và temperature từ `ConfigService`.
- Xử lý lỗi local LLM và trả về thông báo fallback thay vì để lỗi kết nối làm crash flow.

Service này chỉ gửi prompt và nhận text; việc định dạng prompt và parse JSON thuộc về hai service khác.

### `services/chat-prompt.service.ts`

Tạo prompt có cấu trúc cho LLM:

- `buildOrderItemsPrompt()`: yêu cầu trích xuất danh sách món, số lượng và restaurant từ lời user.
- `buildGeneralReplyPrompt()`: yêu cầu tạo câu trả lời, suggestions và action cho chat thông thường.

Prompt chỉ đưa một phần menu (`15` món cho order, `12` món cho general chat), nên kết quả có thể bị giới hạn khi menu lớn.

### `services/chat-response-parser.service.ts`

Chuyển text LLM thành dữ liệu mà backend có thể dùng.

Trách nhiệm:

- Gỡ code fence và trích xuất JSON array/object từ output.
- Parse, lọc và chuẩn hóa order items.
- Parse general reply và chuẩn hóa suggestions.
- Trả fallback phù hợp khi LLM không trả JSON hợp lệ.

Parser chỉ làm sạch và chuẩn hóa dữ liệu; đây không phải lớp bảo mật cuối cùng trước khi tạo order.

### `services/chat-order-validation.service.ts`

Là lớp kiểm tra tin cậy trước khi `OrderService.createOrder()` được gọi.

Service kiểm tra payment method, quyền sở hữu địa chỉ, danh sách món, quantity, sự tồn tại của food và việc tất cả món thuộc cùng restaurant. Sau đó service lấy `food.id`, `food.price` và `restaurantId` từ DB để trả về order đã được xác thực.

Điểm cần phân biệt: service này xác thực order tại thời điểm thanh toán, không thay thế cho DTO validation và cũng không quản lý toàn bộ state hội thoại.

### `services/order-created-publisher.service.ts`

Đóng gói thao tác publish event `orderCreated` lên `pubSub`.

Các flow chỉ cần gọi `publish(order)` thay vì phụ thuộc trực tiếp vào chi tiết topic và payload của PubSub. Service này không tạo hoặc cập nhật order.

## 5. Các Flow Chính

### `flows/general-chat-flow.service.ts`

File:

```txt
flows/general-chat-flow.service.ts
```

Flow này dùng cho câu hỏi bình thường, không phải đặt món hoặc đặt lại đơn.

Luồng:

1. Build prompt bằng `ChatPromptService`.
2. Gọi LLM qua `ChatLlmService`.
3. Parse response bằng `ChatResponseParserService`.
4. Trả về `reply`, `suggestions`, `action`.

### `flows/order-conversation-flow.service.ts`

File:

```txt
flows/order-conversation-flow.service.ts
```

Đây là flow đặt món từng bước.

Các bước hiện tại:

1. User nói `"đặt món"` hoặc `"đặt đơn"`.
2. Bot hỏi user muốn đặt món gì.
3. User nhập món.
4. LLM phân tích món từ menu.
5. Bot xác nhận danh sách món.
6. Bot xác nhận nhà hàng.
7. Bot cho chọn địa chỉ.
8. Bot xác nhận địa chỉ.
9. Bot hỏi payment: `COD` hoặc `card`.
10. Backend validate lại toàn bộ order.
11. Backend tạo order.
12. Publish event `orderCreated`.

### Flow đặt món dạng đơn giản

```txt
User: đặt món
Bot: Vui lòng cho mình biết bạn muốn đặt món gì?

User: 2 bún bò
Bot: Đơn hàng hiện tại của bạn là: 2 Bún bò. Bạn có muốn tiếp tục không?

User: có
Bot: Món ăn đã được xác nhận. Bạn muốn giao hàng từ cửa hàng X phải không?

User: có
Bot: Bạn muốn giao đến địa chỉ nào...

User: 1
Bot: Bạn đã chọn địa chỉ A. Bạn có xác nhận địa chỉ này không?

User: có
Bot: Bạn muốn thanh toán bằng COD hay card?

User: cod
Bot: Đơn hàng của bạn đã được tạo thành công...
```

### Điểm an toàn khi tạo order

Trước khi gọi `OrderService.createOrder()`, module gọi:

```txt
ChatOrderValidationService.validate()
```

Service này kiểm tra lại:

- Payment chỉ được là `cod` hoặc `card`.
- Phải có `selectedAddress.id`.
- Address phải thuộc đúng user.
- Phải có order items.
- Mỗi món phải tồn tại trong DB.
- Quantity phải là số nguyên dương.
- Tất cả món phải thuộc cùng một restaurant.
- Price lấy từ DB, không lấy từ LLM hoặc client.

Đây là điểm rất quan trọng: LLM chỉ giúp hiểu ý định, không phải nguồn dữ liệu đáng tin để tạo order.

### `flows/quick-reorder-flow.service.ts`

File:

```txt
flows/quick-reorder-flow.service.ts
```

Flow này xử lý khi user nói:

- `"đặt lại"`
- `"đơn gần nhất"`

Luồng:

1. Backend lấy 3 đơn gần đây của user.
2. Bot hiển thị danh sách số thứ tự.
3. User chọn số.
4. Backend refetch lại 3 đơn gần đây từ server.
5. Backend lấy đơn tương ứng với số user chọn.
6. Backend tìm lại food hiện tại theo tên món và restaurant.
7. Tạo order mới với payment `cod`.
8. Publish event `orderCreated`.

Điểm tốt: khi user chọn số, backend không tin `quickOrderOptions` từ client nữa mà refetch từ server.

Điểm cần lưu ý: quick reorder hiện lấy địa chỉ đầu tiên của user. Nếu user có nhiều địa chỉ thì có thể chưa đúng kỳ vọng sản phẩm.

## 6. Metadata Là Gì?

File type:

```txt
types/chat.types.ts
```

Metadata là state hội thoại mà frontend gửi lại sau mỗi message.

Ví dụ:

```json
{
  "orderItems": [],
  "addresses": [],
  "isOrdering": false,
  "isFoodConfirmed": false,
  "isRestaurantConfirmed": false,
  "isAddressConfirmed": false,
  "isPaymentConfirmed": false
}
```

### `utils/chat-metadata.factory.ts`

Chứa hai hàm tạo và chuẩn hóa state hội thoại:

- `createInitialChatMetadata()`: tạo state ban đầu với danh sách rỗng và toàn bộ cờ đặt hàng ở trạng thái `false`.
- `normalizeChatMetadata()`: merge metadata client gửi với state mặc định, đồng thời bảo đảm `orderItems` và `addresses` luôn là array.

Factory giúp flow không phải tự kiểm tra metadata thiếu field, nhưng không xác minh dữ liệu bên trong các field đó.

Điểm cần hiểu rõ: metadata hiện vẫn do client giữ. Backend đã validate lại trước khi tạo order, nhưng flow hội thoại vẫn phụ thuộc các flag client gửi lên.

Về lâu dài, nếu muốn chuẩn production hơn nữa, nên chuyển sang server-side session.

## 7. LLM Được Dùng Ở Đâu?

File:

```txt
services/chat-llm.service.ts
```

Hiện module ưu tiên gọi local LLM:

```env
CHAT_LLM_BASE_URL=http://127.0.0.1:1234/v1
CHAT_LLM_MODEL=qwen/qwen2.5-vl-7b
CHAT_LLM_TIMEOUT_MS=8000
CHAT_LLM_TEMPERATURE=0.3
```

`ChatLlmService` có:

- `callLocalLLM()`
- `callGemini()`

Hiện flow đang dùng `callLocalLLM()`.

Nếu LLM lỗi, service trả text fallback để flow không crash.

## 8. Prompt Và Parser

### Prompt

File:

```txt
services/chat-prompt.service.ts
```

Có 2 prompt chính:

- `buildOrderItemsPrompt()`
- `buildGeneralReplyPrompt()`

Prompt order yêu cầu LLM trả JSON array dạng:

```json
[
  {
    "id": "...",
    "name": "...",
    "quantity": 1,
    "restaurantId": "..."
  }
]
```

### Parser

File:

```txt
services/chat-response-parser.service.ts
```

Parser làm các việc:

- Tách JSON array/object từ output LLM.
- Parse order items.
- Parse general reply.
- Bỏ item có quantity không hợp lệ.

Parser không phải lớp bảo mật cuối cùng. Dữ liệu cuối vẫn phải qua `ChatOrderValidationService`.

## 9. Publish Order Event

File:

```txt
services/order-created-publisher.service.ts
```

Wrapper cho:

```ts
pubSub.publish('orderCreated', { orderCreated: order });
```

Mục tiêu là không để flow service phụ thuộc trực tiếp vào `pubSub`.

## 10. Những Điểm Đã Tốt Hơn

So với phiên bản ban đầu, module hiện tốt hơn ở các điểm:

- `ChatService` không còn ôm toàn bộ logic.
- Flow đặt món, đặt lại, chat thường được tách riêng.
- LLM adapter tách riêng.
- Prompt builder tách riêng.
- Parser tách riêng.
- Order validation tách riêng.
- Payment không còn default bừa sang `card`.
- Tạo order không còn dùng `metadata.addresses[0]`.
- Price không lấy từ LLM/client.
- Quick reorder không còn tin order options từ client khi tạo đơn.
- Build đã pass sau refactor.

## 11. Những Điểm Chưa Thật Sự Prod Hoàn Chỉnh

### 1. State vẫn nằm ở client

Metadata vẫn do frontend gửi lên. Backend đã validate trước khi tạo order, nhưng user vẫn có thể gửi flag để nhảy flow.

Giải pháp tốt hơn:

```txt
ChatSession
├── id
├── userId
├── step
├── metadata
├── createdAt
├── updatedAt
└── expiresAt
```

Frontend chỉ gửi:

```json
{
  "sessionId": "...",
  "userMessage": "..."
}
```

Backend tự quản state.

### 2. Boolean state dễ mâu thuẫn

Hiện dùng nhiều flag:

```ts
isOrdering
isFoodConfirmed
isRestaurantConfirmed
isAddressConfirmed
isPaymentConfirmed
```

Nên đổi sang:

```ts
step:
  | 'idle'
  | 'collecting_items'
  | 'confirming_items'
  | 'confirming_restaurant'
  | 'choosing_address'
  | 'confirming_address'
  | 'choosing_payment'
  | 'completed'
```

### 3. Quick reorder chưa hỏi lại địa chỉ

Quick reorder đang lấy địa chỉ đầu tiên của user. Nếu user có nhiều địa chỉ, đây có thể là UX sai.

### 4. Food validation đang dùng method hơi nặng

`ChatOrderValidationService` dùng `FoodService.findOne()`. Method này lấy nhiều dữ liệu hơn cần thiết và có nhiều debug log.

Nên thêm method nhẹ hơn trong `FoodService`, ví dụ:

```ts
findOrderableFoodById(id: string)
```

Chỉ trả:

```ts
{
  id: string;
  name: string;
  price: number;
  restaurant: { id: string };
}
```

## 12. Hướng Nâng Cấp Tiếp Theo

Ưu tiên đề xuất:

1. Đổi boolean flags sang `step`.
2. Thêm server-side chat session.
3. Sửa quick reorder để user xác nhận/chọn địa chỉ.
4. Thêm method nhẹ trong `FoodService` cho chat validation.
5. Thêm structured logging:
   - userId
   - action
   - step
   - orderId
   - llm latency
   - parse success/fail
6. Thêm test nếu team quyết định bật lại test cho chat.

## 13. Tư Duy Thiết Kế Cần Nhớ

Điểm quan trọng nhất của module này:

> LLM chỉ giúp hiểu người dùng muốn gì. Backend mới là nơi quyết định dữ liệu nào hợp lệ để tạo order.

Không nên để:

- LLM quyết định price.
- Client quyết định address hợp lệ.
- Client quyết định restaurant hợp lệ.
- Metadata client tự do điều khiển tạo order mà không validate.

Hiện module đã giảm nhiều rủi ro ở bước tạo order, nhưng để đạt chuẩn sản phẩm production hơn nữa, cần đưa state hội thoại về server-side.
