import numpy as np
import pytest

from core.stream import (
    DEFAULT_PREVIEW_FPS,
    DEFAULT_TARGET_FPS,
    VideoStreamReader,
    parse_preview_fps,
    parse_target_fps,
)


def test_parse_target_fps_uses_default_when_not_configured():
    assert parse_target_fps(None) == DEFAULT_TARGET_FPS


def test_parse_preview_fps_uses_default_when_not_configured():
    assert parse_preview_fps(None) == DEFAULT_PREVIEW_FPS


@pytest.mark.parametrize("value", ["0.5", "5", 10, 30])
def test_parse_target_fps_accepts_supported_values(value):
    assert parse_target_fps(value) == float(value)


@pytest.mark.parametrize("value", ["invalid", "0", "30.1", float("nan")])
def test_parse_target_fps_rejects_invalid_values(value):
    with pytest.raises(ValueError, match="STREAM_TARGET_FPS"):
        parse_target_fps(value)


@pytest.mark.parametrize("value", ["invalid", "0", "30.1", float("nan")])
def test_parse_preview_fps_rejects_invalid_values(value):
    with pytest.raises(ValueError, match="STREAM_PREVIEW_FPS"):
        parse_preview_fps(value)


def test_video_stream_reader_uses_validated_target_fps():
    reader = VideoStreamReader(target_fps=5, preview_fps=30)

    assert reader.target_fps == 5
    assert reader.frame_interval == 0.2
    assert reader.preview_fps == 30
    assert reader.preview_interval == pytest.approx(1 / 30)


def test_video_stream_reader_keeps_only_the_latest_frame():
    reader = VideoStreamReader()
    first_frame = np.zeros((2, 2, 3), dtype=np.uint8)
    newest_frame = np.full((2, 2, 3), 255, dtype=np.uint8)

    reader._publish_frame(first_frame)
    reader._publish_frame(newest_frame)
    frame, sequence = reader.get_latest_frame_with_sequence()

    assert sequence == 2
    assert frame is not None
    assert np.array_equal(frame, newest_frame)
