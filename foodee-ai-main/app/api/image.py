from collections import Counter
import cv2
import numpy as np
from flask import current_app, jsonify, request
from werkzeug.utils import secure_filename

from app.api import api_bp
from app.services.media import draw_detections
from app.validators import (
    ALLOWED_IMAGE_EXTENSIONS,
    error_response,
    has_allowed_extension,
    is_valid_image_magic_bytes,
)


def _inference_service():
    return current_app.extensions['food_inference']


def _storage_manager():
    return current_app.extensions['storage_manager']


@api_bp.post('/image')
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
    if not safe_name or not has_allowed_extension(safe_name, ALLOWED_IMAGE_EXTENSIONS):
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
