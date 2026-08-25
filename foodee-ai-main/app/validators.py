from pathlib import Path
from flask import jsonify

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi'}
ALLOWED_DOWNLOAD_TYPES = {'image', 'video'}


def has_allowed_extension(filename: str, allowed_extensions: set) -> bool:
    """Check if the filename has an allowed extension."""
    if not filename:
        return False
    return Path(filename).suffix.lower() in allowed_extensions


def error_response(message: str, status_code: int, code: str | None = None):
    """Return unified error response JSON."""
    return jsonify({
        'success': False,
        'error': message,
        'code': code or f'HTTP_{status_code}'
    }), status_code


def is_valid_image_magic_bytes(data: bytes) -> bool:
    """Verify that file data matches valid JPEG, PNG, or WEBP binary headers."""
    if len(data) < 12:
        return False
    if data.startswith(b'\xff\xd8\xff'):
        return True
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return True
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return True
    return False


def is_valid_video_magic_bytes(data: bytes) -> bool:
    """Verify that file data matches valid MP4, MOV, or AVI binary headers."""
    if len(data) < 12:
        return False
    if data[4:8] in (b'ftyp', b'moov', b'mdat', b'wide'):
        return True
    if data[:4] in (b'moov', b'mdat', b'wide', b'free', b'skip'):
        return True
    if data[:4] == b'RIFF' and data[8:12] == b'AVI ':
        return True
    return False
