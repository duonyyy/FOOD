import os
import threading

# Task 9.2: Suppress Ultralytics telemetry and online update checks to improve startup latency
os.environ['YOLO_VERBOSE'] = 'False'
os.environ['ULTRALYTICS_TELEMETRY'] = '0'
os.environ['ULTRALYTICS_AUTOINSTALL'] = '0'

import cv2
import numpy as np

from app.labels import FOOD_LABELS
from app.services.cache import ClassificationCache

# Precomputed ImageNet constants for fast vectorized normalization
_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_INV_255 = np.float32(1.0 / 255.0)
_INV_STD = (1.0 / np.array([0.229, 0.224, 0.225], dtype=np.float32)).astype(np.float32)


class FoodInferenceService:
    def __init__(self, config):
        self.config = config
        self._interpreter_lock = threading.RLock()
        self._detection_lock = threading.RLock()
        self.cache = ClassificationCache(
            max_size=getattr(config, 'CACHE_SIZE', 1024),
            ttl_seconds=getattr(config, 'CACHE_TTL', 60.0),
        )
        self.detection_model = self._load_detection_model()
        self.interpreter, self.input_details, self.output_details = self._load_classifier()
        self._input_index = self.input_details[0]['index']
        self._output_index = self.output_details[0]['index']
        self._allocated_batch_size = int(self.input_details[0]['shape'][0])

    def _load_detection_model(self):
        from ultralytics import YOLO, settings
        try:
            settings.update({'sync': False})
        except Exception:
            pass

        model = YOLO(str(self.config.DETECTION_MODEL_PATH))
        print(f'Loaded detection model: {self.config.DETECTION_MODEL_PATH.name}')
        return model

    def _load_classifier(self):
        # Task 12.1: Lightweight LiteRT / TFLite runtime loader with zero-warning migration
        try:
            from ai_edge_litert.interpreter import Interpreter
        except ImportError:
            try:
                import tflite_runtime.interpreter as tflite
                Interpreter = tflite.Interpreter
            except ImportError:
                import tensorflow as tf
                Interpreter = tf.lite.Interpreter

        interpreter = Interpreter(
            model_path=str(self.config.CLASSIFIER_MODEL_PATH),
            num_threads=self.config.TFLITE_NUM_THREADS,
        )
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        print(f'Loaded classifier: {self.config.CLASSIFIER_MODEL_PATH.name}')
        print(f'Classifier input: {input_details[0]["shape"]}')
        return interpreter, input_details, output_details

    @staticmethod
    def letterbox(
        image: np.ndarray,
        target_size: tuple[int, int] = (260, 260),
        fill_value: tuple[int, int, int] = (124, 116, 104)
    ) -> np.ndarray:
        """Task 9.1: Resize image preserving aspect ratio with ImageNet mean neutral padding (Letterbox)."""
        target_w, target_h = target_size
        h, w = image.shape[:2]
        if h == 0 or w == 0:
            return np.full((target_h, target_w, 3), fill_value, dtype=np.uint8)

        scale = min(target_w / w, target_h / h)
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))

        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        canvas = np.full((target_h, target_w, 3), fill_value, dtype=np.uint8)

        top = (target_h - new_h) // 2
        left = (target_w - new_w) // 2
        canvas[top:top + new_h, left:left + new_w] = resized
        return canvas

    @staticmethod
    def preprocess(image: np.ndarray) -> np.ndarray:
        """Vectorized precomputed ImageNet normalization for maximum throughput."""
        norm = image.astype(np.float32) * _INV_255
        norm -= _IMAGENET_MEAN
        norm *= _INV_STD
        return norm

    def detect_and_classify(self, image: np.ndarray) -> list[dict]:
        if self.detection_model is None or self.interpreter is None:
            return []

        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        with self._detection_lock:
            results = self.detection_model(
                rgb_image,
                conf=self.config.DETECTION_CONFIDENCE_THRESHOLD,
                iou=self.config.DETECTION_IOU_THRESHOLD,
                verbose=False,
            )
        candidates = []
        input_height = int(self.input_details[0]['shape'][1])
        input_width = int(self.input_details[0]['shape'][2])
        use_letterbox = getattr(self.config, 'LETTERBOX_ENABLED', False)

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                detection_confidence = float(box.conf[0].cpu().numpy())
                if detection_confidence < self.config.DETECTION_CONFIDENCE_THRESHOLD:
                    continue

                roi = rgb_image[int(y1):int(y2), int(x1):int(x2)]
                if roi.size == 0:
                    continue

                if use_letterbox:
                    roi_resized = self.letterbox(roi, (input_width, input_height))
                else:
                    roi_resized = cv2.resize(roi, (input_width, input_height), interpolation=cv2.INTER_LINEAR)

                preprocessed = self.preprocess(roi_resized)
                crop_key = self.cache.compute_key(preprocessed)
                candidates.append({
                    'bbox': {'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2)},
                    'detection_confidence': detection_confidence,
                    'image': preprocessed,
                    'crop_key': crop_key,
                })

        if not candidates:
            return []

        detections = []
        uncached_candidates = []

        # Check Cache first
        for candidate in candidates:
            cached_result = self.cache.get(candidate['crop_key'])
            if cached_result is not None:
                class_id, class_name, classification_confidence = cached_result
                if classification_confidence >= self.config.CLASSIFICATION_CONFIDENCE_THRESHOLD and class_name != 'Unknown':
                    detections.append({
                        'bbox': candidate['bbox'],
                        'detection_confidence': candidate['detection_confidence'],
                        'class_id': class_id,
                        'class_name': class_name,
                        'classification_confidence': classification_confidence,
                    })
            else:
                uncached_candidates.append(candidate)

        # If all candidates were in cache, return immediately
        if not uncached_candidates:
            return detections

        # Run TFLite inference only for uncached crops
        batch = np.stack([candidate['image'] for candidate in uncached_candidates])
        with self._interpreter_lock:
            # Task 7.2: Optimize TFLite memory allocation by avoiding redundant allocate_tensors calls
            batch_len = len(uncached_candidates)
            if self._allocated_batch_size != batch_len:
                self.interpreter.resize_tensor_input(self._input_index, batch.shape)
                self.interpreter.allocate_tensors()
                self._allocated_batch_size = batch_len

            self.interpreter.set_tensor(self._input_index, batch)
            self.interpreter.invoke()
            logits = self.interpreter.get_tensor(self._output_index)

        logits -= np.max(logits, axis=1, keepdims=True)
        probabilities = np.exp(logits)
        probabilities /= np.sum(probabilities, axis=1, keepdims=True)

        for candidate, scores in zip(uncached_candidates, probabilities):
            class_id = int(np.argmax(scores))
            classification_confidence = float(np.max(scores))
            class_name = FOOD_LABELS[class_id] if class_id < len(FOOD_LABELS) else 'Unknown'

            # Store in cache for future frames/requests
            self.cache.set(candidate['crop_key'], (class_id, class_name, classification_confidence))

            if classification_confidence < self.config.CLASSIFICATION_CONFIDENCE_THRESHOLD or class_name == 'Unknown':
                continue

            detections.append({
                'bbox': candidate['bbox'],
                'detection_confidence': candidate['detection_confidence'],
                'class_id': class_id,
                'class_name': class_name,
                'classification_confidence': classification_confidence,
            })

        return detections