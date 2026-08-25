import concurrent.futures
import io
from pathlib import Path
import pytest

from app import create_app

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def test_ten_concurrent_image_requests():
    """Simulate 10 concurrent users uploading images simultaneously."""
    app = create_app()
    app.config.update({"TESTING": True})

    img_path = PROJECT_ROOT / "samples" / "images" / "pho.jpg"
    with open(img_path, "rb") as f:
        image_bytes = f.read()

    def send_request(user_index: int):
        client = app.test_client()
        response = client.post(
            "/image",
            data={"image": (io.BytesIO(image_bytes), f"user_{user_index}_pho.jpg")},
            content_type="multipart/form-data"
        )
        return {
            "status_code": response.status_code,
            "json": response.get_json(),
            "user_index": user_index,
        }

    # Run 10 concurrent workers
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_request, i) for i in range(10)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]

    # Assertions
    assert len(results) == 10

    job_ids = set()
    for res in results:
        # Verify 0% error rate
        assert res["status_code"] == 200
        payload = res["json"]
        assert payload["success"] is True
        assert payload["total_detections"] >= 1
        assert "job_id" in payload

        # Verify Job Isolation: All 10 job_ids must be unique
        job_ids.add(payload["job_id"])

    assert len(job_ids) == 10, "Race condition detected: job_ids were duplicated across concurrent requests"
