# 🍜 Foodee AI — Vietnamese Food Detection API

Dịch vụ AI phát hiện và phân loại món ăn Việt Nam từ ảnh và video, được xây dựng trên nền tảng **Flask**, sử dụng mô hình **YOLOv5/Ultralytics** để phát hiện vật thể và **TensorFlow Lite EfficientNet** để phân loại 30 món ăn truyền thống Việt Nam.

---

## 🧠 Kiến trúc hệ thống

```
foodee-ai-main/
├── app/
│   ├── __init__.py        # Application factory và model service
│   ├── config.py          # Đường dẫn model và cấu hình runtime
│   ├── labels.py          # Thứ tự 30 nhãn phân loại
│   ├── routes.py          # HTTP blueprint, không chứa AI logic
│   ├── services/
│   │   ├── inference.py   # YOLO + TFLite batch inference
│   │   ├── media.py       # Xử lý và ghi video
│   │   └── tracking.py    # Tracking và đếm object
│   └── templates/         # Giao diện demo upload ảnh/video
├── docs/
│   └── model_improvement_guide.md
├── models/
│   ├── classification/    # TFLite classifier dùng khi chạy app
│   ├── detection/
│   │   └── detection.pt
│   └── legacy/
│       ├── deploy.prototxt
│       └── res10_300x300_ssd_iter_140000.caffemodel
├── runtime/               # Nơi app ghi file tạm và kết quả xử lý
├── samples/
│   ├── images/            # Ảnh mẫu để test API
│   └── videos/            # Video mẫu để test API
├── requirements.txt       # Danh sách dependencies
└── testFlask.py           # Entry point khởi chạy Flask
```

### Pipeline xử lý hai giai đoạn

```
Ảnh / Video đầu vào
       │
       ▼
┌─────────────────────┐
│  YOLOv5 Detection   │  → Phát hiện vùng chứa thực phẩm (bounding box)
│  (models/detection/ │    Ngưỡng confidence: 0.5
│   detection.pt)     │
└─────────────────────┘
       │ ROI (vùng cắt ra)
       ▼
┌─────────────────────┐
│  EfficientNet TFLite│  → Phân loại tên món ăn từ 30 nhãn
│  (classifier_b2_    │    Resize → 260×260 → Normalize → Inference
│   finetuned_...     │
│   float16.tflite)   │
└─────────────────────┘
       │
       ▼
 JSON Response (tên món, tọa độ bbox, confidence)
```

---

## 🍽️ Danh sách 30 món ăn được hỗ trợ

| STT | Tên món             | STT | Tên món             | STT | Tên món             |
|-----|---------------------|-----|---------------------|-----|---------------------|
| 1   | Bánh bèo            | 11  | Bánh pía            | 21  | Canh chua           |
| 2   | Bánh bột lọc        | 12  | Bánh tét            | 22  | Cao lầu             |
| 3   | Bánh căn            | 13  | Bánh tráng nướng    | 23  | Cháo lòng           |
| 4   | Bánh canh           | 14  | Bánh xèo            | 24  | Cơm tấm             |
| 5   | Bánh chưng          | 15  | Bún bò Huế          | 25  | Gỏi cuốn            |
| 6   | Bánh cuốn           | 16  | Bún đậu mắm tôm     | 26  | Hủ tiếu             |
| 7   | Bánh đúc            | 17  | Bún mắm             | 27  | Mì quảng            |
| 8   | Bánh giò            | 18  | Bún riêu            | 28  | Nem chua            |
| 9   | Bánh khọt           | 19  | Bún thịt nướng      | 29  | Phở                 |
| 10  | Bánh mì             | 20  | Cá kho tộ           | 30  | Xôi xéo             |

---

## 🚀 Cài đặt & Chạy

### Yêu cầu hệ thống

- Python 3.10+
- pip

### 1. Clone và cài đặt dependencies

```bash
git clone https://github.com/your-org/foodee-ai.git
cd foodee-ai-main

python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Nếu cần chạy notebook huấn luyện hoặc chuyển đổi model, cài thêm `requirements-training.txt` hoặc `requirements-conversion.txt` tương ứng.

### 2. Chuẩn bị model files

Đảm bảo các file model sau tồn tại đúng vị trí:

| File | Mô tả | Kích thước |
|------|-------|-----------|
| `models/detection/detection.pt` | YOLOv5 model phát hiện thực phẩm | ~22 MB |
| `models/classification/classifier_b2_finetuned_from_pth_float16.tflite` | EfficientNet-B2 TFLite float16 phân loại 30 món | ~15,5 MB |

> **Lưu ý:** Ứng dụng hiện sử dụng model float16 được chuyển từ checkpoint PyTorch `.pth`. Các script chuyển đổi nằm trong `scripts/`.

### 3. Chuyển checkpoint PyTorch sang TFLite

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-conversion.txt
.\.venv\Scripts\python.exe scripts/convert_pth_to_onnx.py
onnx2tf -i runtime/efficientnet_b2_food.onnx -o runtime/efficientnet_b2_food_saved_model
.\.venv\Scripts\python.exe scripts/convert_saved_model_to_tflite.py
```

Model chạy production là `models/classification/classifier_b2_finetuned_from_pth_float16.tflite`. Checkpoint `.pth` và notebook chỉ cần giữ lại khi muốn huấn luyện hoặc chuyển đổi model.

### 4. Khởi chạy server

```bash
# Development mode
.\.venv\Scripts\python.exe -m flask --app testFlask run --host=0.0.0.0 --port=5000

# Hoặc production mode với Gunicorn
.\.venv\Scripts\python.exe -m gunicorn -w 4 -b 0.0.0.0:5000 "testFlask:app"
```

