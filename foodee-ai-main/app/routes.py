from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from flask import Blueprint, current_app, jsonify, render_template, request, send_file
from werkzeug.utils import secure_filename

from app.services.media import VideoProcessor, draw_detections


api = Blueprint('api', __name__)
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi'}
ALLOWED_DOWNLOAD_TYPES = {'image', 'video'}


def _inference_service():
    return current_app.extensions['food_inference']


def _storage_manager():
    return current_app.extensions['storage_manager']


def _has_allowed_extension(filename, allowed_extensions):
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


@api.get('/')
def home():
    return render_template('demo.html')


@api.post('/image')
def image():
    # Multipart fallback: support both 'image' and 'file' parameter names safely
    uploaded_file = request.files.get('image')
    if uploaded_file is None:
        uploaded_file = request.files.get('file')

    if uploaded_file is None:
        return error_response('No file part in request. Provide image under "image" or "file"', 400, 'MISSING_FILE_PART')
    if not uploaded_file.filename:
        return error_response('No file selected for upload', 400, 'EMPTY_FILENAME')

    safe_name = secure_filename(uploaded_file.filename)
    if not safe_name or not _has_allowed_extension(safe_name, ALLOWED_IMAGE_EXTENSIONS):
        return error_response('Unsupported image format. Use JPG, PNG, or WEBP', 415, 'UNSUPPORTED_MEDIA_TYPE')

    file_data = uploaded_file.read()
    if len(file_data) > current_app.config['APP_CONFIG'].MAX_IMAGE_BYTES:
        return error_response('Image exceeds the 10 MB limit', 413, 'IMAGE_TOO_LARGE')

    if not is_valid_image_magic_bytes(file_data):
        return error_response('Invalid image file content', 415, 'INVALID_IMAGE_BYTES')

    image_data = np.frombuffer(file_data, np.uint8)
    image_mat = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
    if image_mat is None:
        return error_response('Invalid image file could not be decoded', 400, 'IMAGE_DECODE_FAILED')

    detections = _inference_service().detect_and_classify(image_mat)
    counts = Counter(
        detection['class_name']
        for detection in detections
        if detection['class_name'] != 'Unknown'
    )

    storage = _storage_manager()
    job_id = storage.create_job()
    annotated_image = draw_detections(image_mat, detections) if detections else image_mat
    storage.save_annotated_image(job_id, annotated_image)

    return jsonify({
        'success': True,
        'job_id': job_id,
        'detections': detections,
        'total_detections': len(detections),
        'class_counts': dict(counts),
    })


@api.route('/video', methods=['GET', 'POST'])
def video():
    storage = _storage_manager()
    if request.method == 'GET':
        file_path, _ = storage.get_download_file('video')
        if file_path and file_path.exists():
            return send_file(file_path, mimetype='video/mp4')
        return error_response('No processed video found', 404, 'VIDEO_NOT_FOUND')

    # Multipart fallback: support both 'file' and 'image' parameter names safely
    uploaded_file = request.files.get('file')
    if uploaded_file is None:
        uploaded_file = request.files.get('image')

    if uploaded_file is None:
        return error_response('No file part in request. Provide video under "file" or "image"', 400, 'MISSING_FILE_PART')
    if not uploaded_file.filename:
        return error_response('No file selected for upload', 400, 'EMPTY_FILENAME')

    safe_name = secure_filename(uploaded_file.filename)
    if not safe_name or not _has_allowed_extension(safe_name, ALLOWED_VIDEO_EXTENSIONS):
        return error_response('Unsupported video format. Use MP4, MOV, or AVI', 415, 'UNSUPPORTED_MEDIA_TYPE')

    header = uploaded_file.read(64)
    uploaded_file.seek(0)
    if not is_valid_video_magic_bytes(header):
        return error_response('Invalid video file content', 415, 'INVALID_VIDEO_BYTES')

    job_id = storage.create_job()
    input_path = storage.get_input_video_path(job_id)
    output_path = storage.get_processed_video_path(job_id)
    uploaded_file.save(input_path)

    try:
        counts = VideoProcessor(
            _inference_service(), current_app.config['APP_CONFIG']
        ).process(input_path, output_path)
        storage.sync_processed_video(job_id)
    except ValueError as error:
        return error_response(str(error), 400, 'INVALID_VIDEO')
    except Exception as error:
        return error_response(f'Video processing failed: {error}', 500, 'PROCESSING_FAILED')

    return jsonify({
        'success': True,
        'job_id': job_id,
        'video_processed': True,
        'food_detections': [
            {'food_name': name, 'count': count}
            for name, count in counts.items()
        ],
        'total_items': sum(counts.values()),
    })


@api.get('/download/<file_type>')
def download_file(file_type):
    if file_type not in ALLOWED_DOWNLOAD_TYPES:
        return error_response('File not found', 404, 'FILE_NOT_FOUND')

    job_id = request.args.get('job_id')
    storage = _storage_manager()
    try:
        file_path, filename = storage.get_download_file(file_type, job_id=job_id)
    except ValueError as error:
        return error_response(str(error), 400, 'INVALID_JOB_ID')

    if file_path is None or not file_path.exists():
        return error_response('File not found', 404, 'FILE_NOT_FOUND')
    return send_file(file_path, as_attachment=True, download_name=filename)


def detect_and_classify_food(image, update_counts=True):
    return _inference_service().detect_and_classify(image)