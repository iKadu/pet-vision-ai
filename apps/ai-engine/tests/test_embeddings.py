import unittest

import numpy as np
import torch

from core.embeddings import PetEmbeddingExtractor


class FakeModel:
    def eval(self):
        return self

    def to(self, _device):
        return self

    def encode_image(self, _batch):
        return torch.tensor([[3.0, 4.0]])


def fake_preprocess(_image):
    return torch.zeros((3, 224, 224))


class PetEmbeddingExtractorTests(unittest.TestCase):
    def make_extractor(self):
        return PetEmbeddingExtractor(
            model_name="fake-model",
            pretrained_weights="fake-weights",
            expected_dimensions=2,
            device="cpu",
            model=FakeModel(),
            preprocess=fake_preprocess,
        )

    def test_normalizes_embedding_and_keeps_model_metadata(self):
        embedding = self.make_extractor().extract(np.zeros((16, 16, 3), dtype=np.uint8))

        self.assertEqual(embedding.values, [0.6000000238418579, 0.800000011920929])
        self.assertEqual(embedding.dimensions, 2)
        self.assertEqual(embedding.model_name, "fake-model")
        self.assertEqual(embedding.pretrained_weights, "fake-weights")

    def test_rejects_image_without_three_bgr_channels(self):
        with self.assertRaisesRegex(ValueError, "três canais BGR"):
            self.make_extractor().extract(np.zeros((16, 16), dtype=np.uint8))

    def test_rejects_unexpected_embedding_dimensions(self):
        extractor = PetEmbeddingExtractor(
            expected_dimensions=3,
            device="cpu",
            model=FakeModel(),
            preprocess=fake_preprocess,
        )

        with self.assertRaisesRegex(ValueError, "retornou 2 dimensões"):
            extractor.extract(np.zeros((16, 16, 3), dtype=np.uint8))
