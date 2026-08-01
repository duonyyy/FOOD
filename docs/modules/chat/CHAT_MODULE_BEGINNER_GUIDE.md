# Hướng Dẫn Dễ Hiểu Về Chat Module

Tài liệu này dành cho người mới học NestJS và muốn hiểu module chat trong Foodee. Mục tiêu không phải là giải thích mọi dòng code, mà là giúp bạn trả lời được các câu hỏi:

- User gửi request vào đâu?
- Backend quyết định phải chạy chức năng nào như thế nào?
- Flow đặt món đi qua những bước nào?
- LLM, database và metadata đóng vai trò gì?
- Muốn sửa một hành vi thì nên tìm file nào?

> Đường dẫn module: `src/modules/chat`

---

## 1. Nhìn tổng thể

Chat module là một API nhận câu người dùng nói và trả về câu trả lời của bot.

```txt
Frontend
   |
   | POST /chat
   v
ChatController
   |
   v
ChatService                 Bộ điều phối
   |
   +--> GeneralChatFlow     Chat thông thường
   +--> OrderConversation    Đặt món từng bước
   +--> QuickReorder         Đặt lại đơn cũ
```

Có thể hình dung:

- `Controller` là cửa vào.
- `ChatService` là nhân viên phân luồng.
- `Flow` là kịch bản xử lý từng loại yêu cầu.
- `Service` là các công cụ chuyên môn được flow sử dụng.
- `Metadata` là “bộ nhớ tạm” của cuộc hội thoại.
- `LLM` là thành phần giúp hiểu câu tự nhiên của user, ví dụ “cho mình 2 tô bún bò”.

## 2. Request và response

Request gửi lên server:

```http
POST /chat
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "userMessage": "cho mình 2 tô bún bò",
  "metadata": {}
}
```

Trong đó:

- `userMessage`: câu user vừa nhập.
- `metadata`: thông tin các bước trước đó. Frontend nhận metadata từ response trước rồi gửi lại ở request sau.

Response thường có dạng:

```json
{
  "reply": "Đơn hàng hiện tại của bạn là: 2 Bún bò. Bạn có muốn tiếp tục không?",
  "action": "confirmOrder",
  "suggestions": [],
  "metadata": {}
}
```

- `reply`: nội dung hiển thị cho user.
- `action`: frontend có thể dựa vào giá trị này để biết đang ở bước nào hoặc hiển thị UI nào.
- `suggestions`: danh sách món gợi ý, thường dùng trong chat thông thường.
- `metadata`: state mới của hội thoại, cần giữ lại cho lượt chat tiếp theo.

## 3. File nào làm gì?

### 3.1. Lớp bên ngoài: nhận request và điều phối

#### `chat.controller.ts` — cửa vào API

Controller xử lý HTTP, không xử lý nghiệp vụ đặt món.

Nó làm 4 việc:

1. Bảo vệ route bằng `AuthGuard`.
2. Lấy `userId` từ token đăng nhập.
3. Nhận body và validate bằng `ChatRequestDto`.
4. Gọi `ChatService.generateReply()`.

Luồng gọi chính:

```ts
return this.chatService.generateReply(
  body.userMessage,
  userId,
  body.metadata,
);
```

#### `dto/chat-request.dto.ts` — khuôn mẫu request

DTO định nghĩa request được phép có gì:

```ts
userMessage: string;
metadata?: Record<string, any>;
```

DTO chỉ kiểm tra kiểu dữ liệu và field bắt buộc. Nó không kiểm tra món có tồn tại hay địa chỉ có thuộc user hay không.

#### `chat.service.ts` — bộ điều phối

Đây là file quan trọng nhất để bắt đầu đọc module.

`ChatService` thực hiện thứ tự gần như sau:

```txt
1. Chuẩn hóa userMessage và metadata
2. Nếu user nói "hủy"       -> xóa state, kết thúc flow
3. Nếu user nói "đặt lại"    -> chạy QuickReorderFlow
4. Nếu đang quick reorder    -> tiếp tục QuickReorderFlow
5. Nếu nói "đặt món"         -> bắt đầu OrderConversationFlow
6. Nếu đang đặt món           -> tiếp tục OrderConversationFlow
7. Trường hợp còn lại         -> chạy GeneralChatFlow
```

`ChatService` không trực tiếp gọi LLM hoặc tạo order. Nó chỉ chọn flow phù hợp.

#### `chat.module.ts` — nơi lắp ráp dependency

Đây là file khai báo với NestJS rằng chat module cần:

