import pytest
import numpy as np
import torch
from pathlib import Path

from app.config import Config
from app.services.inference import FoodInferenceService

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def inference_service():
    """Load inference service once for the test module."""
    return FoodInferenceService(Config)


def test_inference_with_blank_image(inference_service):
    """Zero/black image should not crash and return valid list."""
    black_image = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = inference_service.detect_and_classify(black_image)
    assert isinstance(detections, list)
    # A blank black image should yield no high confidence food detections
    assert len(detections) == 0


def test_inference_with_real_sample_image(inference_service):
    """Real sample image should return expected detection format."""
    import cv2
    img_path = PROJECT_ROOT / "samples" / "images" / "pho.jpg"
    image = cv2.imread(str(img_path))
    assert image is not None

    detections = inference_service.detect_and_classify(image)
    assert isinstance(detections, list)
    assert len(detections) > 0

    for det in detections:
        assert "class_name" in det
        assert "class_id" in det
        assert "bbox" in det
        assert "detection_confidence" in det
        assert "classification_confidence" in det

        bbox = det["bbox"]
        assert all(k in bbox for k in ("x1", "y1", "x2", "y2"))
        assert bbox["x1"] <= bbox["x2"]
        assert bbox["y1"] <= bbox["y2"]


def test_safe_torch_weights_loading():
    """Verify PyTorch model weights loading uses weights_only=True."""
    ckpt_path = PROJECT_ROOT / "models" / "classification" / "best_efficientnet_b2_30vnfoods_finetuned.pth"
    if not ckpt_path.exists():
        ckpt_path = PROJECT_ROOT / "best_efficientnet_b2_30vnfoods_finetuned.pth"

    checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=True)
    assert "model_state_dict" in checkpoint
    assert "num_classes" in checkpoint
