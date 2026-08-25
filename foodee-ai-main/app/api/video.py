from flask import current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename

from app.api import api_bp
from app.services.media import VideoProcessor
from app.validators import (
    ALLOWED_VIDEO_EXTENSIONS,
    error_response,
    has_allowed_extension,
    is_valid_video_magic_bytes,
)


def _inference_service():
    return current_app.extensions['food_inference']


def _storage_manager():
    return current_app.extensions['storage_manager']


@api_bp.route('/video', methods=['GET', 'POST'])
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
    if not safe_name or not has_allowed_extension(safe_name, ALLOWED_VIDEO_EXTENSIONS):
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
