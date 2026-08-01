# Task: Port AI Logic sang Python (services + models)

## Mục tiêu
Chuyển logic gọi LLM, build prompt, parse response từ NestJS sang Python trong project `foodee-ai/`.

## Files tham khảo (KHÔNG SỬA, chỉ đọc)
- `foodee-be/src/modules/chat/services/chat-llm.service.ts`
- `foodee-be/src/modules/chat/services/chat-prompt.service.ts`
- `foodee-be/src/modules/chat/services/chat-response-parser.service.ts`
- `foodee-be/src/modules/chat/types/chat.types.ts`

## Files cần tạo

### 1. `app/models/chat_request.py` — Pydantic request models

```python
from pydantic import BaseModel

class ChatMenuItem(BaseModel):
    id: str
    name: str
    price: float
    description: str | None = None
    image: str = ""
    link: str = ""
    restaurantId: str

class GeneralReplyRequest(BaseModel):
    userMessage: str
    menuFlat: list[ChatMenuItem] = []

class ParseOrderItemsRequest(BaseModel):
    userMessage: str
    menuFlat: list[ChatMenuItem] = []
```

### 2. `app/models/chat_response.py` — Pydantic response models

```python
from pydantic import BaseModel

class ChatSuggestion(BaseModel):
    id: str
    name: str
    price: float
    image: str = ""
    link: str = ""

class GeneralReplyResponse(BaseModel):
    reply: str
    suggestions: list[ChatSuggestion] = []
    action: str | None = None

class OrderItem(BaseModel):
    id: str
    name: str
    quantity: int
    price: float = 0
    restaurantId: str

class ParseOrderItemsResponse(BaseModel):
    orderItems: list[OrderItem] = []
```

### 3. `app/services/llm_service.py` — Gọi LLM

Port từ `chat-llm.service.ts`. Yêu cầu:

- Class `LlmService` nhận `Settings` từ `app/config.py`.
- `async call_llm(prompt: str) -> str`: Router chọn gemini hoặc local dựa trên `settings.llm_provider`.
- `async call_gemini(prompt: str) -> str`: POST đến Gemini API `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`. Gửi `{"contents": [{"role": "user", "parts": [{"text": prompt}]}]}`. Trả về `candidates[0].content.parts[0].text`, fallback `"Xin lỗi, mình chưa rõ."`.
- `async call_local_llm(prompt: str) -> str`: POST đến `{base_url}/chat/completions` (OpenAI-compatible). Body gồm:
  - `model`: từ config
  - `messages`: system message `"Bạn là FoodieBot - trợ lý đặt món ăn vui vẻ, thân thiện, nói tiếng Việt tự nhiên và ngắn gọn."` + user message
  - `temperature`: từ config
  - `max_tokens`: 1024
  - `stream`: false
  Trả về `choices[0].message.content`, fallback `"Xin lỗi, mình chưa hiểu rõ."`.
- Error handling: `ConnectError` → `"Không kết nối được với LM Studio..."`, exception khác → `"Xin lỗi, hệ thống đang bận..."`.
- Dùng `httpx.AsyncClient` với timeout = `settings.chat_llm_timeout_ms / 1000`.

### 4. `app/services/prompt_service.py` — Build prompt

Port từ `chat-prompt.service.ts`. Yêu cầu:

- Class `PromptService` với 2 static methods.
- `build_order_items_prompt(user_message, menu_flat)`: Giữ nguyên nội dung prompt tiếng Việt. Chỉ lấy 15 món đầu. Yêu cầu LLM trả JSON array `[{"id":"...", "name":"...", "quantity":1, "restaurantId":"..."}]`.
- `build_general_reply_prompt(user_message, menu_flat)`: Giữ nguyên nội dung prompt tiếng Việt. Chỉ lấy 12 món đầu. Yêu cầu LLM trả JSON `{"reply":"...", "suggestions":[], "action":"asking"}`.

### 5. `app/services/response_parser.py` — Parse LLM output

Port từ `chat-response-parser.service.ts`. Yêu cầu:

- Class `ResponseParser` với class methods.
- `parse_order_items(raw: str) -> list[OrderItem]`: Extract JSON array từ raw text, parse, validate mỗi item (phải có id, name, restaurantId; quantity > 0; price >= 0).
- `parse_general_reply(raw: str) -> GeneralReplyResponse`: Extract JSON object, parse reply/suggestions/action. Fallback trả raw text nếu parse fail.
- Private helpers: `_strip_fence()` xóa markdown code fences, `_extract_json_array()`, `_extract_json_object()` dùng regex, `_normalize_suggestions()`, `_normalize_order_item()`.

## Verify
```python
# Test response_parser.py
from app.services.response_parser import ResponseParser

# Test parse order items
raw = '```json\n[{"id":"1","name":"Phở bò","quantity":2,"restaurantId":"r1"}]\n```'
items = ResponseParser.parse_order_items(raw)
assert len(items) == 1
assert items[0].name == "Phở bò"
assert items[0].quantity == 2

# Test parse general reply
raw2 = '{"reply":"Chào bạn!","suggestions":[],"action":"asking"}'
reply = ResponseParser.parse_general_reply(raw2)
assert reply.reply == "Chào bạn!"
```

## Lưu ý
- **KHÔNG sửa file nào ở `foodee-be/`.**
- Giữ nguyên nội dung prompt tiếng Việt và error message tiếng Việt từ code TS gốc.
