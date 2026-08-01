# Task: Tạo API Endpoints trên Python Server

## Mục tiêu
Hoàn thiện `app/routers/chat.py` với 2 endpoints chính, kết nối các services đã tạo ở giai đoạn trước.

## Tiền điều kiện
- Đã hoàn thành Task 1 (FastAPI skeleton) và Task 2 (AI services).
- Các file sau đã tồn tại:
  - `app/services/llm_service.py`
  - `app/services/prompt_service.py`
  - `app/services/response_parser.py`
  - `app/models/chat_request.py`
  - `app/models/chat_response.py`

## Files cần sửa

### 1. Sửa `app/routers/chat.py`

Thay nội dung hiện tại (chỉ có health check) bằng router đầy đủ:

```python
from fastapi import APIRouter, HTTPException
from app.models.chat_request import GeneralReplyRequest, ParseOrderItemsRequest
from app.models.chat_response import GeneralReplyResponse, ParseOrderItemsResponse
from app.services.llm_service import LlmService
from app.services.prompt_service import PromptService
from app.services.response_parser import ResponseParser

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Service instances
_llm_service = LlmService()
_prompt_service = PromptService()
_parser = ResponseParser()
```

#### Endpoint 1: `POST /api/chat/general-reply`
- Input: `GeneralReplyRequest` (userMessage, menuFlat)
- Output: `GeneralReplyResponse` (reply, suggestions, action)
- Flow: `prompt_service.build_general_reply_prompt()` → `llm_service.call_llm()` → `parser.parse_general_reply()`
- Error: HTTP 500 với message tiếng Việt

#### Endpoint 2: `POST /api/chat/parse-order-items`
- Input: `ParseOrderItemsRequest` (userMessage, menuFlat)
- Output: `ParseOrderItemsResponse` (orderItems)
- Flow: `prompt_service.build_order_items_prompt()` → `llm_service.call_llm()` → `parser.parse_order_items()`
- Error: HTTP 500 với message tiếng Việt

#### Giữ lại: `GET /api/chat/health`
- Output: `{"status": "ok"}`

### 2. Kiểm tra `app/main.py`

Đảm bảo router được mount đúng:
```python
from app.routers import chat
app.include_router(chat.router)
```

## Verify

Chạy server và test bằng curl:

```bash
# Health check
curl http://localhost:8000/health
# → {"status":"ok"}

curl http://localhost:8000/api/chat/health
# → {"status":"ok"}

# General reply (sẽ gọi LLM thật nếu LM Studio đang chạy)
curl -X POST http://localhost:8000/api/chat/general-reply \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "có món gì ngon?", "menuFlat": [{"id":"1","name":"Phở bò","price":45000,"restaurantId":"r1"}]}'

# Parse order items
curl -X POST http://localhost:8000/api/chat/parse-order-items \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "cho mình 2 phở bò", "menuFlat": [{"id":"1","name":"Phở bò","price":45000,"restaurantId":"r1"}]}'
```

## Lưu ý
- **KHÔNG sửa file nào ở `foodee-be/`.**
- Cả 2 endpoint đều phải có try/except, trả HTTP 500 với message tiếng Việt khi LLM fail.
