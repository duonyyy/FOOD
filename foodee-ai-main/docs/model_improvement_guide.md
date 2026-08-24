# 🚀 Cẩm Nang Tối Ưu & Nâng Cấp Mô Hình AI Nhận Diện Thức Ăn

Tài liệu này giải thích chi tiết các khái niệm và cung cấp code mẫu để bạn có thể tự nghiên cứu, áp dụng vào quá trình **Huấn luyện lại (Retrain)** hoặc **Cấu hình lại (Configure)** mô hình YOLO và EfficientNet. Đi sâu vào 2 vấn đề mà bạn đã chỉ ra.

---

## 1. Tinh Chỉnh Mô Hình Hiện Tại (Model Tuning)

### 1.1 Với YOLO: Giảm thiểu "Khung Quét Trùng Lặp" (IoU Tuning)

**Khái niệm:**
Khi YOLO dò tìm ảnh, nó có thể ném ra 5-6 cái khung (bounding box) quanh cùng một cái bát Bún Bò. Thuật toán **NMS (Non-Maximum Suppression)** sẽ thu dọn đống bừa bộn này bằng cách so sánh mức độ đè lên nhau giữa các khung, đo bằng **IoU (Intersection over Union)**.
* Giá trị IoU = `Diện_tích_giao_nhau` chia cho `Diện_tích_hợp_nhất`.
* Nếu IoU giữa 2 khung quá lớn (VD: > 0.45), mô hình sẽ tự hiểu 2 khung này đang chỉ vào cùng 1 vật, và nó sẽ **xóa đi khung có điểm tin cậy (confidence) thấp hơn**.

**Cách áp dụng trong code API của bạn (Không cần retrain):**
Chỉ cần thêm tham số `iou` vào lệnh chạy của Ultralytics trong file `routes.py`:

```python
# Tăng cường NMS: IoU càng nhỏ, nó càng diệt khung trùng lặp gắt gao hơn.
# Mặc định thường là 0.7. Bạn có thể ép xuống 0.45 hoặc 0.3.
results = detection_model(rgb_image, conf=0.4, iou=0.45) 
```

### 1.2 Với EfficientNet: Xử lý dữ liệu mất cân bằng (Class Weights & Focal Loss)

Nếu bạn có 5000 ảnh Phở nhưng chỉ có 500 ảnh Cơm Tấm, mô hình sẽ bị thiên vị Phở. Khi retrain bằng Keras, hãy dùng 2 vũ khí sau:

#### A. Dùng Class Weights (Cách dễ nhất)
Ép mô hình "phạt nặng" hơn khi đoán sai những món có ít ảnh.

```python
import numpy as np
from sklearn.utils.class_weight import compute_class_weight

# Giả sử y_train chứa nhãn từ 0 đến 29 của toàn bộ tập train
class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(y_train),
    y=y_train
)
# Đổi thành dict để đưa vào Keras
weight_dict = {i: weight for i, weight in enumerate(class_weights)}

# Khi gọi hàm fit huấn luyện model, nhét weight_dict vào:
model.fit(
    train_dataset,
    epochs=50,
    class_weight=weight_dict # <--- ĐIỂM QUAN TRỌNG
)
```

#### B. Dùng Focal Loss (Cách chuyên sâu)
Hàm mất mát mạng nơ-ron (Loss Function) mặc định thường là *Categorical Crossentropy*. Nó đánh đồng mọi độ khó. **Focal Loss** sinh ra để bắt mô hình ép tập trung học những tấm ảnh "khó đoán" (ví dụ: ảnh Cơm tấm nhập nhằng với Bánh đúc).

```python
import tensorflow as tf

# Định nghĩa Focal Loss trong Keras
def focal_loss(gamma=2.0, alpha=0.25):
    def focal_loss_fixed(y_true, y_pred):
        # Tính cross entropy thông thường
        cross_entropy = tf.keras.backend.categorical_crossentropy(y_true, y_pred)
        # Tính trọng số Focal (focus vào các mẫu mô hình đoán sai nhiều)
        weight = alpha * tf.math.pow((1.0 - y_pred), gamma)
        return cross_entropy * weight
    return focal_loss_fixed

# Khi biên dịch model để train:
model.compile(
    optimizer='adam',
    loss=focal_loss(gamma=2.0), # <--- Thay vì categorical_crossentropy
    metrics=['accuracy']
)
```

---

## 2. Xử Lý "Ảnh Rác" Bằng Lớp Out-of-Distribution (OOD)

Bản chất của thuật toán Softmax ở cuối EfficientNet là tính ra tỷ lệ "%" sao cho tổng 30 class cộng lại LUÔN LUÔN BẰNG 100%. Đưa cái bánh xe vào, tổng vẫn là 100%, dẫn tới món nào nhỉnh hơn xíu sẽ bị nhận ép là cái bánh xe.

Có 2 hướng để giải quyết triệt để:

### Hướng 1: Thêm nhãn thứ 31 (Lớp "Others") - Đòi hỏi Retrain
**Cách làm:**
1. Lên Kaggle hoặc Google tải thêm 1 Dataset chứa các vật thể linh tinh: Bàn, ghế, chó, mèo, cốc nước, điện thoại, hoặc thậm chí món ăn Tây (Pizza, Burger).
2. Khi chia thư mục để train Keras, thay vì 30 thư mục, bạn tạo thư mục thứ 31, đặt tên là `30_Others`. Ném tất cả ảnh rác vào đó.
3. Huấn luyện lại model. Từ nay output sẽ là 31 Classes. Class Index 30 chính là rác.

```python
# Cập nhật mảng FOOD_LABELS trong routes.py
FOOD_LABELS = [
    # ... 30 món cũ ...
    'Others_Not_Vietnam_Food' # Index số 30
]

# Phần logic routes.py kiểm tra
if food_label == 'Others_Not_Vietnam_Food':
    # Trả về màn hình hoặc thông báo cho khách: "Ảnh này không phải thức ăn Việt / AI không nhận dạng được"
```

### Hướng 2: Lọc ở đầu ra bằng Ngưỡng Khắt Khe (Probability Thresholding) - Đơn giản hơn
Không cần retrain. Nhưng đòi hỏi quan sát thống kê. Khi AI đoán một món ăn TÀO LAO, thường Confidence lớn nhất ở mảng Output chỉ rơi vào tầm 0.1 đến 0.3. Khi đoán ĐÚNG, độ tự tin của nó thường vọt lên > 0.6.

**Áp dụng trong code `routes.py` hiện tại:**
Cập nhật Logic sau dòng 117 (chỗ tính `classification_confidence`):

```python
# Ngưỡng tin cập cực tiểu để coi là 1 MÓN ĂN hợp lệ (ví dụ: 50%)
MIN_CONFIDENCE_THRESHOLD = 0.50

if classification_confidence < MIN_CONFIDENCE_THRESHOLD:
    # Mặc dù xác suất cao nhất gán vào "Bánh đúc" (ví dụ là 0.35)
    # Nhưng vì 0.35 < 0.50 nên ta coi như AI đang bối rối vì đây không phải món ăn nó biết
    food_label = "Khong_Nhan_Dien_Duoc"
else:
    food_label = FOOD_LABELS[predicted_class_idx]
```

### Tóm lại:
Quy trình tối ưu một dự án AI thực tế luôn là vòng lặp:
**Đánh giá lỗi sai ➔ Thu thập thêm ảnh dặm vào lỗi đó ➔ Chống thiên vị (Weight) ➔ Train lại ➔ Cấu hình Cắt lọc viền (IoU/Confidence).** Chúc bạn nghiên cứu và phát triển tốt tính năng nhận diện này!
