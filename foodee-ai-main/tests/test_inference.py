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


def test_letterbox_preserves_dimensions_and_aspect_ratio():
    """Verify letterbox helper produces exact target size with neutral padding."""
    # Wide rectangle (100x50)
    wide_img = np.ones((50, 100, 3), dtype=np.uint8) * 200
    lb_wide = FoodInferenceService.letterbox(wide_img, target_size=(260, 260), fill_value=(124, 116, 104))
    assert lb_wide.shape == (260, 260, 3)
    # Check that top and bottom borders have padding color (124, 116, 104)
    assert tuple(lb_wide[0, 0]) == (124, 116, 104)
    assert tuple(lb_wide[259, 259]) == (124, 116, 104)

    # Tall rectangle (50x100)
    tall_img = np.ones((100, 50, 3), dtype=np.uint8) * 200
    lb_tall = FoodInferenceService.letterbox(tall_img, target_size=(260, 260), fill_value=(124, 116, 104))
    assert lb_tall.shape == (260, 260, 3)
    # Check that left and right borders have padding color
    assert tuple(lb_tall[0, 0]) == (124, 116, 104)
    assert tuple(lb_tall[130, 0]) == (124, 116, 104)

    # Empty image edge case
    empty_img = np.zeros((0, 0, 3), dtype=np.uint8)
    lb_empty = FoodInferenceService.letterbox(empty_img, target_size=(260, 260))
    assert lb_empty.shape == (260, 260, 3)


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
    assert ckpt_path.exists(), f"Model checkpoint not found at {ckpt_path}"

    checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=True)
    assert "model_state_dict" in checkpoint
    assert "num_classes" in checkpoint
