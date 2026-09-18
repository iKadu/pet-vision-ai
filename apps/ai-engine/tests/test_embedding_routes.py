import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.embedding_routes import MAX_EMBEDDING_IMAGE_SIZE, create_embedding_router
from core.embeddings import PetEmbedding


class FakeEmbeddingService:
    def __init__(self):
        self.received_image = None

    def extract_from_bytes(self, image_bytes):
        self.received_image = image_bytes
        return PetEmbedding(
            values=[0.6, 0.8],
            model_name="fake-model",
            pretrained_weights="fake-weights",
        )


class EmbeddingRoutesTests(unittest.TestCase):
    def setUp(self):
        self.embedding_service = FakeEmbeddingService()
        app = FastAPI()
        app.include_router(create_embedding_router(self.embedding_service))
        self.client = TestClient(app)

    def test_returns_embedding_metadata_for_supported_image_type(self):
        response = self.client.post(
            "/embeddings/image",
            content=b"encoded-image",
            headers={"content-type": "image/jpeg"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["values"], [0.6, 0.8])
        self.assertEqual(response.json()["dimensions"], 2)
        self.assertTrue(response.json()["normalized"])
        self.assertEqual(self.embedding_service.received_image, b"encoded-image")

    def test_rejects_unsupported_content_type(self):
        response = self.client.post(
            "/embeddings/image",
            content=b"encoded-image",
            headers={"content-type": "application/pdf"},
        )

        self.assertEqual(response.status_code, 415)

    def test_rejects_payload_larger_than_five_megabytes(self):
        response = self.client.post(
            "/embeddings/image",
            content=b"a" * (MAX_EMBEDDING_IMAGE_SIZE + 1),
            headers={"content-type": "image/png"},
        )

        self.assertEqual(response.status_code, 413)