- `FoodModule`: lấy menu và tìm món.
- `OrderModule`: đọc lịch sử và tạo order.
- `AddressModule`: lấy địa chỉ của user.
- `RestaurantModule`: lấy tên nhà hàng.

Các provider trong module được NestJS tạo và inject vào constructor của các service.

Ví dụ:

```ts
constructor(private readonly llmService: ChatLlmService) {}
```

Nghĩa là NestJS tự cung cấp một instance của `ChatLlmService` cho class đó.

### 3.2. Ba flow nghiệp vụ

#### `flows/general-chat-flow.service.ts` — chat thông thường

Dùng khi user hỏi hoặc yêu cầu gợi ý nhưng không bắt đầu quy trình đặt món.

```txt
User message
   -> ChatPromptService tạo prompt
   -> ChatLlmService gọi LLM
   -> ChatResponseParserService đọc kết quả
   -> ChatReply trả về frontend
```

Ví dụ:

```txt
User: Có món gì cay không?
Bot: Bạn có thể thử mì cay, bún bò sa tế...
```

#### `flows/order-conversation-flow.service.ts` — đặt món từng bước

Đây là flow dài nhất. Nó dùng các cờ trong metadata để biết đang ở bước nào.

```txt
isOrdering
   |
   v
Nhập món -> Xác nhận món -> Xác nhận nhà hàng
                              |
                              v
                      Chọn địa chỉ -> Xác nhận địa chỉ
                                           |
                                           v
                                  Chọn payment -> Validate -> Tạo order
                                                               |
                                                               v
                                                        Publish event
```

Chi tiết:

1. User nói “đặt món” hoặc “đặt đơn”.
2. Backend bật `isOrdering = true`.
3. User nhập tên món và số lượng.
4. LLM phân tích món dựa trên menu.
5. Backend lưu món vào `metadata.orderItems`.
6. User xác nhận món.
7. User xác nhận nhà hàng.
8. User chọn một địa chỉ trong danh sách.
9. User xác nhận địa chỉ.
10. User chọn `cod` hoặc `card`.
11. `ChatOrderValidationService` kiểm tra lại dữ liệu từ database.
12. `OrderService.createOrder()` tạo order.
13. `OrderCreatedPublisher` phát event `orderCreated`.
14. Metadata được reset để kết thúc quy trình.

Điểm quan trọng: LLM có thể đoán sai tên món, ID hoặc giá. Vì vậy LLM không được xem là nguồn dữ liệu cuối cùng.

#### `flows/quick-reorder-flow.service.ts` — đặt lại đơn cũ

Flow này xử lý các câu như:

```txt
đặt lại
đơn gần nhất
```

Luồng hoạt động:

```txt
Lấy 3 đơn gần đây
   -> Hiển thị danh sách 1, 2, 3
   -> User chọn một số
   -> Backend lấy lại danh sách từ database
   -> Tìm món hiện tại theo tên + nhà hàng
   -> Chọn địa chỉ mặc định đầu tiên
   -> Tạo order mới bằng COD
```

Việc lấy lại đơn từ database sau khi user chọn là cần thiết. Backend không nên tin hoàn toàn danh sách order mà frontend gửi lại.

### 3.3. Các service hỗ trợ

#### `services/chat-context.service.ts` — chuẩn bị ngữ cảnh

Lấy dữ liệu từ `FoodService` và `OrderService`, sau đó tạo `ChatContext` gồm:

- `menuFlat`: menu được làm phẳng thành một danh sách.
- `orderedFoods`: những món user từng đặt.

Context được truyền vào flow để prompt có thông tin thực tế hơn.

#### `services/chat-llm.service.ts` — gọi mô hình ngôn ngữ

Service này là adapter cho LLM.

- `callLocalLLM()`: gọi LM Studio qua API tương thích OpenAI. Đây là phương thức đang được flow sử dụng.
- `callGemini()`: gọi Gemini API, hiện có sẵn nhưng chưa được flow chính sử dụng.

Cấu hình lấy từ `.env`:

```env
CHAT_LLM_BASE_URL=http://127.0.0.1:1234/v1
CHAT_LLM_MODEL=qwen/qwen2.5-vl-7b
CHAT_LLM_TIMEOUT_MS=8000
CHAT_LLM_TEMPERATURE=0.3
```

#### `services/chat-prompt.service.ts` — viết yêu cầu cho LLM

Có hai prompt chính:

- `buildOrderItemsPrompt()`: yêu cầu LLM trả về danh sách món dạng JSON.
- `buildGeneralReplyPrompt()`: yêu cầu LLM trả về reply, suggestions và action.

Prompt là “câu lệnh” gửi cho LLM. Nó không phải là validation.

