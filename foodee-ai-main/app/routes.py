"""Backward-compatibility router module forwarding to app.api."""
from flask import current_app
from app.api import api_bp as api
from app.validators import (
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    ALLOWED_DOWNLOAD_TYPES,
    error_response,
    has_allowed_extension,
    is_valid_image_magic_bytes,
    is_valid_video_magic_bytes,
)


def _inference_service():
    return current_app.extensions['food_inference']


def _storage_manager():
    return current_app.extensions['storage_manager']


def detect_and_classify_food(image, update_counts=True):
    return _inference_service().detect_and_classify(image)


__all__ = [
    'api',
    'ALLOWED_IMAGE_EXTENSIONS',
    'ALLOWED_VIDEO_EXTENSIONS',
    'ALLOWED_DOWNLOAD_TYPES',
    'error_response',
    'has_allowed_extension',
    'is_valid_image_magic_bytes',
    'is_valid_video_magic_bytes',
    'detect_and_classify_food',
]