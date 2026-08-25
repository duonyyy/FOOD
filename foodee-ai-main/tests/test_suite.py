import io
import json
import os
import sys
import unittest
from pathlib import Path

import torch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(str(PROJECT_ROOT))

from app import create_app
from app.services.tracking import FoodTracker, bbox_iou


class FoodTrackerTests(unittest.TestCase):
    def setUp(self):
        self.bbox = {'x1': 0, 'y1': 0, 'x2': 100, 'y2': 100}

    def test_overlapping_detection_is_not_counted_twice(self):
        tracker = FoodTracker(iou_threshold=0.3)
        tracker.update([{'class_name': 'Phở', 'bbox': self.bbox}])
        tracker.update([{'class_name': 'Phở', 'bbox': {'x1': 10, 'y1': 10, 'x2': 90, 'y2': 90}}])
        self.assertEqual(tracker.counts, {'Phở': 1})

    def test_non_overlapping_detection_is_counted(self):
        tracker = FoodTracker(iou_threshold=0.3)
        tracker.update([{'class_name': 'Phở', 'bbox': self.bbox}])
        tracker.update([{'class_name': 'Phở', 'bbox': {'x1': 200, 'y1': 200, 'x2': 300, 'y2': 300}}])
        self.assertEqual(tracker.counts, {'Phở': 2})

    def test_unknown_is_not_counted(self):
        tracker = FoodTracker()
        tracker.update([{'class_name': 'Unknown', 'bbox': self.bbox}])
        self.assertEqual(tracker.counts, {})

    def test_iou(self):
        self.assertAlmostEqual(bbox_iou(self.bbox, self.bbox), 1.0)


class Phase2SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_magic_bytes_fake_jpg_rejected(self):
        fake_text_jpg = b"Plain text disguised as a JPG file without JPEG magic bytes"
        response = self.client.post(
            "/image",
            data={"image": (io.BytesIO(fake_text_jpg), "fake.jpg")},
            content_type="multipart/form-data"
        )
        self.assertEqual(response.status_code, 415)
        res = response.get_json()
        self.assertFalse(res["success"])
        self.assertIn("Invalid image file content", res["error"])
        self.assertEqual(res["code"], "INVALID_IMAGE_BYTES")

    def test_magic_bytes_fake_png_rejected(self):
        fake_png = b"Random non-image binary data text payload"
        response = self.client.post(
            "/image",
            data={"image": (io.BytesIO(fake_png), "exploit.png")},
            content_type="multipart/form-data"
        )
        self.assertEqual(response.status_code, 415)
        self.assertFalse(response.get_json()["success"])

    def test_magic_bytes_fake_mp4_rejected(self):
        fake_mp4 = b"Fake text data pretending to be mp4 without ftyp box"
        response = self.client.post(
            "/video",
            data={"file": (io.BytesIO(fake_mp4), "bad.mp4")},
            content_type="multipart/form-data"
        )
        self.assertEqual(response.status_code, 415)
        self.assertEqual(response.get_json()["code"], "INVALID_VIDEO_BYTES")

    def test_path_traversal_route_rejected(self):
        response = self.client.get("/download/..%2f..%2fetc%2fpasswd")
        self.assertIn(response.status_code, (400, 404))
        self.assertFalse(response.get_json()["success"])

    def test_path_traversal_job_id_rejected(self):
        response = self.client.get("/download/image?job_id=../../windows/win.ini")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid job ID", response.get_json()["error"])
        self.assertEqual(response.get_json()["code"], "INVALID_JOB_ID")

    def test_invalid_chars_job_id_rejected(self):
        response = self.client.get("/download/image?job_id=test/slash/id")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    def test_safe_torch_load_weights_only(self):
        ckpt_path = PROJECT_ROOT / "models" / "classification" / "best_efficientnet_b2_30vnfoods_finetuned.pth"
        if not ckpt_path.exists():
            ckpt_path = PROJECT_ROOT / "best_efficientnet_b2_30vnfoods_finetuned.pth"
        checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=True)
        self.assertIn("model_state_dict", checkpoint)
        self.assertIn("num_classes", checkpoint)

    def test_cors_config_loaded(self):
        self.assertIsNotNone(self.app.config["APP_CONFIG"].ALLOWED_ORIGINS)

    def test_golden_images_pass_with_security_enabled(self):
        golden_path = PROJECT_ROOT / "tests" / "golden_dataset.json"
        if not golden_path.exists():
            return
        with open(golden_path, "r", encoding="utf-8") as f:
            golden = json.load(f)

        for img_name, expected in golden["images"].items():
            img_p = PROJECT_ROOT / "samples" / "images" / img_name
            with open(img_p, "rb") as f:
                data = f.read()
            r = self.client.post(
                "/image",
                data={"image": (io.BytesIO(data), img_name)},
                content_type="multipart/form-data"
            )
            self.assertEqual(r.status_code, 200)
            res = r.get_json()
            self.assertEqual(res["total_detections"], expected["response"]["total_detections"])
            self.assertEqual(res["class_counts"], expected["response"]["class_counts"])


class Phase3ContractStabilizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_home_page_returns_html(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.content_type)

    def test_multipart_fallback_image_using_file_field(self):
        img_path = PROJECT_ROOT / "samples" / "images" / "pho.jpg"
        with open(img_path, "rb") as f:
            data = f.read()
        response = self.client.post(
            "/image",
            data={"file": (io.BytesIO(data), "pho.jpg")},
            content_type="multipart/form-data"
        )
        self.assertEqual(response.status_code, 200)
        res = response.get_json()
        self.assertTrue(res["success"])
        self.assertEqual(res["total_detections"], 1)
        self.assertEqual(res["class_counts"], {"Phở": 1})

    def test_global_404_json_handler(self):
        response = self.client.get("/api/nonexistent_endpoint")
        self.assertEqual(response.status_code, 404)
        res = response.get_json()
        self.assertIsNotNone(res)
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "NOT_FOUND")

    def test_global_405_json_handler(self):
        response = self.client.put("/image")
        self.assertEqual(response.status_code, 405)
        res = response.get_json()
        self.assertIsNotNone(res)
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "METHOD_NOT_ALLOWED")

    def test_missing_file_part_returns_unified_json(self):
        response = self.client.post("/image", data={}, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 400)
        res = response.get_json()
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "MISSING_FILE_PART")

    def test_empty_filename_rejected(self):
        fake_jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb"
        response = self.client.post(
            "/image",
            data={"image": (io.BytesIO(fake_jpg), "")},
            content_type="multipart/form-data"
        )
        self.assertEqual(response.status_code, 400)
        res = response.get_json()
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "EMPTY_FILENAME")

    def test_download_image_endpoint(self):
        img_path = PROJECT_ROOT / "samples" / "images" / "bunbohue.jpg"
        with open(img_path, "rb") as f:
            data = f.read()
        resp_upload = self.client.post(
            "/image",
            data={"image": (io.BytesIO(data), "bunbohue.jpg")},
            content_type="multipart/form-data"
        )
        self.assertEqual(resp_upload.status_code, 200)
        job_id = resp_upload.get_json()["job_id"]

        resp_dl = self.client.get(f"/download/image?job_id={job_id}")
        self.assertEqual(resp_dl.status_code, 200)
        self.assertGreater(len(resp_dl.data), 0)


if __name__ == '__main__':
    unittest.main()
