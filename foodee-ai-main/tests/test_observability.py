"""Phase 11: Observability, Health Checks & Request Tracking Tests."""
import json
import pytest


def test_health_liveness_endpoint(client):
    """GET /health should return 200 with service information and uptime."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "foodee-ai"
    assert "version" in data
    assert "uptime_seconds" in data
    assert "X-Request-ID" in response.headers


def test_ready_readiness_endpoint(client):
    """GET /ready should return 200 when models and storage are ready."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ready"
    assert data["checks"]["detection_model"] is True
    assert data["checks"]["classifier_model"] is True
    assert data["checks"]["storage_ready"] is True
    assert "X-Request-ID" in response.headers


def test_request_id_generation_and_propagation(client):
    """Verify that incoming X-Request-ID is preserved and echoed back."""
    custom_id = "test-req-id-123456"
    response = client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id

    # Automatic generation if missing
    res_auto = client.get("/health")
    assert "X-Request-ID" in res_auto.headers
    assert len(res_auto.headers["X-Request-ID"]) > 10


def test_structured_json_logging_format(app):
    """Verify JSONLogFormatter formats records into valid JSON with request_id."""
    import logging
    from app.observability import JSONLogFormatter

    formatter = JSONLogFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="Test structured message",
        args=(),
        exc_info=None,
    )
    formatted = formatter.format(record)
    parsed = json.loads(formatted)
    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "test_logger"
    assert parsed["message"] == "Test structured message"
    assert "timestamp" in parsed
