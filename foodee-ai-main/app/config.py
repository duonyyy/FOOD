import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / 'models'
RUNTIME_DIR = BASE_DIR / 'runtime'


class Config:
    DETECTION_MODEL_PATH = Path(
        os.getenv(
            'FOOD_DETECTION_MODEL',
            str(MODELS_DIR / 'detection' / 'detection.pt'),
        )
    )
    CLASSIFIER_MODEL_PATH = Path(
        os.getenv(
            'FOOD_CLASSIFIER_MODEL',
            str(MODELS_DIR / 'classification' / 'classifier_b2_finetuned_from_pth_float16.tflite'),
        )
    )
    UPLOAD_FOLDER = Path(os.getenv('FOOD_UPLOAD_FOLDER', str(RUNTIME_DIR)))
    DETECTION_CONFIDENCE_THRESHOLD = float(os.getenv('FOOD_DETECTION_CONFIDENCE', '0.1'))
    DETECTION_IOU_THRESHOLD = float(os.getenv('FOOD_DETECTION_IOU', '0.35'))
    CLASSIFICATION_CONFIDENCE_THRESHOLD = float(os.getenv('FOOD_CLASSIFICATION_CONFIDENCE', '0.5'))
    VIDEO_TARGET_FPS = float(os.getenv('FOOD_VIDEO_TARGET_FPS', '6'))
    TFLITE_NUM_THREADS = int(os.getenv('FOOD_TFLITE_THREADS', '4'))
    TRACK_IOU_THRESHOLD = float(os.getenv('FOOD_TRACK_IOU_THRESHOLD', '0.3'))
    TRACK_MAX_MISSED_SAMPLES = int(os.getenv('FOOD_TRACK_MAX_MISSED', '3'))
    MAX_IMAGE_BYTES = int(os.getenv('FOOD_MAX_IMAGE_BYTES', str(10 * 1024 * 1024)))
    MAX_CONTENT_LENGTH = int(os.getenv('FOOD_MAX_UPLOAD_BYTES', str(100 * 1024 * 1024)))