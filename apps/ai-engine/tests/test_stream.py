import pytest

from core.stream import DEFAULT_TARGET_FPS, VideoStreamReader, parse_target_fps


def test_parse_target_fps_uses_default_when_not_configured():
    assert parse_target_fps(None) == DEFAULT_TARGET_FPS


@pytest.mark.parametrize("value", ["0.5", "5", 10, 30])
def test_parse_target_fps_accepts_supported_values(value):
    assert parse_target_fps(value) == float(value)


@pytest.mark.parametrize("value", ["invalid", "0", "30.1", float("nan")])
def test_parse_target_fps_rejects_invalid_values(value):
    with pytest.raises(ValueError, match="STREAM_TARGET_FPS"):
        parse_target_fps(value)


def test_video_stream_reader_uses_validated_target_fps():
    reader = VideoStreamReader(target_fps=5)

    assert reader.target_fps == 5
    assert reader.frame_interval == 0.2
