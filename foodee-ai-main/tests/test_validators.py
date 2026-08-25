"""Phase Test A: Validators & Config Unit Tests.

Directly tests validators.py and config.py functions
that were only indirectly tested through API integration tests.
"""

import os
import pytest

from app.validators import (
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    has_allowed_extension,
    is_valid_image_magic_bytes,
    is_valid_video_magic_bytes,
)


# ── Extension validation ─────────────────────────────────────────────

class TestHasAllowedExtension:
    """Unit tests for has_allowed_extension helper."""

    @pytest.mark.parametrize("filename", ["photo.jpg", "photo.jpeg", "photo.png", "photo.webp"])
    def test_valid_image_extensions_accepted(self, filename):
        assert has_allowed_extension(filename, ALLOWED_IMAGE_EXTENSIONS)

    @pytest.mark.parametrize("filename", ["hack.exe", "shell.php", "script.sh", "notes.txt", "data.csv"])
    def test_invalid_extensions_rejected(self, filename):
        assert not has_allowed_extension(filename, ALLOWED_IMAGE_EXTENSIONS)

    @pytest.mark.parametrize("filename", ["PHOTO.JPG", "Photo.PNG", "image.Webp", "img.JPEG"])
    def test_case_insensitive_extensions(self, filename):
        assert has_allowed_extension(filename, ALLOWED_IMAGE_EXTENSIONS)

    def test_empty_filename_rejected(self):
        assert not has_allowed_extension("", ALLOWED_IMAGE_EXTENSIONS)

    def test_none_filename_rejected(self):
        assert not has_allowed_extension(None, ALLOWED_IMAGE_EXTENSIONS)

    @pytest.mark.parametrize("filename", ["clip.mp4", "clip.mov", "clip.avi"])
    def test_valid_video_extensions_accepted(self, filename):
        assert has_allowed_extension(filename, ALLOWED_VIDEO_EXTENSIONS)


# ── Magic bytes validation ────────────────────────────────────────────

class TestImageMagicBytes:
    """Unit tests for is_valid_image_magic_bytes."""

    def test_jpeg_header_accepted(self):
        jpeg_header = b'\xff\xd8\xff\xe0' + b'\x00' * 20
        assert is_valid_image_magic_bytes(jpeg_header)

    def test_png_header_accepted(self):
        png_header = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20
        assert is_valid_image_magic_bytes(png_header)

    def test_webp_header_accepted(self):
        webp_header = b'RIFF' + b'\x00\x00\x00\x00' + b'WEBP' + b'\x00' * 20
        assert is_valid_image_magic_bytes(webp_header)

    def test_plain_text_rejected(self):
        assert not is_valid_image_magic_bytes(b'This is plain text content')

    def test_empty_bytes_rejected(self):
        assert not is_valid_image_magic_bytes(b'')

    def test_short_bytes_rejected(self):
        assert not is_valid_image_magic_bytes(b'\xff\xd8')


class TestVideoMagicBytes:
    """Unit tests for is_valid_video_magic_bytes."""

    def test_mp4_ftyp_header_accepted(self):
        mp4_header = b'\x00\x00\x00\x1c' + b'ftyp' + b'isom' + b'\x00' * 20
        assert is_valid_video_magic_bytes(mp4_header)

    def test_avi_riff_header_accepted(self):
        avi_header = b'RIFF' + b'\x00\x00\x00\x00' + b'AVI ' + b'\x00' * 20
        assert is_valid_video_magic_bytes(avi_header)

    def test_plain_text_rejected(self):
        assert not is_valid_video_magic_bytes(b'Not a real video file at all')

    def test_empty_bytes_rejected(self):
        assert not is_valid_video_magic_bytes(b'')


# ── Config defaults & env overrides ──────────────────────────────────

class TestConfig:
    """Unit tests for Config class defaults and environment overrides."""

    def test_config_default_values(self):
        from app.config import Config
        assert Config.DETECTION_CONFIDENCE_THRESHOLD == 0.1
        assert Config.DETECTION_IOU_THRESHOLD == 0.35
        assert Config.CLASSIFICATION_CONFIDENCE_THRESHOLD == 0.5
        assert Config.VIDEO_TARGET_FPS == 6.0
        assert Config.TFLITE_NUM_THREADS == 4
        assert Config.TRACK_IOU_THRESHOLD == 0.3
        assert Config.TRACK_MAX_MISSED_SAMPLES == 3
        assert Config.MAX_IMAGE_BYTES == 10 * 1024 * 1024
        assert Config.MAX_CONTENT_LENGTH == 100 * 1024 * 1024
        assert Config.CACHE_SIZE == 1024
        assert Config.CACHE_TTL == 60.0
