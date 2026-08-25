from flask import Flask, jsonify
from flask_cors import CORS

from app.config import Config
from app.observability import init_observability
from app.services.inference import FoodInferenceService
from app.services.storage import JobStorageManager


def create_app():
	app = Flask(__name__)
	app.config.from_object(Config)
	app.config['UPLOAD_FOLDER'] = str(Config.UPLOAD_FOLDER)
	app.config['APP_CONFIG'] = Config
	Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
	CORS(app, origins=Config.ALLOWED_ORIGINS)

	# Initialize Structured Logging & Request Tracking
	init_observability(app)

	# Global JSON Error Handlers
	@app.errorhandler(400)
	def bad_request(error):
		message = getattr(error, 'description', 'Bad Request')
		return jsonify({'success': False, 'error': message, 'code': 'BAD_REQUEST'}), 400

	@app.errorhandler(404)
	def not_found(error):
		message = getattr(error, 'description', 'Resource not found')
		return jsonify({'success': False, 'error': message, 'code': 'NOT_FOUND'}), 404

	@app.errorhandler(405)
	def method_not_allowed(_error):
		return jsonify({'success': False, 'error': 'Method not allowed for this endpoint', 'code': 'METHOD_NOT_ALLOWED'}), 405

	@app.errorhandler(413)
	def request_too_large(_error):
		return jsonify({'success': False, 'error': 'File exceeds the 100 MB upload limit', 'code': 'PAYLOAD_TOO_LARGE'}), 413

	@app.errorhandler(415)
	def unsupported_media_type(error):
		message = getattr(error, 'description', 'Unsupported media type')
		return jsonify({'success': False, 'error': message, 'code': 'UNSUPPORTED_MEDIA_TYPE'}), 415

	@app.errorhandler(500)
	def internal_server_error(_error):
		return jsonify({'success': False, 'error': 'An internal server error occurred', 'code': 'INTERNAL_SERVER_ERROR'}), 500

	app.extensions['food_inference'] = FoodInferenceService(Config)
	app.extensions['storage_manager'] = JobStorageManager(Config.UPLOAD_FOLDER)

	from app.api import api_bp
	app.register_blueprint(api_bp)
	return app


app = create_app()
