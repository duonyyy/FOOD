"""Phase 10: Model Evaluation & Golden Verification Automated Pytest."""
import json
from pathlib import Path
import cv2
import pytest

from app.labels import FOOD_LABELS
from app.services.inference import FoodInferenceService
from app.services.tracking import bbox_iou

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def test_food_labels_schema_and_completeness():
    """Verify that all 30 Vietnamese food classes are present and distinct."""
    assert len(FOOD_LABELS) == 30
    assert len(set(FOOD_LABELS)) == 30
    assert "Phở" in FOOD_LABELS
    assert "Bún bò Huế" in FOOD_LABELS
    assert "Cơm tấm" in FOOD_LABELS
    assert "Bánh mì" in FOOD_LABELS


def test_golden_dataset_f1_score_parity(app):
    """Verify that F1-score across all golden images achieves 100% precision and recall."""
    service = app.extensions.get('food_inference')
    golden_path = PROJECT_ROOT / "tests" / "golden_dataset.json"
    with open(golden_path, "r", encoding="utf-8") as f:
        golden = json.load(f)

    tp, fp, fn = 0, 0, 0

    for img_name, img_data in golden["images"].items():
        img_path = PROJECT_ROOT / "samples" / "images" / img_name
        image = cv2.imread(str(img_path))
        assert image is not None, f"Image {img_name} missing"

        detections = service.detect_and_classify(image)
        golden_dets = img_data["response"]["detections"]

        matched_golden = set()
        for pred in detections:
            matched = False
            for g_idx, gold in enumerate(golden_dets):
                if g_idx in matched_golden:
                    continue
                if pred["class_name"] == gold["class_name"] and bbox_iou(pred["bbox"], gold["bbox"]) >= 0.7:
                    tp += 1
                    matched_golden.add(g_idx)
                    matched = True
                    break
            if not matched:
                fp += 1

        for g_idx in range(len(golden_dets)):
            if g_idx not in matched_golden:
                fn += 1

    precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 1.0

    assert precision >= 1.0
    assert recall >= 1.0
    assert f1 >= 1.0
