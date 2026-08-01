# Task: Tạo Python AI Server (FastAPI skeleton)

## Mục tiêu
Tạo project `foodee-ai/` ngang hàng với `foodee-be/`, chạy được FastAPI server với health check endpoint.

## Cấu trúc cần tạo

```
foodee-ai/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS middleware, mount routers
│   ├── config.py            # Pydantic Settings đọc .env
│   ├── routers/
│   │   ├── __init__.py
│   │   └── chat.py          # Placeholder router (chỉ có GET /health)
│   ├── services/
│   │   └── __init__.py
│   ├── models/
│   │   └── __init__.py
│   └── utils/
│       └── __init__.py
├── requirements.txt
├── .env.example
├── .gitignore
├── Dockerfile
└── README.md
```

## Chi tiết từng file

### `requirements.txt`
```
fastapi==0.115.*
uvicorn[standard]==0.34.*
httpx==0.28.*
pydantic==2.*
pydantic-settings==2.*
python-dotenv==1.*
```

### `.env.example`
```env
AI_SERVER_PORT=8000
GEMINI_API_KEY=your_gemini_api_key_here
CHAT_LLM_BASE_URL=http://127.0.0.1:1234/v1
CHAT_LLM_MODEL=qwen/qwen2.5-vl-7b
CHAT_LLM_TEMPERATURE=0.3
CHAT_LLM_TIMEOUT_MS=8000
LLM_PROVIDER=local
```

### `app/config.py`
Dùng `pydantic-settings` `BaseSettings` để đọc env vars:
- `ai_server_port: int = 8000`
- `gemini_api_key: str = ""`
- `chat_llm_base_url: str = "http://127.0.0.1:1234/v1"`
- `chat_llm_model: str = "qwen/qwen2.5-vl-7b"`
- `chat_llm_temperature: float = 0.3`
- `chat_llm_timeout_ms: int = 8000`
- `llm_provider: str = "local"`
- Dùng `@lru_cache` cho hàm `get_settings()` để singleton.

### `app/main.py`
- Tạo `FastAPI()` app với title `"Foodee AI Server"`.
- Thêm `CORSMiddleware` (allow all origins cho dev).
- Mount `chat.router`.
- Có route `GET /health` trả `{"status": "ok"}`.

### `app/routers/chat.py`
- Tạo `APIRouter(prefix="/api/chat", tags=["chat"])`.
- Có 1 endpoint `GET /health` trả `{"status": "ok"}`.

### `Dockerfile`
- Base image: `python:3.11-slim`
- `WORKDIR /app`
- Copy `requirements.txt`, `pip install --no-cache-dir`
- Copy toàn bộ source
- `EXPOSE 8000`
- `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`

### `.gitignore`
```
__pycache__/
*.pyc
*.pyo
.env
venv/
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
```

### `README.md`
Hướng dẫn cài đặt (venv, pip install), cấu hình (.env), chạy server (uvicorn), và Docker.

## Verify
```bash
cd foodee-ai
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# Test: curl http://localhost:8000/health → {"status":"ok"}
```

## Lưu ý
- **KHÔNG sửa file nào ở `foodee-be/`.**
- Chỉ tạo mới toàn bộ.