Server sẽ chạy tại: `http://localhost:5000`

### Cấu hình ngưỡng nhận diện

Ứng dụng mặc định chỉ giữ bounding box YOLO có confidence từ `0.1` và IoU NMS `0.35`, sau đó chỉ nhận tên món khi EfficientNet có confidence từ `0.5`. Detection không đủ confidence phân loại sẽ bị loại và không được cộng vào thống kê.

Có thể thay đổi ngưỡng khi khởi chạy PowerShell:

```powershell
$env:FOOD_DETECTION_CONFIDENCE = "0.5"
$env:FOOD_CLASSIFICATION_CONFIDENCE = "0.6"
.\.venv\Scripts\python.exe -m flask --app testFlask run --host=0.0.0.0 --port=5000
```

Ứng dụng sử dụng bản TFLite float16 `models/classification/classifier_b2_finetuned_from_pth_float16.tflite` để giảm dung lượng và chạy nhiều thread CPU. Video mặc định được phân tích ở khoảng 6 FPS; có thể điều chỉnh bằng `FOOD_VIDEO_TARGET_FPS` và `FOOD_TFLITE_THREADS`.

---

## 📡 API Reference

### `POST /image` — Phát hiện món ăn trong ảnh

Nhận một ảnh, phát hiện và phân loại các món ăn Việt Nam.

**Request:**
```
Content-Type: multipart/form-data
Field: image (file)
```

**Ví dụ với curl:**
```bash
curl -X POST http://localhost:5000/image \
  -F "image=@/path/to/food.jpg"
```

**Response thành công (`200 OK`):**
```json
{
  "success": true,
  "total_detections": 2,
  "detections": [
    {
      "bbox": { "x1": 120, "y1": 80, "x2": 350, "y2": 300 },
      "detection_confidence": 0.87,
      "class_id": 28,
      "class_name": "Pho",
      "classification_confidence": 0.92
    },
    {
      "bbox": { "x1": 400, "y1": 50, "x2": 600, "y2": 250 },
      "detection_confidence": 0.75,
      "class_id": 9,
      "class_name": "Banh mi",
      "classification_confidence": 0.88
    }
  ],
  "class_counts": {
    "Pho": 1,
    "Banh mi": 1
  }
}
```

**Response lỗi (`400`, `500`):**
```json
{ "error": "No file part" }
```

---

### `POST /video` — Phát hiện món ăn trong video

Upload video, API sẽ xử lý từng frame (mỗi 5 frame 1 lần để tối ưu hiệu năng) và trả về thống kê số lượng từng món ăn xuất hiện.

**Request:**
```
Content-Type: multipart/form-data
Field: file (video file)
```

**Ví dụ với curl:**
```bash
curl -X POST http://localhost:5000/video \
  -F "file=@/path/to/food_video.mp4"
```

**Response thành công (`200 OK`):**
```json
{
  "success": true,
  "video_processed": true,
  "total_items": 15,
  "food_detections": [
    { "food_name": "Com tam", "count": 8 },
    { "food_name": "Pho", "count": 7 }
  ]
}
```

---

### `GET /video` — Tải video đã xử lý

Trả về file video đã được xử lý sau khi gọi `POST /video`.

```bash
curl http://localhost:5000/video --output processed_video.mp4
```

---

### `GET /download/<file_type>` — Tải file kết quả

Tải xuống file kết quả xử lý.

| Endpoint | Mô tả |
|----------|-------|
| `GET /download/image` | Tải ảnh đã xử lý (`food_detection_result.jpg`) |
| `GET /download/video` | Tải video đã xử lý (`food_detection_result.mp4`) |

---

## ⚙️ Cấu hình

| Tham số | Giá trị mặc định | Mô tả |
|---------|-----------------|-------|
| Detection confidence | `0.5` | Ngưỡng tin cậy tối thiểu để nhận diện vật thể |
| Image resize | `224 × 224` | Kích thước ảnh đầu vào cho classifier |
| Video frame skip | Mỗi 5 frames | Số frame bỏ qua để tăng tốc xử lý video |
| Normalization | `[-1, 1]` | Chuẩn hóa EfficientNet `(pixel/255 - 0.5) × 2` |

---

## 📦 Dependencies chính

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| Flask | 2.3.3 | Web framework |
| Flask-Cors | 4.0.0 | Xử lý CORS cho API |
| ultralytics | ≥8.0.196 | YOLOv5/v8 object detection |
| tflite-runtime | latest | Chạy model TFLite nhẹ |
| opencv-python | 4.8.1.78 | Xử lý ảnh và video |
| numpy | <2 | Tính toán số học |
| Pillow | ≥10.0.1 | Xử lý ảnh |
| Gunicorn | latest | WSGI server production |

---

## 🔧 Ghi chú kỹ thuật

- **CORS** được bật toàn cầu, phù hợp cho việc tích hợp với frontend (React, Vue...) hoặc mobile app.
- **TFLite runtime** được ưu tiên tải thay cho TensorFlow đầy đủ để giảm dung lượng triển khai.
- **Video processing** lưu file tạm `input_video.mp4` và `processed_video.mp4` trong thư mục `runtime/`.
- Mỗi request ảnh/video sẽ **reset bộ đếm** `food_counts` về 0 trước khi xử lý.

---

## 🤝 Tích hợp với Foodee Backend

API này được thiết kế để hoạt động cùng với **Foodee Backend** (NestJS), phục vụ tính năng:
- Nhận diện món ăn từ ảnh chụp của khách hàng
- Hỗ trợ FoodeeBot đề xuất món dựa trên ảnh
- Thống kê món ăn phổ biến qua video

---

## 📄 License

MIT License — Xem file [LICENSE](LICENSE) để biết thêm chi tiết.
