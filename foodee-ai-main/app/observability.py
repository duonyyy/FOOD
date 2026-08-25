"""Observability module providing Structured JSON Logging and Request Tracking."""
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from flask import Flask, g, has_request_context, has_app_context, request, Response


class JSONLogFormatter(logging.Formatter):
    """Format log records as structured JSON."""

    def format(self, record: logging.LogRecord) -> str:
        req_id = None
        if has_request_context() or has_app_context():
            req_id = getattr(g, "request_id", None)

        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": req_id,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data, ensure_ascii=False)


def init_observability(app: Flask) -> None:
    """Initialize structured logging and request ID tracking hooks on the Flask app."""
    # Configure root logger handler
    handler = logging.StreamHandler()
    handler.setFormatter(JSONLogFormatter())

    # Avoid duplicate handlers
    if not app.logger.handlers:
        app.logger.addHandler(handler)
    else:
        app.logger.handlers[0].setFormatter(JSONLogFormatter())

    app.logger.setLevel(logging.INFO)

    @app.before_request
    def before_request_hook():
        # Task 11.1: Request ID Tracking (preserve incoming X-Request-ID or generate new UUID4)
        req_id = request.headers.get("X-Request-ID")
        if not req_id or not req_id.strip():
            req_id = str(uuid.uuid4())
        g.request_id = req_id.strip()
        g.start_time = time.perf_counter()

    @app.after_request
    def after_request_hook(response: Response) -> Response:
        # Attach X-Request-ID header to response
        if hasattr(g, "request_id"):
            response.headers["X-Request-ID"] = g.request_id

        # Task 11.2: Structured JSON log for every request
        latency_ms = 0.0
        if hasattr(g, "start_time"):
            latency_ms = round((time.perf_counter() - g.start_time) * 1000, 2)

        # Do not flood logs during testing or static asset requests if suppressed
        if request.path not in ["/favicon.ico"]:
            log_payload = {
                "request_id": getattr(g, "request_id", None),
                "endpoint": request.path,
                "method": request.method,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
                "ip": request.remote_addr,
            }
            app.logger.info(f"HTTP {request.method} {request.path} {response.status_code} ({latency_ms}ms)", extra=log_payload)

        return response
