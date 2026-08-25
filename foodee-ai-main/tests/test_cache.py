import time
import numpy as np
import pytest

from app.services.cache import ClassificationCache


def test_cache_miss_and_hit():
    cache = ClassificationCache(max_size=10, ttl_seconds=60)
    crop = np.ones((50, 50, 3), dtype=np.uint8)
    key = cache.compute_key(crop)

    # Initially Miss
    assert cache.get(key) is None
    stats = cache.get_stats()
    assert stats["misses"] == 1
    assert stats["hits"] == 0

    # Set value
    cache.set(key, (1, "Phở", 0.99))
    stats = cache.get_stats()
    assert stats["size"] == 1

    # Now Hit
    result = cache.get(key)
    assert result == (1, "Phở", 0.99)
    stats = cache.get_stats()
    assert stats["hits"] == 1
    assert stats["misses"] == 1


def test_cache_ttl_expiration():
    # TTL = 0.1 second
    cache = ClassificationCache(max_size=10, ttl_seconds=0.1)
    crop = np.zeros((20, 20, 3), dtype=np.uint8)
    key = cache.compute_key(crop)

    cache.set(key, (2, "Bánh mì", 0.95))
    assert cache.get(key) == (2, "Bánh mì", 0.95)

    # Wait for TTL to expire
    time.sleep(0.15)

    # Should be expired and return None
    assert cache.get(key) is None
    stats = cache.get_stats()
    assert stats["size"] == 0


def test_cache_lru_eviction():
    # Max size = 2
    cache = ClassificationCache(max_size=2, ttl_seconds=60)

    crop1 = np.ones((10, 10, 3), dtype=np.uint8) * 1
    crop2 = np.ones((10, 10, 3), dtype=np.uint8) * 2
    crop3 = np.ones((10, 10, 3), dtype=np.uint8) * 3

    k1, k2, k3 = cache.compute_key(crop1), cache.compute_key(crop2), cache.compute_key(crop3)

    cache.set(k1, "Item1")
    cache.set(k2, "Item2")

    # Access k1 to make k1 most recently used (k2 becomes least recently used)
    assert cache.get(k1) == "Item1"

    # Insert k3, which should evict k2
    cache.set(k3, "Item3")

    stats = cache.get_stats()
    assert stats["evictions"] == 1
    assert stats["size"] == 2
    assert cache.get(k1) == "Item1"
    assert cache.get(k2) is None  # Evicted
    assert cache.get(k3) == "Item3"


def test_cache_clear():
    cache = ClassificationCache(max_size=5, ttl_seconds=60)
    crop = np.ones((10, 10, 3), dtype=np.uint8)
    key = cache.compute_key(crop)

    cache.set(key, "Phở")
    assert cache.get_stats()["size"] == 1

    cache.clear()
    stats = cache.get_stats()
    assert stats["size"] == 0
    assert stats["hits"] == 0
    assert stats["misses"] == 0
    assert stats["evictions"] == 0


def test_inference_service_cache_integration():
    """Verify that calling inference twice on same image hits the cache."""
    import cv2
    from pathlib import Path
    from app.config import Config
    from app.services.inference import FoodInferenceService

    service = FoodInferenceService(Config)
    service.cache.clear()

    img_path = Path(__file__).resolve().parent.parent / "samples" / "images" / "pho.jpg"
    image = cv2.imread(str(img_path))
    assert image is not None

    # First inference: Cache Miss
    res1 = service.detect_and_classify(image)
    stats1 = service.cache.get_stats()
    assert stats1["misses"] >= 1
    assert stats1["hits"] == 0

    # Second inference: Cache Hit!
    res2 = service.detect_and_classify(image)
    stats2 = service.cache.get_stats()
    assert stats2["hits"] >= 1
    assert res1 == res2
