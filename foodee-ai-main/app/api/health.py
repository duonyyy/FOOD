"""Health and Readiness Probes for Kubernetes / Container orchestration."""
import time
from flask import current_app, jsonify
from app.api import api_bp

START_TIME = time.time()


@api_bp.route('/health', methods=['GET'])
def health_check():
    """Liveness probe: returns 200 OK if server process is alive."""
    uptime_seconds = round(time.time() - START_TIME, 2)
    return jsonify({
        'status': 'healthy',
        'service': 'foodee-ai',
        'version': '1.0.0',
        'uptime_seconds': uptime_seconds,
    }), 200


@api_bp.route('/ready', methods=['GET'])
def readiness_check():
    """Readiness probe: verifies models and storage are loaded in RAM and ready for traffic."""
    inference_service = current_app.extensions.get('food_inference')
    storage_manager = current_app.extensions.get('storage_manager')

    checks = {
        'detection_model': False,
        'classifier_model': False,
        'storage_ready': False,
    }

    if inference_service is not None:
        if inference_service.detection_model is not None:
            checks['detection_model'] = True
        if inference_service.interpreter is not None:
            checks['classifier_model'] = True

    if storage_manager is not None and getattr(storage_manager, 'base_folder', None) is not None and storage_manager.base_folder.exists():
        checks['storage_ready'] = True

    all_ready = all(checks.values())
    status_code = 200 if all_ready else 503

    return jsonify({
        'status': 'ready' if all_ready else 'not_ready',
        'checks': checks,
        'version': '1.0.0',
    }), status_code
