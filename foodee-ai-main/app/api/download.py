from flask import current_app, request, send_file
from app.api import api_bp
from app.validators import ALLOWED_DOWNLOAD_TYPES, error_response


def _storage_manager():
    return current_app.extensions['storage_manager']


@api_bp.get('/download/<file_type>')
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
