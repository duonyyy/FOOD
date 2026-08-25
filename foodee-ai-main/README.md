# 🍜 Foodee AI — Vietnamese Food Detection & Classification Microservice

Dịch vụ AI phát hiện và phân loại món ăn Việt Nam từ ảnh và video, được thiết kế theo kiến trúc **Clean Modular Microservice**, kết hợp mô hình **YOLOv8** (Object Detection) và **Google LiteRT / EfficientNet-B2** (30-class Classification) đạt độ trễ cực thấp và khả năng mở rộng production cao.

---

## 🧠 Cấu trúc Thư mục & Kiến trúc Hệ thống

```
foodee-ai-main/
├── app/
│   ├── __init__.py            # Application factory, extensions & error handlers
│   ├── config.py              # Dynamic configuration & environment variables
│   ├── labels.py              # 30 Vietnamese food classes mapping
│   ├── observability.py       # Structured JSON Logging & X-Request-ID tracking
│   ├── validators.py          # Magic Bytes binary validation & security checks
│   ├── api/                   # Modular Controller Blueprints
│   │   ├── __init__.py        # API Blueprint aggregator
│   │   ├── web.py             # GET / (Web Demo UI)
│   │   ├── image.py           # POST /image
│   │   ├── video.py           # POST /video & GET /video
│   │   ├── download.py        # GET /download/<type>
│   │   └── health.py          # GET /health & GET /ready probes
│   ├── services/              # Core Business & AI Services
│   │   ├── inference.py       # YOLOv8 + LiteRT / TFLite pipeline with Letterbox
│   │   ├── cache.py           # Thread-safe LRU + TTL Classification Cache
│   │   ├── media.py           # Video processing & H.264 Web Streaming
│   │   ├── storage.py         # UUID Job Storage Isolation & Sandbox Manager
│   │   └── tracking.py        # IoU-based FoodTracker & Deduplication
│   └── templates/
│       └── demo.html          # Web UI demo upload
├── models/
│   ├── classification/        # EfficientNet-B2 Float16 LiteRT model
│   └── detection/             # YOLOv8 Object Detection model
├── samples/                   # Sample images & videos for verification
├── scripts/                   # Evaluation & Model conversion utilities
├── tests/                     # 90+ Comprehensive Pytest Test Suite
├── Dockerfile                 # Multi-stage production container
├── docker-compose.yml         # Container orchestration setup
├── gunicorn.conf.py           # Production Gunicorn worker & memory config
├── requirements.txt           # Lightweight runtime dependencies (< 200MB)
└── requirements-dev.txt       # Development & Pytest testing dependencies
```

---

## 🍽️ Danh mục 30 Món ăn Việt Nam Hỗ trợ

| STT | Tên món             | STT | Tên món             | STT | Tên món             |
|:---:|:--------------------|:---:|:--------------------|:---:|:--------------------|
| 1   | Bánh bèo            | 11  | Bánh pía            | 21  | Canh chua           |
| 2   | Bánh bột lọc        | 12  | Bánh tét            | 22  | Cao lầu             |
| 3   | Bánh căn            | 13  | Bánh tráng nướng    | 23  | Cháo lòng           |
| 4   | Bánh canh           | 14  | Bánh xèo            | 24  | Cơm tấm             |
| 5   | Bánh chưng          | 15  | Bún bò Huế          | 25  | Gỏi cuốn            |
| 6   | Bánh cuốn           | 16  | Bún đậu mắm tôm     | 26  | Hủ tiếu             |
| 7   | Bánh đúc            | 17  | Bún mắm             | 27  | Mì Quảng            |
| 8   | Bánh giò            | 18  | Bún riêu            | 28  | Nem chua            |
| 9   | Bánh khọt           | 19  | Bún thịt nướng      | 29  | Phở                 |
| 10  | Bánh mì             | 20  | Cá kho tộ           | 30  | Xôi xéo             |

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Cách 1: Khởi chạy Nhanh với Docker Compose (Khuyên dùng cho Production)

```bash
docker compose up --build -d
```
- Server sẵn sàng tại: `http://localhost:5000`
- Tự động kích hoạt Healthcheck và Persistent Storage Volume.

---

### Cách 2: Khởi chạy Môi trường Local (Python Virtualenv)

#### 1. Khởi tạo môi trường ảo và cài đặt dependencies:
```bash
python -m venv .venv

# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

# Linux / macOS:
source .venv/bin/activate
pip install -r requirements-dev.txt
```

#### 2. Khởi chạy Server:

**Development Mode:**
```bash
flask --app app run --host=0.0.0.0 --port=5000
```

**Production Mode (Gunicorn):**
```bash
gunicorn --config gunicorn.conf.py app:app
```

---

## 📡 API Reference & Ví dụ cURL

### 1. `GET /health` — Liveness Probe
Kiểm tra tình trạng sống của server.

```bash
curl -X GET http://localhost:5000/health
```

**Response (`200 OK`):**
```json
{
  "service": "foodee-ai",
  "status": "healthy",
  "uptime_seconds": 12.34,
  "version": "1.0.0"
}
```

