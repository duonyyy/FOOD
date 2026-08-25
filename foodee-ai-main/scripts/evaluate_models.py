"""Script evaluating Food AI detection and classification pipeline against Golden Dataset."""
import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.config import Config
from app.labels import FOOD_LABELS
from app.services.inference import FoodInferenceService
from app.services.tracking import bbox_iou


def evaluate_pipeline():
    print("=" * 70)
    print("      FOODEE AI — MODEL EVALUATION & GOLDEN DATASET PARITY       ")
    print("=" * 70)

    # 1. Verify 30 Food Labels
    print(f"\n[1/4] Verifying Food Class Labels ({len(FOOD_LABELS)} classes registered):")
    assert len(FOOD_LABELS) == 30, f"Expected 30 food classes, got {len(FOOD_LABELS)}"
    for idx, label in enumerate(FOOD_LABELS):
        print(f"  [{idx:02d}] {label}")

    # 2. Load Model & Dataset
    print("\n[2/4] Initializing Inference Service...")
    start_load = time.perf_counter()
    service = FoodInferenceService(Config)
    load_time = time.perf_counter() - start_load
    print(f"  Model loaded in {load_time:.2f}s")

    golden_path = PROJECT_ROOT / "tests" / "golden_dataset.json"
    with open(golden_path, "r", encoding="utf-8") as f:
        golden = json.load(f)

    # 3. Evaluate Images
    print("\n[3/4] Evaluating Golden Dataset Images:")
    tp = 0
    fp = 0
    fn = 0
    total_samples = 0
    per_class_stats = {}

    print(f"{'Image Name':<18} | {'Status':<8} | {'Predicted':<20} | {'Golden':<20} | {'IoU':<6} | {'Conf':<6}")
    print("-" * 90)

    for img_name, img_data in golden["images"].items():
        img_path = PROJECT_ROOT / "samples" / "images" / img_name
        if not img_path.exists():
            print(f"  Warning: {img_name} not found, skipping.")
            continue

        image = cv2.imread(str(img_path))
        detections = service.detect_and_classify(image)
        golden_dets = img_data["response"]["detections"]

        matched_golden = set()
        matched_pred = set()

        # Check predictions against golden
        for p_idx, pred in enumerate(detections):
            p_bbox = pred["bbox"]
            p_class = pred["class_name"]
            p_conf = pred["classification_confidence"]

            best_iou = 0.0
            best_g_idx = -1

            for g_idx, gold in enumerate(golden_dets):
                if g_idx in matched_golden:
                    continue
                g_bbox = gold["bbox"]
                iou = bbox_iou(p_bbox, g_bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_g_idx = g_idx

            if best_g_idx >= 0 and best_iou >= 0.7 and p_class == golden_dets[best_g_idx]["class_name"]:
                tp += 1
                matched_golden.add(best_g_idx)
                matched_pred.add(p_idx)
                status = "PASS"
                g_class = golden_dets[best_g_idx]["class_name"]
                print(f"{img_name:<18} | {status:<8} | {p_class:<20} | {g_class:<20} | {best_iou:.2f} | {p_conf:.1%}")
                per_class_stats[p_class] = per_class_stats.get(p_class, {"tp": 0, "fp": 0, "fn": 0})
                per_class_stats[p_class]["tp"] += 1
            else:
                fp += 1
                status = "FP"
                print(f"{img_name:<18} | {status:<8} | {p_class:<20} | {'None':<20} | {best_iou:.2f} | {p_conf:.1%}")
                per_class_stats[p_class] = per_class_stats.get(p_class, {"tp": 0, "fp": 0, "fn": 0})
                per_class_stats[p_class]["fp"] += 1

        # Check unmatched golden detections (False Negatives)
        for g_idx, gold in enumerate(golden_dets):
            if g_idx not in matched_golden:
                fn += 1
                g_class = gold["class_name"]
                status = "FN"
                print(f"{img_name:<18} | {status:<8} | {'None':<20} | {g_class:<20} | 0.00   | N/A")
                per_class_stats[g_class] = per_class_stats.get(g_class, {"tp": 0, "fp": 0, "fn": 0})
                per_class_stats[g_class]["fn"] += 1

        if not golden_dets and not detections:
            print(f"{img_name:<18} | PASS (0) | {'None (Clean)':<20} | {'None (Clean)':<20} | 1.00   | N/A")

    # 4. Metrics Computation
    precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 1.0

    print("\n" + "=" * 70)
    print("                     EVALUATION SUMMARY REPORT                      ")
    print("=" * 70)
    print(f"  • True Positives  (TP) : {tp}")
    print(f"  • False Positives (FP) : {fp}")
    print(f"  • False Negatives (FN) : {fn}")
    print(f"  • Precision            : {precision:.4f} ({precision * 100:.2f}%)")
    print(f"  • Recall               : {recall:.4f} ({recall * 100:.2f}%)")
    print(f"  • F1-Score             : {f1:.4f} ({f1 * 100:.2f}%)")
    print("=" * 70)

    assert f1 >= 0.99, f"Model evaluation F1-score {f1:.4f} fell below 0.99 threshold!"
    print(">>> MODEL EVALUATION PASSED WITH ZERO REGRESSION! <<<\n")


if __name__ == "__main__":
    evaluate_pipeline()
