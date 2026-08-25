from flask import Blueprint

api_bp = Blueprint('api', __name__)

# Import routes to register handlers to api_bp
from app.api import web, image, video, download  # noqa: E402, F401
