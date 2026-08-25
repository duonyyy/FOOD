import cv2
import numpy as np

from app.services.tracking import FoodTracker


def draw_detections(image: np.ndarray, detections: list) -> np.ndarray:
    """Draw bounding boxes and class names with confidence on an image or video frame."""
    output = image.copy()
    for detection in detections:
        bbox = detection['bbox']
        cv2.rectangle(
            output,
            (bbox['x1'], bbox['y1']),
            (bbox['x2'], bbox['y2']),
            (0, 255, 0),
            2,
        )
        label = f"{detection['class_name']} {detection['classification_confidence']:.0%}"
        cv2.putText(
            output,
            label,
            (bbox['x1'], max(20, bbox['y1'] - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )
    return output


class VideoProcessor:
    def __init__(self, inference_service, config):
        self.inference_service = inference_service
        self.config = config

    def process(self, input_path, output_path):
        capture = cv2.VideoCapture(str(input_path))
        if not capture.isOpened():
            raise ValueError('Unable to open video for processing')

        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if width <= 0 or height <= 0:
            capture.release()
            raise ValueError('Video has invalid dimensions')

        writer = cv2.VideoWriter(
            str(output_path), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height)
        )
        if not writer.isOpened():
            capture.release()
            raise ValueError('Unable to create processed video')

        tracker = FoodTracker(
            self.config.TRACK_IOU_THRESHOLD,
            self.config.TRACK_MAX_MISSED_SAMPLES,
        )
        sample_interval = max(1, round(fps / self.config.VIDEO_TARGET_FPS))
        frame_index = 0

        try:
            while True:
                success, frame = capture.read()
                if not success:
                    break
                if frame_index % sample_interval == 0:
                    detections = self.inference_service.detect_and_classify(frame)
                    tracker.update(detections)
                    frame = self._draw_detections(frame, detections)
                writer.write(frame)
                frame_index += 1
        finally:
            capture.release()
            writer.release()

        return tracker.counts

    @staticmethod
    def _draw_detections(frame, detections):
        return draw_detections(frame, detections)