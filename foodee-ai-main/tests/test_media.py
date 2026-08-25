"""Phase Test B: Media Pipeline Unit Tests.

Directly tests draw_detections, create_video_writer, and VideoProcessor
from app/services/media.py — previously 0% unit test coverage.
"""

import pytest
import numpy as np
import cv2
from pathlib import Path

from app.services.media import draw_detections, create_video_writer, VideoProcessor

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _sample_detections():
    return [
        {
            'class_name': 'Phở',
            'classification_confidence': 0.95,
            'bbox': {'x1': 10, 'y1': 30, 'x2': 100, 'y2': 120},
        }
    ]


class TestDrawDetections:
    """Unit tests for the draw_detections function."""

    def test_returns_annotated_image_with_changes(self):
        image = np.zeros((200, 200, 3), dtype=np.uint8)
        result = draw_detections(image, _sample_detections())
        assert result.shape == image.shape
        # Annotated image should differ from the blank original (bbox drawn)
        assert not np.array_equal(result, image)

    def test_empty_detections_returns_unchanged_copy(self):
        image = np.ones((100, 100, 3), dtype=np.uint8) * 128
        result = draw_detections(image, [])
        assert np.array_equal(result, image)

    def test_preserves_original_image_immutability(self):
        image = np.zeros((200, 200, 3), dtype=np.uint8)
        original_copy = image.copy()
        draw_detections(image, _sample_detections())
        # The original image must not be mutated by draw_detections
        assert np.array_equal(image, original_copy)

    def test_multiple_detections(self):
        image = np.zeros((300, 300, 3), dtype=np.uint8)
        detections = [
            {'class_name': 'Phở', 'classification_confidence': 0.9, 'bbox': {'x1': 10, 'y1': 10, 'x2': 100, 'y2': 100}},
            {'class_name': 'Cơm tấm', 'classification_confidence': 0.85, 'bbox': {'x1': 150, 'y1': 150, 'x2': 280, 'y2': 280}},
        ]
        result = draw_detections(image, detections)
        assert result.shape == image.shape
        assert not np.array_equal(result, image)


class TestCreateVideoWriter:
    """Unit tests for the create_video_writer function."""

    def test_produces_valid_writer(self, tmp_path):
        output_path = tmp_path / 'test_output.mp4'
        writer = create_video_writer(output_path, fps=25.0, width=320, height=240)
        assert writer.isOpened()
        # Write a single frame to verify it works
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        writer.write(frame)
        writer.release()
        assert output_path.exists()
        assert output_path.stat().st_size > 0


class TestVideoProcessor:
    """Unit tests for the VideoProcessor class."""

    def test_process_with_mock_inference(self, tmp_path):
        """VideoProcessor should process a video with mocked inference service."""
        from app.config import Config

        class MockInference:
            def detect_and_classify(self, frame):
                return []

        input_path = PROJECT_ROOT / 'samples' / 'videos' / 'short_video.mp4'
        if not input_path.exists():
            pytest.skip('short_video.mp4 sample not available')

        output_path = tmp_path / 'processed.mp4'
        processor = VideoProcessor(MockInference(), Config)
        counts = processor.process(input_path, output_path)

        assert isinstance(counts, dict)
        assert output_path.exists()
        assert output_path.stat().st_size > 0

    def test_invalid_video_raises_value_error(self, tmp_path):
        """VideoProcessor should raise ValueError for invalid video files."""
        from app.config import Config

        class MockInference:
            def detect_and_classify(self, frame):
                return []

        fake_video = tmp_path / 'fake.mp4'
        fake_video.write_bytes(b'this is not a video')
        output_path = tmp_path / 'output.mp4'

        processor = VideoProcessor(MockInference(), Config)
        with pytest.raises(ValueError, match='Unable to open video'):
            processor.process(fake_video, output_path)
