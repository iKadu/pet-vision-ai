import unittest

import cv2
import numpy as np

from core.embedding_service import ImageEmbeddingService
from core.embeddings import PetEmbedding


class FakeExtractor:
    def __init__(self):
        self.images = []

    def extract(self, image):
        self.images.append(image)
        return PetEmbedding(
            values=[0.6, 0.8],
            model_name="fake-model",
            pretrained_weights="fake-weights",
        )


class ImageEmbeddingServiceTests(unittest.TestCase):
    def test_decodes_image_and_reuses_the_same_extractor(self):
        created_extractors = []

        def create_extractor():
            extractor = FakeExtractor()
            created_extractors.append(extractor)
            return extractor

        image = np.zeros((8, 8, 3), dtype=np.uint8)
        success, encoded = cv2.imencode(".jpg", image)
        self.assertTrue(success)

        service = ImageEmbeddingService(extractor_factory=create_extractor)
        first = service.extract_from_bytes(encoded.tobytes())
        second = service.extract_from_bytes(encoded.tobytes())

        self.assertEqual(first.values, [0.6, 0.8])
        self.assertEqual(second.model_name, "fake-model")
        self.assertEqual(len(created_extractors), 1)
        self.assertEqual(len(created_extractors[0].images), 2)

    def test_rejects_empty_or_invalid_image_bytes(self):
        service = ImageEmbeddingService(extractor_factory=FakeExtractor)

        with self.assertRaisesRegex(ValueError, "não pode estar vazia"):
            service.extract_from_bytes(b"")

        with self.assertRaisesRegex(ValueError, "decodificar"):
            service.extract_from_bytes(b"not-an-image")
