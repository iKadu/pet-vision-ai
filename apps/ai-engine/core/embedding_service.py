"""Serviço de conversão de imagens codificadas em embeddings de Pets."""

from __future__ import annotations

from collections.abc import Callable

import cv2
import numpy as np

from core.embeddings import PetEmbedding, PetEmbeddingExtractor


class ImageEmbeddingService:
    """Mantém o extrator em memória e decodifica imagens recebidas pela API."""

    def __init__(
        self,
        extractor_factory: Callable[[], PetEmbeddingExtractor] = PetEmbeddingExtractor,
    ) -> None:
        self._extractor_factory = extractor_factory
        self._extractor: PetEmbeddingExtractor | None = None

    def extract_from_bytes(self, image_bytes: bytes) -> PetEmbedding:
        if not image_bytes:
            raise ValueError("A imagem não pode estar vazia")

        encoded_image = np.frombuffer(image_bytes, dtype=np.uint8)
        bgr_image = cv2.imdecode(encoded_image, cv2.IMREAD_COLOR)
        if bgr_image is None:
            raise ValueError("Não foi possível decodificar a imagem enviada")

        return self.extract_from_bgr(bgr_image)

    def extract_from_bgr(self, bgr_image: np.ndarray) -> PetEmbedding:
        """Gera o embedding de um recorte BGR já disponível no pipeline de vídeo."""
        return self._get_extractor().extract(bgr_image)

    def _get_extractor(self) -> PetEmbeddingExtractor:
        if self._extractor is None:
            self._extractor = self._extractor_factory()
        return self._extractor
