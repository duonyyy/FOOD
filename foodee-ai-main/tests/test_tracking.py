import unittest

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


if __name__ == '__main__':
    unittest.main()