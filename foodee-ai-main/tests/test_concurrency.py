"""Phase Test C: Concurrency & Thread Safety Tests.

Tests that the system's critical components (storage, cache, inference)
are thread-safe under concurrent access — guarding against race conditions
identified in Phase 1 of the roadmap.
"""

import io
import threading
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.services.cache import ClassificationCache
from app.services.storage import JobStorageManager

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class TestConcurrentStorage:
    """Thread safety tests for JobStorageManager."""

    def test_concurrent_job_creation_unique_ids(self, tmp_path):
        """20 threads creating jobs simultaneously must produce unique IDs."""
        storage = JobStorageManager(tmp_path)
        results = []
        errors = []

        def create_job():
            try:
                job_id = storage.create_job()
                results.append(job_id)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=create_job) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors during concurrent job creation: {errors}"
        assert len(results) == 20
        assert len(set(results)) == 20, "Duplicate job IDs detected!"

    def test_concurrent_save_annotated_image_no_corruption(self, tmp_path):
        """Multiple threads saving images shouldn't corrupt the fallback file."""
        storage = JobStorageManager(tmp_path)
        errors = []

        def save_image(color_value):
            try:
                job_id = storage.create_job()
                img = np.full((50, 50, 3), color_value, dtype=np.uint8)
                storage.save_annotated_image(job_id, img)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=save_image, args=(i * 25,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors during concurrent image saving: {errors}"
        # Fallback file should exist and be a valid image
        fallback = tmp_path / 'processed_image.jpg'
        assert fallback.exists()
        img = cv2.imread(str(fallback))
        assert img is not None


class TestConcurrentCache:
    """Thread safety tests for ClassificationCache."""

    def test_concurrent_cache_read_write_no_crash(self):
        """10 threads performing mixed read/write operations should not crash."""
        cache = ClassificationCache(max_size=50, ttl_seconds=60)
        errors = []

        def cache_worker(thread_id):
            try:
                for i in range(100):
                    crop = np.full((10, 10, 3), thread_id * 10 + i, dtype=np.uint8)
                    key = cache.compute_key(crop)
                    cache.set(key, (thread_id, f"Class_{thread_id}", 0.9))
                    cache.get(key)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=cache_worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors during concurrent cache access: {errors}"
        stats = cache.get_stats()
        assert stats['size'] <= cache.max_size


class TestConcurrentAPIUploads:
    """Thread safety tests for concurrent API image uploads."""

    def test_concurrent_image_uploads_unique_job_ids(self, client, sample_image_bytes):
        """5 concurrent image uploads must each receive a unique job_id."""
        results = []
        errors = []

        def upload_image():
            try:
                response = client.post(
                    '/image',
                    data={'image': (io.BytesIO(sample_image_bytes), 'pho.jpg')},
                    content_type='multipart/form-data',
                )
                res = response.get_json()
                results.append(res)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=upload_image) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors during concurrent uploads: {errors}"
        assert len(results) == 5
        job_ids = [r['job_id'] for r in results if r.get('success')]
        assert len(job_ids) == len(set(job_ids)), "Duplicate job_ids in concurrent uploads!"

    def test_inference_service_thread_safety(self):
        """3 threads calling detect_and_classify concurrently should all get valid results."""
        from app.config import Config
        from app.services.inference import FoodInferenceService

        service = FoodInferenceService(Config)
        img_path = PROJECT_ROOT / 'samples' / 'images' / 'pho.jpg'
        image = cv2.imread(str(img_path))
        assert image is not None

        results = []
        errors = []

        def run_inference():
            try:
                detections = service.detect_and_classify(image)
                results.append(detections)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=run_inference) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors during concurrent inference: {errors}"
        assert len(results) == 3
        for det_list in results:
            assert isinstance(det_list, list)
            assert len(det_list) > 0
