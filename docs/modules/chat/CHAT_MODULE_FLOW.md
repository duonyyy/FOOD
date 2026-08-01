# Chat Module Flow

Tài liệu mô tả flow thực tế của `src/modules/chat` bằng Mermaid. Các sơ đồ được chia nhỏ để dễ đọc trên màn hình.

> Metadata hội thoại hiện do frontend gửi lại trong mỗi request. Module chưa sử dụng server-side chat session.

## 1. Request và các flow

```mermaid
flowchart TD
    Client[Frontend / Chat UI]
    Controller[ChatController - POST /chat]
    Service[ChatService - điều phối]
    General[General Chat]
    Order[Order Conversation]
    Reorder[Quick Reorder]

    Client --> Controller
    Controller --> Service
    Service --> General
    Service --> Order
    Service --> Reorder
    General --> Controller
    Order --> Controller
    Reorder --> Controller
    Controller --> Client
```

## 2. Request đi qua module

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend
    participant Guard as AuthGuard
    participant C as ChatController
    participant S as ChatService
    participant F as Selected Flow

    UI->>C: POST /chat với message và metadata
    C->>Guard: Kiểm tra access token
    Guard-->>C: userId hợp lệ
    C->>C: Validate ChatRequestDto
    C->>S: generateReply(message, userId, metadata)
    S->>S: Normalize message và metadata
    S->>F: Chọn flow phù hợp
    F-->>S: ChatReply
    S-->>C: ChatReply
    C-->>UI: reply, action, metadata mới
```

## 3. Quyết định chọn flow

```mermaid
flowchart TD
    Start[Nhận message + metadata]
    Normalize[Trim message và normalize metadata]
    Cancel{Message bằng "hủy"?}
    ReorderStart{Có "đặt lại" hoặc "đơn gần nhất"?}
    ReorderContinue{metadata.isQuickReorder?}
    OrderStart{Có "đặt món" hoặc "đặt đơn"?}
    OrderProgress{Đang trong order flow?}
    CancelReply[Reset metadata và trả cancelOrder]
    ReorderStartFlow[QuickReorderFlow.start]
    ReorderContinueFlow[QuickReorderFlow.continue]
    OrderStartFlow[OrderConversationFlow.start]
    OrderContinue[OrderConversationFlow.continue]
    General[GeneralChatFlow.reply]
    End[Trả ChatReply]

    Start --> Normalize --> Cancel
    Cancel -->|Có| CancelReply --> End
    Cancel -->|Không| ReorderStart
    ReorderStart -->|Có| ReorderStartFlow --> End
    ReorderStart -->|Không| ReorderContinue
    ReorderContinue -->|Có| ReorderContinueFlow --> End
    ReorderContinue -->|Không| OrderStart
    OrderStart -->|Có| OrderStartFlow --> End
    OrderStart -->|Không| OrderProgress
    OrderProgress -->|Có| OrderContinue --> End
    OrderProgress -->|Không| General --> End
```

## 4. General chat flow

```mermaid
sequenceDiagram
    participant S as ChatService
    participant F as GeneralChatFlow
    participant P as ChatPromptService
    participant L as ChatLlmService
    participant R as ResponseParser

    S->>F: reply(message, context)
    F->>P: buildGeneralReplyPrompt()
    P-->>F: Prompt
    F->>L: callLocalLLM(prompt)
    L-->>F: Raw LLM text
    F->>R: parseGeneralReply(raw)
    R-->>F: ChatReply
    F-->>S: ChatReply
```

```mermaid
flowchart TD
    Input[User hỏi hoặc xin gợi ý] --> Prompt[Tạo general prompt]
    Prompt --> LLM[Gọi local LLM]
    LLM --> Parse{Parse được JSON?}
    Parse -->|Có| Reply[reply + suggestions + action]
    Parse -->|Không| Fallback[Dùng raw text làm reply]
    Reply --> Result[Trả frontend]
    Fallback --> Result
```

## 5. Order conversation flow

### 5.1. Các bước chính

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> CollectingItems: User nói đặt món
    CollectingItems --> ConfirmingItems: Tìm thấy món
    CollectingItems --> CollectingItems: Món không hợp lệ
    ConfirmingItems --> ConfirmingRestaurant: User xác nhận món
    ConfirmingRestaurant --> ChoosingAddress: User xác nhận nhà hàng
    ChoosingAddress --> ConfirmingAddress: User chọn địa chỉ
    ConfirmingAddress --> ChoosingPayment: User xác nhận địa chỉ
    ChoosingPayment --> Validating: User chọn COD hoặc card
    ChoosingPayment --> ChoosingPayment: Payment không hợp lệ
    Validating --> CreatingOrder: Validation hợp lệ
    Validating --> CollectingItems: Món không hợp lệ
    Validating --> ChoosingAddress: Địa chỉ không hợp lệ
    CreatingOrder --> Completed: Tạo order thành công
    Completed --> [*]
```

### 5.2. Sequence rút gọn

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend
    participant S as ChatService
    participant F as OrderFlow
    participant DB as Food / Address / Order
    participant LLM as Local LLM
    participant V as Validation

    UI->>S: "đặt món" + metadata
    S->>F: start()
    F-->>UI: Hỏi món cần đặt
    UI->>S: Tên món + số lượng
    S->>F: continue()
    F->>DB: Lấy menu và context
    F->>LLM: Phân tích món
    LLM-->>F: Danh sách món đề xuất
    F-->>UI: Hỏi xác nhận món và nhà hàng
    UI->>S: Xác nhận + chọn địa chỉ + payment
    S->>F: continue()
    F->>V: Validate từ database
    V-->>F: Validated order
    F->>DB: createOrder()
    DB-->>F: orderResponse
    F-->>UI: Thành công + orderId
