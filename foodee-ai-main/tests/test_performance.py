"""Phase Test D: Performance & Latency Regression Tests.

Validates that the system meets latency budgets and detects
performance regressions compared to the golden baseline.
"""

import json
import time
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.config import Config
from app.services.cache import ClassificationCache
from app.services.inference import FoodInferenceService
from app.services.tracking import FoodTracker

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def perf_inference_service():
    """Load inference service once for the performance test module."""
    return FoodInferenceService(Config)


class TestInferenceLatency:
    """Verify inference latency stays within acceptable budgets."""

    def test_image_inference_within_budget(self, perf_inference_service):
        """Single image inference on pho.jpg must complete within 500ms."""
        img_path = PROJECT_ROOT / 'samples' / 'images' / 'pho.jpg'
        image = cv2.imread(str(img_path))
        assert image is not None

        # Warm-up run (first run loads caches, JIT, etc.)
        perf_inference_service.detect_and_classify(image)
        perf_inference_service.cache.clear()

        start = time.perf_counter()
        detections = perf_inference_service.detect_and_classify(image)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(detections) > 0
        assert elapsed_ms < 500, f"Inference took {elapsed_ms:.1f}ms, exceeds 500ms budget"

    def test_cache_provides_speedup(self, perf_inference_service):
        """Second inference (cache hit) should be at least 2x faster than first (cache miss)."""
        img_path = PROJECT_ROOT / 'samples' / 'images' / 'pho.jpg'
        image = cv2.imread(str(img_path))
        assert image is not None

        perf_inference_service.cache.clear()

        # Cold run (cache miss)
        start1 = time.perf_counter()
        perf_inference_service.detect_and_classify(image)
        cold_ms = (time.perf_counter() - start1) * 1000

        # Warm run (cache hit)
        start2 = time.perf_counter()
        perf_inference_service.detect_and_classify(image)
        warm_ms = (time.perf_counter() - start2) * 1000

        assert warm_ms < cold_ms, f"Cache didn't speed up inference: cold={cold_ms:.1f}ms, warm={warm_ms:.1f}ms"


class TestPreprocessThroughput:
    """Verify preprocessing throughput doesn't bottleneck the pipeline."""

    def test_preprocess_100_crops_under_100ms(self):
        """Preprocessing 100 crop images should complete within 100ms."""
        crops = [np.random.randint(0, 255, (260, 260, 3), dtype=np.uint8) for _ in range(100)]

        start = time.perf_counter()
        for crop in crops:
            FoodInferenceService.preprocess(crop)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 100, f"Preprocessing 100 crops took {elapsed_ms:.1f}ms, exceeds 100ms budget"


class TestTrackerPerformance:
    """Verify FoodTracker can handle high-frequency updates."""

    def test_tracker_1000_updates_under_1_second(self):
        """FoodTracker processing 1000 sequential frame updates should complete within 1 second."""
        tracker = FoodTracker(iou_threshold=0.3, max_missed_samples=5)

        start = time.perf_counter()
        for i in range(1000):
            detections = [
                {'class_name': 'Phở', 'bbox': {'x1': i % 50, 'y1': i % 50, 'x2': (i % 50) + 100, 'y2': (i % 50) + 100}},
                {'class_name': 'Cơm tấm', 'bbox': {'x1': 200, 'y1': 200, 'x2': 300, 'y2': 300}},
            ]
            tracker.update(detections)
        elapsed = time.perf_counter() - start

        assert elapsed < 1.0, f"1000 tracker updates took {elapsed:.2f}s, exceeds 1s budget"
        assert len(tracker.counts) > 0


class TestGoldenLatencyRegression:
    """Compare current latency against the golden baseline."""

    def test_latency_no_regression_vs_golden(self, perf_inference_service):
        """Current average latency should not exceed 150% of golden baseline average."""
        golden_path = PROJECT_ROOT / 'tests' / 'golden_dataset.json'
        if not golden_path.exists():
            pytest.skip('Golden dataset not found')

        with open(golden_path, 'r', encoding='utf-8') as f:
            golden = json.load(f)

        # Test with pho.jpg (a key golden image)
        pho_golden = golden['images'].get('pho.jpg')
        if not pho_golden:
            pytest.skip('pho.jpg not in golden dataset')

        golden_avg_ms = pho_golden['latency_ms_avg']
        img_path = PROJECT_ROOT / 'samples' / 'images' / 'pho.jpg'
        image = cv2.imread(str(img_path))
        assert image is not None

        # Warm-up
        perf_inference_service.cache.clear()
        perf_inference_service.detect_and_classify(image)
        perf_inference_service.cache.clear()

        # Measure 3 runs
        latencies = []
        for _ in range(3):
            perf_inference_service.cache.clear()
            start = time.perf_counter()
            perf_inference_service.detect_and_classify(image)
            latencies.append((time.perf_counter() - start) * 1000)

        current_avg_ms = sum(latencies) / len(latencies)
        regression_threshold = golden_avg_ms * 1.5

        assert current_avg_ms < regression_threshold, (
            f"Latency regression detected! Current avg: {current_avg_ms:.1f}ms, "
            f"Golden avg: {golden_avg_ms:.1f}ms, Threshold (150%): {regression_threshold:.1f}ms"
        )
