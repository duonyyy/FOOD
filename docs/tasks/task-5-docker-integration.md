# Task: Docker Integration & Test

## Mục tiêu
Kết nối 2 server (NestJS + Python AI) qua Docker Compose và test end-to-end.

## Tiền điều kiện
- `foodee-ai/` đã hoàn chỉnh (Task 1-3), có Dockerfile.
- `foodee-be/` đã sửa xong (Task 4), gọi Python server qua `AI_SERVER_URL`.

## Files cần sửa/tạo

### 1. SỬA `foodee-be/docker-compose.yml`

Thêm service `ai-server`:

```yaml
  ai-server:
    build:
      context: ../foodee-ai
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - ../foodee-ai/.env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

Trong service `api` (NestJS), thêm:

```yaml
    depends_on:
      ai-server:
        condition: service_healthy
    environment:
      - AI_SERVER_URL=http://ai-server:8000
```

### 2. TẠO `foodee-ai/.env` (copy từ `.env.example`)

```env
AI_SERVER_PORT=8000
GEMINI_API_KEY=
CHAT_LLM_BASE_URL=http://host.docker.internal:1234/v1
CHAT_LLM_MODEL=qwen/qwen2.5-vl-7b
CHAT_LLM_TEMPERATURE=0.3
CHAT_LLM_TIMEOUT_MS=8000
LLM_PROVIDER=local
```

> Lưu ý: Trong Docker, `CHAT_LLM_BASE_URL` dùng `host.docker.internal` thay vì `127.0.0.1` để truy cập LM Studio trên máy host.

## Verify

### Chạy Docker
```bash
cd foodee-be
docker-compose up --build
```

Kiểm tra:
- [ ] Cả 2 service start thành công
- [ ] `ai-server` health check pass
- [ ] `api` service chờ `ai-server` healthy trước khi start

### Test API
```bash
# Health check Python server
curl http://localhost:8000/health
# → {"status":"ok"}

# Test chat qua NestJS (cần auth token)
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"userMessage": "có món gì ngon?"}'
```

### Test flow chatbot
1. Chat thông thường: hỏi thực đơn → nhận gợi ý
2. Đặt món: "đặt món" → chọn món → xác nhận → chọn địa chỉ → thanh toán
3. Quick reorder: "đặt lại" → chọn đơn cũ
4. Hủy: "hủy" → flow bị hủy
5. AI server chết: tắt ai-server → NestJS trả error message phù hợp

## Lưu ý
- Đọc file `docker-compose.yml` hiện tại trước khi sửa, giữ nguyên các service đang có.
- `AI_SERVER_URL` trong Docker Compose phải dùng tên service (`http://ai-server:8000`), không dùng `localhost`.
