# Task: Sửa NestJS gọi sang Python Server

## Mục tiêu
Sửa `foodee-be` chat module để gọi Python AI server (`http://localhost:8000`) thay vì gọi LLM trực tiếp. Xóa các file prompt/parser không còn cần.

## Tiền điều kiện
- Python AI server (`foodee-ai/`) đã hoạt động với 2 endpoints:
  - `POST /api/chat/general-reply` → trả `{ reply, suggestions, action }`
  - `POST /api/chat/parse-order-items` → trả `{ orderItems: [{id, name, quantity, price, restaurantId}] }`

## Files cần sửa/xóa

### 1. SỬA `src/modules/chat/services/chat-llm.service.ts`

Thay **toàn bộ** nội dung file. Logic mới:

- Xóa hàm `callGemini()` và `callLocalLLM()`.
- Xóa hàm `getLocalBaseUrl()` và `getTimeoutMs()`.
- Thêm hàm `getAiServerUrl()`: đọc `AI_SERVER_URL` từ ConfigService, mặc định `http://localhost:8000`.
- Thêm hàm `getTimeoutMs()`: đọc `AI_SERVER_TIMEOUT_MS` từ ConfigService, mặc định `10000`.
- Thêm 2 hàm mới:

```typescript
async getGeneralReply(userMessage: string, menuFlat: ChatMenuItem[]): Promise<ChatReply> {
  // POST đến ${AI_SERVER_URL}/api/chat/general-reply
  // Body: { userMessage, menuFlat }
  // Response: { reply, suggestions, action }
  // Error handling: trả { reply: "..error message tiếng Việt..", action: undefined }
}

async parseOrderItems(userMessage: string, menuFlat: ChatMenuItem[]): Promise<ChatOrderItem[]> {
  // POST đến ${AI_SERVER_URL}/api/chat/parse-order-items
  // Body: { userMessage, menuFlat }
  // Response: { orderItems: [...] }
  // Error handling: trả []
}
```

- Dùng `axios.post()` (đã có trong project).
- Import `ChatMenuItem` và `ChatOrderItem` từ `../types/chat.types`.
- Import `ChatReply` từ `../types/chat.types`.
- Error handling cho cả 2 hàm:
  - Log error: `console.error('[AI Server Error]', error.message)`
  - `ECONNREFUSED` → message: `"Không kết nối được với AI Server. Vui lòng kiểm tra AI Server đang chạy chưa."`
  - Exception khác → message: `"Xin lỗi, hệ thống đang bận. Bạn thử lại sau vài giây nhé?"`

### 2. SỬA `src/modules/chat/flows/general-chat-flow.service.ts`

**Trước:**
```typescript
import { ChatLlmService } from '../services/chat-llm.service';
import { ChatPromptService } from '../services/chat-prompt.service';
import { ChatResponseParserService } from '../services/chat-response-parser.service';

constructor(
  private readonly promptService: ChatPromptService,
  private readonly llmService: ChatLlmService,
  private readonly parserService: ChatResponseParserService,
) {}

async reply(userMessage: string, context: ChatContext): Promise<ChatReply> {
  const prompt = this.promptService.buildGeneralReplyPrompt(userMessage, context.menuFlat);
  const raw = await this.llmService.callLocalLLM(prompt);
  return this.parserService.parseGeneralReply(raw);
}
```

**Sau:**
```typescript
import { ChatLlmService } from '../services/chat-llm.service';

constructor(
  private readonly llmService: ChatLlmService,
) {}

async reply(userMessage: string, context: ChatContext): Promise<ChatReply> {
  return this.llmService.getGeneralReply(userMessage, context.menuFlat);
}
```

Xóa import `ChatPromptService` và `ChatResponseParserService`.

### 3. SỬA `src/modules/chat/flows/order-conversation-flow.service.ts`

Trong hàm `collectOrderItems()`, thay:
```typescript
// TRƯỚC:
const prompt = this.promptService.buildOrderItemsPrompt(userMessage, context.menuFlat);
const response = await this.llmService.callLocalLLM(prompt);
const foodList = this.parserService.parseOrderItems(response);

// SAU:
const foodList = await this.llmService.parseOrderItems(userMessage, context.menuFlat);
```

Trong constructor, xóa:
- `private readonly promptService: ChatPromptService`
- `private readonly parserService: ChatResponseParserService`

Xóa import:
- `import { ChatPromptService } from '../services/chat-prompt.service';`
- `import { ChatResponseParserService } from '../services/chat-response-parser.service';`

### 4. XÓA 2 files
- `src/modules/chat/services/chat-prompt.service.ts`
- `src/modules/chat/services/chat-response-parser.service.ts`

### 5. SỬA `src/modules/chat/chat.module.ts`

Xóa khỏi `providers`:
- `ChatPromptService`
- `ChatResponseParserService`

Xóa imports tương ứng ở đầu file:
- `import { ChatPromptService } from './services/chat-prompt.service';`
- `import { ChatResponseParserService } from './services/chat-response-parser.service';`

### 6. THÊM env vars vào `.env`

Thêm 2 dòng:
```
AI_SERVER_URL=http://localhost:8000
AI_SERVER_TIMEOUT_MS=10000
```

## Verify

```bash
cd foodee-be
npm run build
```

Build phải thành công, không có lỗi import hay reference đến file đã xóa.

## Lưu ý
- **KHÔNG sửa file nào ở `foodee-ai/`.**
- Giữ nguyên tất cả file khác trong chat module (chat.service.ts, chat.controller.ts, chat-context.service.ts, chat-order-validation.service.ts, order-created-publisher.service.ts, types, utils, dto).
- `ChatLlmService` vẫn giữ `@Injectable()` decorator và inject `ConfigService`.
