import pytest
import numpy as np
from pathlib import Path

from app.services.storage import JobStorageManager


def test_create_job_generates_valid_hex_id(tmp_storage):
    job_id = tmp_storage.create_job()
    assert isinstance(job_id, str)
    assert len(job_id) == 32
    assert tmp_storage.is_valid_job_id(job_id)
    assert (tmp_storage.jobs_dir / job_id).is_dir()


def test_job_paths_resolution(tmp_storage):
    job_id = tmp_storage.create_job()
    input_video = tmp_storage.get_input_video_path(job_id)
    processed_video = tmp_storage.get_processed_video_path(job_id)
    processed_image = tmp_storage.get_processed_image_path(job_id)

    assert input_video.name == "input.mp4"
    assert processed_video.name == "processed.mp4"
    assert processed_image.name == "processed_image.jpg"


def test_path_traversal_detection(tmp_storage):
    assert not tmp_storage.is_valid_job_id("../secret")
    assert not tmp_storage.is_valid_job_id("job/with/slashes")
    assert not tmp_storage.is_valid_job_id("job\\backslash")

    with pytest.raises(ValueError, match="Invalid job ID format"):
        tmp_storage.get_job_dir("../../etc")

    with pytest.raises(ValueError, match="Invalid job ID format"):
        tmp_storage.get_download_file("image", job_id="../../windows/win.ini")


def test_save_annotated_image_and_fallback_sync(tmp_storage):
    job_id = tmp_storage.create_job()
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)

    saved_path = tmp_storage.save_annotated_image(job_id, dummy_img)
    assert saved_path.exists()
    assert saved_path.name == "processed_image.jpg"

    # Verify fallback file exists in base folder
    fallback_path = tmp_storage.base_folder / "processed_image.jpg"
    assert fallback_path.exists()


def test_get_download_file_with_and_without_job_id(tmp_storage):
    job_id = tmp_storage.create_job()
    dummy_img = np.zeros((50, 50, 3), dtype=np.uint8)
    tmp_storage.save_annotated_image(job_id, dummy_img)

    # Download with valid job_id
    file_path, filename = tmp_storage.get_download_file("image", job_id=job_id)
    assert file_path is not None
    assert file_path.exists()
    assert filename == "processed_image.jpg"

    # Download with fallback (no job_id)
    fallback_file, fallback_name = tmp_storage.get_download_file("image")
    assert fallback_file is not None
    assert fallback_file.exists()
    assert fallback_name == "processed_image.jpg"

    # Invalid file_type returns None
    invalid_file, _ = tmp_storage.get_download_file("audio")
    assert invalid_file is None
