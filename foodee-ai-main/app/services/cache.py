from collections import OrderedDict
import hashlib
import threading
import time
import numpy as np


class ClassificationCache:
    """Thread-safe LRU Cache with Time-To-Live (TTL) expiration for classification crops."""

    def __init__(self, max_size: int = 1024, ttl_seconds: float = 60.0):
        self.max_size = max(1, max_size)
        self.ttl_seconds = max(0.0, ttl_seconds)
        self._cache = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    @staticmethod
    def compute_key(crop: np.ndarray) -> str:
        """Generate a deterministic hash key for an image crop array."""
        if crop is None or crop.size == 0:
            return ""
        # Hash the contiguous byte buffer of the crop
        return hashlib.md5(crop.tobytes()).hexdigest()

    def get(self, key: str):
        """Retrieve a cached classification result if present and not expired."""
        if not key:
            return None

        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            value, timestamp = self._cache[key]
            now = time.time()

            # Check TTL Expiration
            if self.ttl_seconds > 0 and (now - timestamp) > self.ttl_seconds:
                del self._cache[key]
                self._misses += 1
                return None

            # Move to end (Most Recently Used)
            self._cache.move_to_end(key)
            self._hits += 1
            return value

    def set(self, key: str, value) -> None:
        """Store a classification result in the cache with LRU eviction."""
        if not key:
            return

        with self._lock:
            now = time.time()
            if key in self._cache:
                self._cache[key] = (value, now)
                self._cache.move_to_end(key)
                return

            # Check capacity and evict Least Recently Used item
            if len(self._cache) >= self.max_size:
                self._cache.popitem(last=False)
                self._evictions += 1

            self._cache[key] = (value, now)

    def clear(self) -> None:
        """Clear all cached entries and reset statistics."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
            self._evictions = 0

    def get_stats(self) -> dict:
        """Get cache performance metrics."""
        with self._lock:
            return {
                "hits": self._hits,
                "misses": self._misses,
                "evictions": self._evictions,
                "size": len(self._cache),
                "max_size": self.max_size,
                "ttl_seconds": self.ttl_seconds,
            }