```

### 5.3. Phân tích món

```mermaid
flowchart TD
    Input[User nhập món và số lượng]
    Prompt[Build order items prompt]
    LLM[Gọi local LLM]
    Parse[Parse JSON array]
    Empty{Danh sách rỗng?}
    Retry[Cho user nhập lại]
    Restaurant{Các món cùng restaurant?}
    RestaurantError[Báo các món khác cửa hàng]
    Save[Lưu vào metadata.orderItems]
    Confirm[Hiển thị summary và hỏi xác nhận]

    Input --> Prompt --> LLM --> Parse --> Empty
    Empty -->|Có| Retry
    Empty -->|Không| Restaurant
    Restaurant -->|Không| RestaurantError
    Restaurant -->|Có| Save --> Confirm
```

## 6. Quick reorder flow

```mermaid
flowchart TD
    Start[User nói đặt lại]
    History[Lấy 3 đơn gần đây]
    Choice[Hiển thị danh sách đơn]
    Select[User chọn số đơn]
    Refetch[Backend lấy lại order từ database]
    Address[Lấy địa chỉ đầu tiên hiện tại]
    Foods[Tìm lại từng món trong menu]
    Create[Tạo order mới bằng COD]
    Publish[Publish orderCreated]
    Done[Trả kết quả frontend]

    Start --> History --> Choice --> Select --> Refetch
    Refetch --> Address --> Foods --> Create --> Publish --> Done
```

> Implementation hiện tại tự dùng địa chỉ đầu tiên của user và chưa hỏi xác nhận địa chỉ trong quick reorder.

## 7. Validation trước khi tạo order

```mermaid
flowchart TD
    Start[User nhập payment]
    Payment{COD hoặc card?}
    AddressId{Có selectedAddress.id?}
    Belong{Address thuộc user?}
    Items{Có orderItems?}
    Food[Kiểm tra từng food trong database]
    Quantity{Quantity nguyên dương?}
    Exists{Food tồn tại?}
    SameRestaurant{Các món cùng restaurant?}
    Valid[ValidatedChatOrder]
    Create[OrderService.createOrder]
    Error[Trả lỗi và giữ user ở bước hiện tại]

    Start --> Payment
    Payment -->|Không| Error
    Payment -->|Có| AddressId
    AddressId -->|Không| Error
    AddressId -->|Có| Belong
    Belong -->|Không| Error
    Belong -->|Có| Items
    Items -->|Không| Error
    Items -->|Có| Food --> Quantity
    Quantity -->|Không| Error
    Quantity -->|Có| Exists
    Exists -->|Không| Error
    Exists -->|Có| SameRestaurant
    SameRestaurant -->|Không| Error
    SameRestaurant -->|Có| Valid --> Create
```

Nguyên tắc:

```txt
LLM / client đề xuất món
        ↓
Backend lấy lại dữ liệu từ database
        ↓
ChatOrderValidationService xác thực
        ↓
OrderService tạo order
```

## 8. Error và fallback

```mermaid
flowchart TD
    Request[Chat request]
    Service[ChatService]
    LLM[Local LLM]
    Parser[Response parser]
    Retry[Cho user thử lại]
    Generic[Lỗi hệ thống chung]

    Request --> Service
    Service -->|Lỗi flow| Generic
    LLM -->|Timeout / không kết nối| Retry
    Parser -->|JSON order lỗi| Retry
    Parser -->|JSON general lỗi| Generic
```

## 9. Bản đồ file

```mermaid
flowchart TD
    Controller[chat.controller.ts] --> Service[chat.service.ts]
    Service --> Flows[flows/]
    Service --> Utils[utils/]
    Service --> Types[types/]
    Flows --> General[general-chat-flow.service.ts]
    Flows --> Order[order-conversation-flow.service.ts]
    Flows --> Reorder[quick-reorder-flow.service.ts]
    Flows --> Services[services/]
    Services --> LLM[LLM / Prompt / Parser]
    Services --> OrderSupport[Validation / Publisher / Context]
```

| File | Vai trò |
|---|---|
| `chat.controller.ts` | Nhận `POST /chat`, auth và gọi service |
| `chat.service.ts` | Điều phối và chọn flow |
| `chat.module.ts` | Đăng ký controller, provider và module phụ thuộc |
| `dto/chat-request.dto.ts` | Validate request body |
| `general-chat-flow.service.ts` | Chat/gợi ý món thông thường |
| `order-conversation-flow.service.ts` | Đặt món từng bước |
| `quick-reorder-flow.service.ts` | Đặt lại đơn gần đây |
| `chat-context.service.ts` | Lấy menu và lịch sử order |
| `chat-llm.service.ts` | Gọi local LLM hoặc Gemini |
| `chat-prompt.service.ts` | Tạo prompt cho LLM |
| `chat-response-parser.service.ts` | Parse output LLM |
| `chat-order-validation.service.ts` | Kiểm tra order trước khi tạo |
| `order-created-publisher.service.ts` | Publish event `orderCreated` |
| `chat.types.ts` | Định nghĩa type/interface |
| `chat-metadata.factory.ts` | Tạo và normalize metadata |

## 10. Lưu ý khi đọc flow

1. Metadata hiện do client gửi lại, nên không được tin tuyệt đối.
2. LLM chỉ giúp hiểu ngôn ngữ; backend/database quyết định dữ liệu order hợp lệ.
3. Boolean state có thể mâu thuẫn; về lâu dài nên chuyển sang một field `step`.
4. Quick reorder hiện chọn địa chỉ đầu tiên và chưa hỏi xác nhận địa chỉ.
5. Nên bổ sung test cho các flow trước khi refactor lớn.
