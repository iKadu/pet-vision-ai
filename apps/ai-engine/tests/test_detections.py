import unittest

from core.detections import normalize_detections, suppress_overlapping_detections
from core.detection_settings import (
    parse_detection_confidence_threshold,
    parse_detection_image_size,
)


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

    def test_suppresses_overlapping_detections_of_the_same_species(self):
        detections = [
            {"class_id": 16, "confidence": 0.95, "bbox": {"x": 0.2, "y": 0.2, "width": 0.4, "height": 0.4}},
            {"class_id": 16, "confidence": 0.82, "bbox": {"x": 0.22, "y": 0.22, "width": 0.4, "height": 0.4}},
            {"class_id": 15, "confidence": 0.9, "bbox": {"x": 0.22, "y": 0.22, "width": 0.4, "height": 0.4}},
        ]

        result = suppress_overlapping_detections(detections)

        self.assertEqual(result, [detections[0], detections[2]])

    def test_suppresses_partially_overlapping_boxes_at_the_runtime_threshold(self):
        detections = [
            {"class_id": 16, "confidence": 0.95, "bbox": {"x": 0.2, "y": 0.2, "width": 0.4, "height": 0.4}},
            {"class_id": 16, "confidence": 0.82, "bbox": {"x": 0.3, "y": 0.2, "width": 0.4, "height": 0.4}},
        ]

        result = suppress_overlapping_detections(detections, iou_threshold=0.55)

        self.assertEqual(result, [detections[0]])

    def test_parses_a_yolo_compatible_detection_image_size(self):
        self.assertEqual(parse_detection_image_size(None), 768)
        self.assertEqual(parse_detection_image_size("640"), 640)

        with self.assertRaises(ValueError):
            parse_detection_image_size("641")

    def test_parses_a_detection_confidence_threshold(self):
        self.assertEqual(parse_detection_confidence_threshold(None), 0.18)
        self.assertEqual(parse_detection_confidence_threshold("0.25"), 0.25)

        with self.assertRaises(ValueError):
            parse_detection_confidence_threshold("1")


if __name__ == "__main__":
    unittest.main()