#### `services/chat-response-parser.service.ts` — đọc output của LLM

LLM có thể trả về:

```json
[{"id":"1", "name":"Bún bò", "quantity":2}]
```

Parser sẽ cố gắng lấy JSON ra khỏi text, parse thành object và loại những item không hợp lệ.

Nếu parse thất bại, parser trả fallback hoặc danh sách rỗng để flow xử lý tiếp.

#### `services/chat-order-validation.service.ts` — chốt tính hợp lệ trước khi tạo order

Đây là lớp bảo vệ quan trọng nhất trước `createOrder()`.

Nó kiểm tra:

- Payment chỉ là `cod` hoặc `card`.
- Địa chỉ phải tồn tại và thuộc user hiện tại.
- Phải có ít nhất một món.
- Quantity phải là số nguyên dương.
- Món phải tồn tại trong database.
- Tất cả món phải thuộc cùng một restaurant.
- Price và restaurant được lấy lại từ database.

Nguyên tắc cần nhớ:

```txt
LLM/client: đề xuất user muốn gì
Database/backend: quyết định dữ liệu nào hợp lệ
```

#### `services/order-created-publisher.service.ts` — phát sự kiện

Sau khi order được tạo, service này gọi:

```ts
pubSub.publish('orderCreated', { orderCreated: order });
```

Các thành phần khác trong hệ thống có thể lắng nghe event này để xử lý thông báo, cập nhật realtime hoặc nghiệp vụ liên quan.

### 3.4. Type và state

#### `types/chat.types.ts` — các kiểu dữ liệu dùng chung

Một số type quan trọng:

- `ChatReply`: response của chat.
- `ChatSuggestion`: món gợi ý.
- `ChatOrderItem`: món trong order đang xây dựng.
- `ChatMetadata`: state giữa nhiều request.
- `ChatContext`: menu và lịch sử order dùng làm ngữ cảnh.

TypeScript chỉ giúp kiểm tra trong lúc build/code. Dữ liệu thật gửi từ client vẫn phải kiểm tra runtime.

#### `utils/chat-metadata.factory.ts` — tạo và chuẩn hóa metadata

- `createInitialChatMetadata()`: tạo state ban đầu.
- `normalizeChatMetadata()`: bổ sung field mặc định và đảm bảo `orderItems`, `addresses` là array.

Ví dụ state ban đầu:

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

## 4. Ví dụ đầy đủ: đặt món

### Lượt 1: bắt đầu

```txt
User: đặt món
```

`ChatService` nhận ra đây là start request của `OrderConversationFlowService`.

```txt
Bot: Vui lòng cho mình biết bạn muốn đặt món gì?
action: orderItems
metadata.isOrdering: true
```

### Lượt 2: nhập món

```txt
User: 2 tô bún bò
```

Flow gọi:

```txt
ChatPromptService -> ChatLlmService -> ChatResponseParserService
```

Kết quả được thêm vào `metadata.orderItems`.

```txt
Bot: Đơn hàng hiện tại của bạn là: 2 Bún bò. Bạn có muốn tiếp tục không?
action: confirmOrder
```

### Lượt 3: xác nhận món và nhà hàng

```txt
User: có
```

Flow bật `isFoodConfirmed`, sau đó hỏi xác nhận nhà hàng.

```txt
Bot: Món ăn đã được xác nhận. Bạn muốn giao hàng từ cửa hàng X phải không?
```

### Lượt 4: chọn địa chỉ

Backend lấy địa chỉ của user bằng `AddressService` và hiển thị danh sách đánh số.

```txt
User: 1
Bot: Bạn đã chọn địa chỉ A. Bạn có xác nhận địa chỉ này không?
```

### Lượt 5: thanh toán và tạo order

```txt
User: có
Bot: Bạn muốn thanh toán bằng COD hay card?

User: cod
```

Trước khi tạo order:

```txt
ChatOrderValidationService.validate()
   -> hợp lệ
OrderService.createOrder()
   -> OrderCreatedPublisher.publish()
```

Sau đó bot trả về link xem order và reset state.

## 5. Metadata hoạt động như thế nào?

HTTP request là stateless: mỗi request mới không tự nhớ request trước. Vì vậy module cần nhận lại thông tin state qua `metadata`.

```txt
Request 1: "đặt món" + metadata ban đầu
Response 1: isOrdering = true

Request 2: "2 bún bò" + metadata từ response 1
Response 2: orderItems đã có món

Request 3: "có" + metadata từ response 2
Response 3: isFoodConfirmed = true
```

