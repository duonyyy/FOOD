import io
from pathlib import Path
import pytest
import numpy as np

from app import create_app
from app.services.storage import JobStorageManager


PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def app():
    """Create application for testing."""
    application = create_app()
    application.config.update({
        "TESTING": True,
    })
    return application


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def sample_image_bytes():
    """Return raw bytes of a valid sample image."""
    img_path = PROJECT_ROOT / "samples" / "images" / "pho.jpg"
    with open(img_path, "rb") as f:
        return f.read()


@pytest.fixture
def sample_video_path():
    """Return path of a valid sample video."""
    return PROJECT_ROOT / "samples" / "videos" / "output_video.mp4"


@pytest.fixture
def tmp_storage(tmp_path):
    """Provide a JobStorageManager instance on a temporary directory."""
    return JobStorageManager(tmp_path)


@pytest.fixture
def mock_inference():
    """Mock inference service returning canned detection outputs."""
    class MockInference:
        def detect_and_classify(self, image: np.ndarray):
            return [
                {
                    "class_name": "Phở",
                    "confidence": 0.95,
                    "bbox": {"x1": 10, "y1": 10, "x2": 100, "y2": 100},
                }
            ]
    return MockInference()
