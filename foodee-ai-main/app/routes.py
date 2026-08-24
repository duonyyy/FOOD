from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from flask import Blueprint, current_app, jsonify, render_template, request, send_file

from app.services.media import VideoProcessor


api = Blueprint('api', __name__)
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi'}


def _inference_service():
    return current_app.extensions['food_inference']


def _upload_folder():
    return Path(current_app.config['UPLOAD_FOLDER'])


def _has_allowed_extension(filename, allowed_extensions):
    return Path(filename).suffix.lower() in allowed_extensions


@api.get('/')
def home():
    return render_template('demo.html')


@api.post('/image')
def image():
    uploaded_file = request.files.get('image')
    if uploaded_file is None:
        return jsonify({'error': 'No file part'}), 400
    if not uploaded_file.filename:
        return jsonify({'error': 'No selected file'}), 400
    if not _has_allowed_extension(uploaded_file.filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({'error': 'Unsupported image format. Use JPG, PNG, or WEBP'}), 415

    file_data = uploaded_file.read()
    if len(file_data) > current_app.config['APP_CONFIG'].MAX_IMAGE_BYTES:
        return jsonify({'error': 'Image exceeds the 10 MB limit'}), 413
    image_data = np.frombuffer(file_data, np.uint8)
    image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
    if image is None:
        return jsonify({'error': 'Invalid image file'}), 400

    detections = _inference_service().detect_and_classify(image)
    counts = Counter(
        detection['class_name']
        for detection in detections
        if detection['class_name'] != 'Unknown'
    )
    return jsonify({
        'success': True,
        'detections': detections,
        'total_detections': len(detections),
        'class_counts': dict(counts),
    })


@api.route('/video', methods=['GET', 'POST'])
def video():
    output_path = _upload_folder() / 'processed_video.mp4'
    if request.method == 'GET':
        if output_path.exists():
            return send_file(output_path, mimetype='video/mp4')
        return jsonify({'error': 'No processed video found'}), 404

    uploaded_file = request.files.get('file')
    if uploaded_file is None:
        return jsonify({'error': 'No file part'}), 400
    if not uploaded_file.filename:
        return jsonify({'error': 'No selected file'}), 400
    if not _has_allowed_extension(uploaded_file.filename, ALLOWED_VIDEO_EXTENSIONS):
        return jsonify({'error': 'Unsupported video format. Use MP4, MOV, or AVI'}), 415

    input_path = _upload_folder() / 'input_video.mp4'
    uploaded_file.save(input_path)
    try:
        counts = VideoProcessor(
            _inference_service(), current_app.config['APP_CONFIG']
        ).process(input_path, output_path)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    except Exception as error:
        return jsonify({'error': f'Video processing failed: {error}'}), 500

    return jsonify({
        'success': True,
        'video_processed': True,
        'food_detections': [
            {'food_name': name, 'count': count}
            for name, count in counts.items()
        ],
        'total_items': sum(counts.values()),
    })


@api.get('/download/<file_type>')
def download_file(file_type):
    filenames = {
        'image': 'processed_image.jpg',
        'video': 'processed_video.mp4',
    }
    filename = filenames.get(file_type)
    if filename is None:
        return jsonify({'error': 'File not found'}), 404
    file_path = _upload_folder() / filename
    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404
    return send_file(file_path, as_attachment=True, download_name=filename)


def detect_and_classify_food(image, update_counts=True):
    return _inference_service().detect_and_classify(image)