Trong implementation hiện tại, frontend giữ và gửi lại metadata. Điều này dễ triển khai nhưng có rủi ro: client có thể sửa metadata hoặc gửi state không nhất quán. Backend vẫn phải validate lại khi tạo order.

## 6. Cách tìm file khi cần sửa

| Muốn thay đổi | Nên xem file |
|---|---|
| Đổi URL hoặc cách nhận request | `chat.controller.ts` |
| Đổi thứ tự chọn flow | `chat.service.ts` |
| Đổi câu bắt đầu đặt món | `order-conversation-flow.service.ts` |
| Đổi các bước đặt món | `order-conversation-flow.service.ts` |
| Đổi cách đặt lại đơn cũ | `quick-reorder-flow.service.ts` |
| Đổi câu trả lời chat thông thường | `general-chat-flow.service.ts`, `chat-prompt.service.ts` |
| Đổi cấu trúc prompt gửi LLM | `chat-prompt.service.ts` |
| LLM trả JSON nhưng parse lỗi | `chat-response-parser.service.ts` |
| Kiểm tra an toàn trước khi tạo order | `chat-order-validation.service.ts` |
| Đổi dữ liệu menu đưa vào LLM | `chat-context.service.ts` |
| Đổi state mặc định | `chat-metadata.factory.ts`, `chat.types.ts` |
| Đổi event sau khi tạo order | `order-created-publisher.service.ts` |

## 7. Các khái niệm NestJS xuất hiện trong module

### Controller

Nhận HTTP request và trả HTTP response.

### Service

Chứa logic có thể tái sử dụng. Trong module này, mỗi service được tách theo một trách nhiệm cụ thể.

### Dependency Injection

NestJS tự truyền dependency vào constructor:

```ts
constructor(
  private readonly promptService: ChatPromptService,
) {}
```

Class không tự `new ChatPromptService()`. Việc khởi tạo do NestJS quản lý.

### DTO

Data Transfer Object — object mô tả dữ liệu đi qua API.

### Guard

`AuthGuard` kiểm tra user đã đăng nhập trước khi cho phép gọi endpoint.

### Provider

Một class được NestJS quản lý và có thể inject vào class khác. Các service trong `chat.module.ts` là provider.

### Event / PubSub

Một thành phần phát thông báo rằng một việc đã xảy ra. Ở đây là event `orderCreated`.

### LLM

Large Language Model — mô hình ngôn ngữ. Trong module này, LLM hiểu câu tự nhiên và chuyển nó thành JSON hoặc câu trả lời. LLM không nên được giao quyền quyết định dữ liệu order cuối cùng.

## 8. Những điều người mới dễ nhầm

### Nhầm rằng LLM tạo order

Không đúng. LLM chỉ phân tích câu nói. `OrderService.createOrder()` mới là nơi tạo order.

### Nhầm rằng `metadata` là database

Không đúng. Metadata hiện là state tạm do frontend gửi lại. Nó không phải nơi lưu trữ đáng tin cậy lâu dài.

### Nhầm rằng parser đã đủ an toàn

Không đúng. Parser chỉ kiểm tra dữ liệu có parse được hay không. `ChatOrderValidationService` mới là bước kiểm tra dữ liệu từ database trước khi tạo order.

### Nhầm rằng flow nào cũng gọi LLM

Không đúng.

- General chat có gọi LLM.
- Order conversation gọi LLM chủ yếu khi phân tích món.
- Quick reorder lấy dữ liệu đơn từ backend và không cần LLM.

## 9. Cách học module này theo thứ tự

Nếu mới học, nên đọc theo thứ tự sau:

1. Đọc file này để hiểu bản đồ.
2. Đọc `chat.controller.ts` để biết request đi vào đâu.
3. Đọc `chat.service.ts` để hiểu cách chọn flow.
4. Đọc `general-chat-flow.service.ts` vì đây là flow ngắn nhất.
5. Đọc `quick-reorder-flow.service.ts` để hiểu một nghiệp vụ tương đối độc lập.
6. Đọc `order-conversation-flow.service.ts` theo từng nhánh `continue()`.
7. Đọc `chat-metadata.factory.ts` và `chat.types.ts` để hiểu state.
8. Cuối cùng đọc prompt, LLM, parser và validation.

Khi debug, hãy log 4 thông tin: `userMessage`, `action`, các cờ trong `metadata`, và lỗi từ LLM/database.

## 10. Tóm tắt một câu

`ChatController` nhận câu nói, `ChatService` chọn kịch bản, flow xử lý từng bước, các service hỗ trợ lấy dữ liệu/gọi LLM/kiểm tra order, rồi backend trả reply và state mới cho frontend.
