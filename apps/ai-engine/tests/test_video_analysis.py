import cv2
import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from core.video_analysis import analyze_video, create_video_router, presence_intervals


def test_presence_intervals_close_on_negative_and_end_of_video():
    samples = [{"time_seconds": i * .2, "detections": [1] if i in [0, 1, 3] else []} for i in range(4)]
    assert presence_intervals(samples, .7, .2) == [
        {"start_seconds": 0, "end_seconds": .4},
        {"start_seconds": pytest.approx(.6), "end_seconds": .7},
    ]


def test_decodes_video_and_uses_source_time_not_processing_time(tmp_path):
    path = tmp_path / 'sample.avi'
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'MJPG'), 10, (64, 48))
    assert writer.isOpened()
    for _ in range(10):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()
    class Detector:
        device = 'cpu'
        def predict(self, frame, **kwargs):
            assert kwargs['classes'] == [16]
            return [type('Result', (), {'boxes': []})()]
    result = analyze_video(path, Detector(), lambda _: None)
    assert result['duration_seconds'] == 1
    assert result['analyzed_frames'] == 5
    assert result['samples'][-1]['time_seconds'] == .8
    assert result['intervals'] == []
    class DogDetector:
        device = 'cpu'
        def predict(self, frame, **kwargs):
            box = type('Box', (), {'xyxy': np.array([[16, 12, 48, 36]]), 'conf': [.9]})()
            return [type('Result', (), {'boxes': [box]})()]
    detected = analyze_video(path, DogDetector(), lambda _: None)
    assert detected['frames_with_dogs'] == 5
    assert detected['max_dogs'] == 1
    assert detected['presence_seconds'] == 1
    assert detected['samples'][0]['detections'][0]['bbox'] == {
        'x': .25, 'y': .25, 'width': .5, 'height': .5,
    }


def test_invalid_video_rejected(tmp_path):
    path = tmp_path / 'invalid.mp4'
    path.write_bytes(b'not a video')
    with pytest.raises(ValueError, match='inválido'):
        analyze_video(path, None, lambda _: None)


def test_routes_require_owner_and_reject_invalid_uploads():
    app = FastAPI()
    app.include_router(create_video_router())
    client = TestClient(app)
    assert client.post('/videos', content=b'x').status_code == 401
    assert client.post('/videos', content=b'x', headers={'x-video-owner': 'a', 'content-type': 'text/plain'}).status_code == 415
    assert client.post('/videos', content=b'', headers={'x-video-owner': 'a', 'content-type': 'video/mp4'}).status_code == 400
    assert client.get('/videos/unknown', headers={'x-video-owner': 'b'}).status_code == 404
