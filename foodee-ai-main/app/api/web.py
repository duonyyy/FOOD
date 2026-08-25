from flask import render_template
from app.api import api_bp


@api_bp.get('/')
def home():
    return render_template('demo.html')
