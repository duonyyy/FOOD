"""Phase Test E: End-to-End Integration & Regression Tests.

Full-flow tests simulating real user scenarios:
upload → detect → download, verifying JSON contracts
and backward-compatibility fallbacks.
"""

import io
import json
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class TestFullImageFlow:
    """End-to-end tests for the complete image processing flow."""

    def test_upload_detect_download_round_trip(self, client, sample_image_bytes):
        """Upload image → receive detections → download annotated image → verify."""
        # Step 1: Upload image
        resp = client.post(
            '/image',
            data={'image': (io.BytesIO(sample_image_bytes), 'pho.jpg')},
            content_type='multipart/form-data',
        )
        assert resp.status_code == 200
        res = resp.get_json()
        assert res['success'] is True
        job_id = res['job_id']
        assert res['total_detections'] >= 1

        # Step 2: Download annotated image by job_id
        download_resp = client.get(f'/download/image?job_id={job_id}')
        assert download_resp.status_code == 200
        assert len(download_resp.data) > 0
        # Verify it's a valid JPEG (starts with FF D8 FF)
        assert download_resp.data[:3] == b'\xff\xd8\xff'

    def test_multiple_uploads_then_download_each(self, client, sample_image_bytes):
        """Upload 3 images, download each by job_id, verify each is distinct."""
        job_ids = []
        for _ in range(3):
            resp = client.post(
                '/image',
                data={'image': (io.BytesIO(sample_image_bytes), 'pho.jpg')},
                content_type='multipart/form-data',
            )
            assert resp.status_code == 200
            res = resp.get_json()
            assert res['success'] is True
            job_ids.append(res['job_id'])

        # All job_ids must be unique
        assert len(set(job_ids)) == 3

        # Each job_id must return a downloadable file
        for jid in job_ids:
            download_resp = client.get(f'/download/image?job_id={jid}')
            assert download_resp.status_code == 200
            assert len(download_resp.data) > 0


class TestJSONContractStability:
    """Verify API JSON response structures remain stable for client compatibility."""

    def test_image_success_response_contract(self, client, sample_image_bytes):
        """Successful /image response must contain exactly the expected fields."""
        resp = client.post(
            '/image',
            data={'image': (io.BytesIO(sample_image_bytes), 'pho.jpg')},
            content_type='multipart/form-data',
        )
        assert resp.status_code == 200
        res = resp.get_json()

        # Contract: these exact keys must exist
        required_keys = {'success', 'job_id', 'detections', 'total_detections', 'class_counts'}
        assert required_keys == set(res.keys()), f"Missing/extra keys: {set(res.keys()) ^ required_keys}"
        assert isinstance(res['success'], bool)
        assert isinstance(res['job_id'], str)
        assert isinstance(res['detections'], list)
        assert isinstance(res['total_detections'], int)
        assert isinstance(res['class_counts'], dict)

    def test_error_response_contract(self, client):
        """All error responses must contain exactly: success, error, code."""
        # Trigger a 400 error (missing file)
        resp = client.post('/image', data={}, content_type='multipart/form-data')
        assert resp.status_code == 400
        res = resp.get_json()

        required_keys = {'success', 'error', 'code'}
        assert required_keys == set(res.keys()), f"Error response missing/extra keys: {set(res.keys()) ^ required_keys}"
        assert res['success'] is False
        assert isinstance(res['error'], str)
        assert isinstance(res['code'], str)


class TestBackwardCompatibility:
    """Verify backward-compatible fallback behaviors."""

    def test_fallback_download_without_job_id(self, client, sample_image_bytes):
        """Download /download/image without job_id should return fallback file after upload."""
        # Upload first to populate fallback
        client.post(
            '/image',
            data={'image': (io.BytesIO(sample_image_bytes), 'pho.jpg')},
            content_type='multipart/form-data',
        )
        # Download without job_id (fallback)
        resp = client.get('/download/image')
        assert resp.status_code == 200
        assert len(resp.data) > 0

    def test_home_page_serves_html_demo(self, client):
        """GET / must serve HTML demo page for backward compatibility."""
        resp = client.get('/')
        assert resp.status_code == 200
        assert 'text/html' in resp.content_type
