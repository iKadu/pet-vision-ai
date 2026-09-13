import unittest

from core.detections import normalize_detections


class Value:
    def __init__(self, value):
        self.value = value

    def item(self):
        return self.value


class Coordinates:
    def __init__(self, values):
        self.values = values

    def tolist(self):
        return self.values


class Box:
    def __init__(self, xyxy, class_id=16, confidence=0.98765):
        self.xyxy = [Coordinates(xyxy)]
        self.cls = [Value(class_id)]
        self.conf = [Value(confidence)]


class NormalizeDetectionsTests(unittest.TestCase):
    def test_normalizes_xyxy_to_top_left_and_size(self):
        result = normalize_detections([Box([160, 90, 480, 270])], 640, 360, {16: "dog"})

        self.assertEqual(
            result,
            [{
                "class_id": 16,
                "class_name": "dog",
                "confidence": 0.9877,
                "bbox": {"x": 0.25, "y": 0.25, "width": 0.5, "height": 0.5},
                "centroid": {"x": 0.5, "y": 0.5},
            }],
        )

    def test_clamps_coordinates_outside_the_frame(self):
        result = normalize_detections([Box([-20, 100, 800, 400])], 640, 360, {16: "dog"})

        self.assertEqual(result[0]["bbox"], {"x": 0.0, "y": 0.277778, "width": 1.0, "height": 0.722222})
        self.assertEqual(result[0]["centroid"], {"x": 0.5, "y": 0.638889})


if __name__ == "__main__":
    unittest.main()
