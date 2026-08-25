import re
import shutil
import uuid
from pathlib import Path
import cv2
import numpy as np


class JobStorageManager:
    """Manages job-isolated storage in runtime/jobs/{job_id} and backward-compatible fallbacks."""

    JOB_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{8,64}$')

    def __init__(self, base_folder: Path | str):
        self.base_folder = Path(base_folder).resolve()
        self.jobs_dir = self.base_folder / 'jobs'
        self.jobs_dir.mkdir(parents=True, exist_ok=True)

    def is_valid_job_id(self, job_id: str | None) -> bool:
        """Verify that job_id contains only safe alphanumeric characters without path traversal."""
        if not job_id or not isinstance(job_id, str):
            return False
        return bool(self.JOB_ID_PATTERN.match(job_id))

    def _is_safe_path(self, target_path: Path) -> bool:
        """Verify that target_path is strictly within the base runtime folder sandbox."""
        try:
            target_path.resolve().relative_to(self.base_folder)
            return True
        except ValueError:
            return False

    def create_job(self) -> str:
        """Create an isolated workspace directory for a new request."""
        job_id = uuid.uuid4().hex
        job_path = self.jobs_dir / job_id
        job_path.mkdir(parents=True, exist_ok=True)
        return job_id

    def get_job_dir(self, job_id: str) -> Path:
        """Get the isolated directory path for a specific job."""
        if not self.is_valid_job_id(job_id):
            raise ValueError("Invalid job ID format")
        job_path = (self.jobs_dir / job_id).resolve()
        if not self._is_safe_path(job_path):
            raise ValueError("Path traversal attempt detected")
        return job_path

    def get_input_video_path(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / 'input.mp4'

    def get_processed_video_path(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / 'processed.mp4'

    def get_processed_image_path(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / 'processed_image.jpg'

    def save_annotated_image(self, job_id: str, image: np.ndarray) -> Path:
        """Save annotated image to job folder and sync to runtime root for fallback."""
        job_image_path = self.get_processed_image_path(job_id)
        cv2.imwrite(str(job_image_path), image)

        # Backward compatibility fallback
        fallback_path = self.base_folder / 'processed_image.jpg'
        try:
            shutil.copyfile(str(job_image_path), str(fallback_path))
        except Exception:
            cv2.imwrite(str(fallback_path), image)

        return job_image_path

    def sync_processed_video(self, job_id: str) -> Path:
        """Sync job processed video to runtime root for backward compatibility."""
        job_video_path = self.get_processed_video_path(job_id)
        fallback_path = self.base_folder / 'processed_video.mp4'
        if job_video_path.exists():
            try:
                shutil.copyfile(str(job_video_path), str(fallback_path))
            except Exception:
                pass
        return fallback_path

    def get_download_file(self, file_type: str, job_id: str | None = None) -> tuple[Path | None, str]:
        """Resolve file path and download filename for client downloads with sandbox validation."""
        if job_id and not self.is_valid_job_id(job_id):
            raise ValueError("Invalid job ID format")

        if file_type == 'image':
            download_name = 'processed_image.jpg'
            if job_id:
                job_file = (self.jobs_dir / job_id / download_name).resolve()
                if self._is_safe_path(job_file) and job_file.exists():
                    return job_file, download_name
            fallback_file = (self.base_folder / download_name).resolve()
            if self._is_safe_path(fallback_file) and fallback_file.exists():
                return fallback_file, download_name
            return None, download_name

        if file_type == 'video':
            download_name = 'processed_video.mp4'
            if job_id:
                job_file = (self.jobs_dir / job_id / 'processed.mp4').resolve()
                if self._is_safe_path(job_file) and job_file.exists():
                    return job_file, download_name
            fallback_file = (self.base_folder / download_name).resolve()
            if self._is_safe_path(fallback_file) and fallback_file.exists():
                return fallback_file, download_name
            return None, download_name

        return None, ''
