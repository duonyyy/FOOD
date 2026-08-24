def bbox_iou(first_bbox, second_bbox):
    x1 = max(first_bbox['x1'], second_bbox['x1'])
    y1 = max(first_bbox['y1'], second_bbox['y1'])
    x2 = min(first_bbox['x2'], second_bbox['x2'])
    y2 = min(first_bbox['y2'], second_bbox['y2'])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    first_area = max(0, first_bbox['x2'] - first_bbox['x1']) * max(0, first_bbox['y2'] - first_bbox['y1'])
    second_area = max(0, second_bbox['x2'] - second_bbox['x1']) * max(0, second_bbox['y2'] - second_bbox['y1'])
    union = first_area + second_area - intersection
    return intersection / union if union else 0.0


class FoodTracker:
    def __init__(self, iou_threshold=0.3, max_missed_samples=3):
        self.iou_threshold = iou_threshold
        self.max_missed_samples = max_missed_samples
        self.tracks = []
        self.next_id = 0
        self.counts = {}

    def update(self, detections):
        for track in self.tracks:
            track['missed'] += 1
        matched_ids = set()

        for detection in detections:
            best_track = None
            best_iou = 0.0
            for track in self.tracks:
                if track['id'] in matched_ids or track['class_name'] != detection['class_name']:
                    continue
                overlap = bbox_iou(track['bbox'], detection['bbox'])
                if overlap > best_iou:
                    best_iou = overlap
                    best_track = track

            if best_track is not None and best_iou >= self.iou_threshold:
                matched_ids.add(best_track['id'])
                best_track['bbox'] = detection['bbox']
                best_track['missed'] = 0
            else:
                self.tracks.append({
                    'id': self.next_id,
                    'class_name': detection['class_name'],
                    'bbox': detection['bbox'],
                    'missed': 0,
                })
                if detection['class_name'] != 'Unknown':
                    self.counts[detection['class_name']] = self.counts.get(detection['class_name'], 0) + 1
                self.next_id += 1

        self.tracks = [track for track in self.tracks if track['missed'] <= self.max_missed_samples]