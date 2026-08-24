from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.services.inference import FoodInferenceService


def create_app():
	app = Flask(__name__)
	app.config.from_object(Config)
	app.config['UPLOAD_FOLDER'] = str(Config.UPLOAD_FOLDER)
	app.config['APP_CONFIG'] = Config
	Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
	CORS(app)

	@app.errorhandler(413)
	def request_too_large(_error):
		return {'error': 'File exceeds the 100 MB upload limit'}, 413

	app.extensions['food_inference'] = FoodInferenceService(Config)

	from app.routes import api
	app.register_blueprint(api)
	return app


app = create_app()