---

### 2. `GET /ready` — Readiness Probe
Kiểm tra mô hình AI (YOLO + LiteRT) đã nạp sẵn sàng vào RAM và thư mục storage đã mở quyền ghi.

```bash
curl -X GET http://localhost:5000/ready
```

**Response (`200 OK`):**
```json
{
  "status": "ready",
  "checks": {
    "classifier_model": true,
    "detection_model": true,
    "storage_ready": true
  },
  "version": "1.0.0"
}
```

---

### 3. `POST /image` — Nhận diện Món ăn trong Ảnh
Hỗ trợ trường multipart `image` hoặc `file`.

```bash
curl -X POST http://localhost:5000/image \
  -F "image=@samples/images/pho.jpg"
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "job_id": "a1b2c3d4e5f6...",
  "total_detections": 1,
  "detections": [
    {
      "class_id": 28,
      "class_name": "Phở",
      "detection_confidence": 0.98,
      "classification_confidence": 0.81,
      "bbox": { "x1": 87, "y1": 25, "x2": 219, "y2": 146 }
    }
  ],
  "class_counts": {
    "Phở": 1
  }
}
```

---

### 4. `POST /video` — Nhận diện & Đếm Món ăn trong Video
Phân tích video theo FPS target, theo dõi đối tượng với thuật toán FoodTracker IoU và xuất video H.264.

```bash
curl -X POST http://localhost:5000/video \
  -F "file=@samples/videos/output_video.mp4"
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "job_id": "f8e7d6c5b4a3...",
  "video_processed": true,
  "total_items": 9,
  "food_detections": [
    { "food_name": "Bánh chưng", "count": 5 },
    { "food_name": "Bánh giò", "count": 3 },
    { "food_name": "Bánh tét", "count": 1 }
  ]
}
```

---

### 5. `GET /download/<file_type>` — Tải Ảnh/Video Kết quả
Hỗ trợ tải theo `job_id` cô lập hoặc file fallback tương thích ngược.

```bash
# Tải ảnh kết quả theo job_id:
curl "http://localhost:5000/download/image?job_id=a1b2c3d4e5f6..." --output result.jpg

# Tải video kết quả:
curl "http://localhost:5000/download/video?job_id=f8e7d6c5b4a3..." --output result.mp4
```

---

## ⚙️ Biến Môi trường Cấu hình (`.env`)

| Biến môi trường | Mặc định | Ý nghĩa |
| :--- | :---: | :--- |
| `FOOD_DETECTION_CONFIDENCE` | `0.1` | Ngưỡng tin cậy phát hiện vật thể YOLO |
| `FOOD_DETECTION_IOU` | `0.35` | Ngưỡng NMS IoU cho YOLO |
| `FOOD_CLASSIFICATION_CONFIDENCE` | `0.5` | Ngưỡng tin cậy phân loại EfficientNet |
| `FOOD_VIDEO_TARGET_FPS` | `6` | Tần suất lấy mẫu phân tích frame video |
| `FOOD_CACHE_SIZE` | `1024` | Số lượng ROI crop lưu trong LRU Cache |
| `FOOD_CACHE_TTL` | `60` | Thời gian sống (giây) của kết quả trong cache |
| `FOOD_LETTERBOX_ENABLED` | `false` | Bật/tắt bảo toàn tỷ lệ khung hình Letterbox |
| `FOOD_ALLOWED_ORIGINS` | `*` | Cấu hình CORS Allowed Origins |
| `GUNICORN_WORKERS` | `2` | Số lượng tiến trình Gunicorn worker |
| `GUNICORN_THREADS` | `2` | Số luồng gthread cho mỗi worker |
| `GUNICORN_TIMEOUT` | `120` | Thời gian chờ tối đa cho request video |

---

## 🧪 Kiểm thử Tự động & Đánh giá Mô hình

### Chạy toàn bộ Test Suite (90+ Test Cases):
```bash
pytest tests/ -v
```

### Chạy Đánh giá Độ chính xác & F1-Score:
```bash
python scripts/evaluate_models.py
```

---

## 🛡️ Ma trận Bảo mật & Phòng vệ (Security Hardening)

* **Magic Bytes Header Verification:** Kiểm tra trực tiếp header nhị phân (`FF D8 FF`, `89 50 4E 47`, `52 49 46 46`, `66 74 79 70`), loại bỏ 100% rủi ro upload mã độc ngụy trang đuôi ảnh.
* **Path Traversal Protection:** Chặn tuyệt đối ký tự `..`, `/` và cô lập truy cập trong thư mục sandbox `runtime/jobs/{job_id}`.
* **Safe Model Deserialization:** Sử dụng `torch.load(weights_only=True)` loại bỏ nguy cơ RCE từ file pickle độc hại.
* **Non-Root Docker Execution:** Chạy dịch vụ dưới user `appuser` (UID 10001) giảm thiểu tối đa rủi ro leo thang đặc quyền.
