import io
import json
from pathlib import Path
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def test_home_page_returns_html(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.content_type


def test_image_upload_success_default_field(client, sample_image_bytes):
    response = client.post(
        "/image",
        data={"image": (io.BytesIO(sample_image_bytes), "pho.jpg")},
        content_type="multipart/form-data"
    )
    assert response.status_code == 200
    res = response.get_json()
    assert res["success"] is True
    assert "job_id" in res
    assert "detections" in res
    assert "class_counts" in res
    assert res["total_detections"] >= 1


def test_image_upload_success_fallback_field(client, sample_image_bytes):
    response = client.post(
        "/image",
        data={"file": (io.BytesIO(sample_image_bytes), "pho.jpg")},
        content_type="multipart/form-data"
    )
    assert response.status_code == 200
    res = response.get_json()
    assert res["success"] is True
    assert res["total_detections"] >= 1


def test_image_upload_missing_file_part(client):
    response = client.post("/image", data={}, content_type="multipart/form-data")
    assert response.status_code == 400
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "MISSING_FILE_PART"


def test_image_upload_empty_filename(client):
    fake_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
    response = client.post(
        "/image",
        data={"image": (io.BytesIO(fake_header), "")},
        content_type="multipart/form-data"
    )
    assert response.status_code == 400
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "EMPTY_FILENAME"


def test_image_upload_invalid_extension(client):
    response = client.post(
        "/image",
        data={"image": (io.BytesIO(b"dummy data content"), "hack.exe")},
        content_type="multipart/form-data"
    )
    assert response.status_code == 415
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_image_upload_fake_magic_bytes_rejected(client):
    fake_payload = b"Plain text payload pretending to be a JPG image file without headers"
    response = client.post(
        "/image",
        data={"image": (io.BytesIO(fake_payload), "shell.jpg")},
        content_type="multipart/form-data"
    )
    assert response.status_code == 415
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "INVALID_IMAGE_BYTES"


def test_video_upload_fake_magic_bytes_rejected(client):
    fake_payload = b"Plain text payload pretending to be MP4 video"
    response = client.post(
        "/video",
        data={"file": (io.BytesIO(fake_payload), "bad.mp4")},
        content_type="multipart/form-data"
    )
    assert response.status_code == 415
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "INVALID_VIDEO_BYTES"


def test_download_image_with_job_id(client, sample_image_bytes):
    # First upload an image to generate job_id
    resp_upload = client.post(
        "/image",
        data={"image": (io.BytesIO(sample_image_bytes), "pho.jpg")},
        content_type="multipart/form-data"
    )
    job_id = resp_upload.get_json()["job_id"]

    # Download image by job_id
    resp_download = client.get(f"/download/image?job_id={job_id}")
    assert resp_download.status_code == 200
    assert len(resp_download.data) > 0


def test_download_path_traversal_job_id_rejected(client):
    response = client.get("/download/image?job_id=../../windows/win.ini")
    assert response.status_code == 400
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "INVALID_JOB_ID"


def test_download_path_traversal_route_rejected(client):
    response = client.get("/download/..%2f..%2fetc%2fpasswd")
    assert response.status_code in (400, 404)
    res = response.get_json()
    assert res["success"] is False


def test_global_404_json_handler(client):
    response = client.get("/api/nonexistent_endpoint")
    assert response.status_code == 404
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "NOT_FOUND"


def test_global_405_json_handler(client):
    response = client.put("/image")
    assert response.status_code == 405
    res = response.get_json()
    assert res["success"] is False
    assert res["code"] == "METHOD_NOT_ALLOWED"


def test_golden_dataset_all_images(client):
    golden_path = PROJECT_ROOT / "tests" / "golden_dataset.json"
    if not golden_path.exists():
        pytest.skip("Golden dataset not found")

    with open(golden_path, "r", encoding="utf-8") as f:
        golden = json.load(f)

    for img_name, expected in golden["images"].items():
        img_p = PROJECT_ROOT / "samples" / "images" / img_name
        with open(img_p, "rb") as f:
            data = f.read()
        r = client.post(
            "/image",
            data={"image": (io.BytesIO(data), img_name)},
            content_type="multipart/form-data"
        )
        assert r.status_code == 200
        res = r.get_json()
        assert res["total_detections"] == expected["response"]["total_detections"]
        assert res["class_counts"] == expected["response"]["class_counts"]
