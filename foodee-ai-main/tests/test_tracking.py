import pytest
from app.services.tracking import FoodTracker, bbox_iou


def test_bbox_iou_identical():
    box = {"x1": 0, "y1": 0, "x2": 100, "y2": 100}
    assert bbox_iou(box, box) == pytest.approx(1.0)


def test_bbox_iou_disjoint():
    box1 = {"x1": 0, "y1": 0, "x2": 10, "y2": 10}
    box2 = {"x1": 100, "y1": 100, "x2": 110, "y2": 110}
    assert bbox_iou(box1, box2) == 0.0


def test_bbox_iou_partial_overlap():
    box1 = {"x1": 0, "y1": 0, "x2": 10, "y2": 10}
    box2 = {"x1": 5, "y1": 0, "x2": 15, "y2": 10}
    # Intersection = 5 * 10 = 50. Union = 100 + 100 - 50 = 150. IoU = 50 / 150 = 1/3
    assert bbox_iou(box1, box2) == pytest.approx(1.0 / 3.0)


def test_tracker_overlapping_detection_deduplication():
    tracker = FoodTracker(iou_threshold=0.3)
    tracker.update([{"class_name": "Phở", "bbox": {"x1": 0, "y1": 0, "x2": 100, "y2": 100}}])
    tracker.update([{"class_name": "Phở", "bbox": {"x1": 10, "y1": 10, "x2": 90, "y2": 90}}])
    assert tracker.counts == {"Phở": 1}


def test_tracker_non_overlapping_new_item():
    tracker = FoodTracker(iou_threshold=0.3)
    tracker.update([{"class_name": "Phở", "bbox": {"x1": 0, "y1": 0, "x2": 100, "y2": 100}}])
    tracker.update([{"class_name": "Phở", "bbox": {"x1": 200, "y1": 200, "x2": 300, "y2": 300}}])
    assert tracker.counts == {"Phở": 2}


def test_tracker_ignores_unknown_class():
    tracker = FoodTracker()
    tracker.update([{"class_name": "Unknown", "bbox": {"x1": 0, "y1": 0, "x2": 100, "y2": 100}}])
    assert tracker.counts == {}


def test_tracker_missed_samples_aging():
    tracker = FoodTracker(max_missed_samples=2)
    tracker.update([{"class_name": "Cơm tấm", "bbox": {"x1": 0, "y1": 0, "x2": 50, "y2": 50}}])
    assert len(tracker.tracks) == 1

    # Frame without detections: increment missed
    tracker.update([])
    assert len(tracker.tracks) == 1
    assert tracker.tracks[0]["missed"] == 1

    # Exceeding max_missed_samples removes the track
    tracker.update([])
    tracker.update([])
    assert len(tracker.tracks) == 0
    # Total count remains preserved
    assert tracker.counts == {"Cơm tấm": 1}
