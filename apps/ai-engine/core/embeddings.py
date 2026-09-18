"""Extração de embeddings visuais para identificação persistente de Pets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
import torch
from PIL import Image


DEFAULT_MODEL_NAME = "ViT-B-32"
DEFAULT_PRETRAINED_WEIGHTS = "laion2b_s34b_b79k"
DEFAULT_EMBEDDING_DIMENSIONS = 512


@dataclass(frozen=True)
class PetEmbedding:
    """Embedding normalizado acompanhado dos metadados necessários para compará-lo."""

    values: list[float]
    model_name: str
    pretrained_weights: str

    @property
    def dimensions(self) -> int:
        return len(self.values)


def _load_open_clip_model(
    model_name: str,
    pretrained_weights: str,
) -> tuple[Any, Callable[[Image.Image], torch.Tensor]]:
    """Carrega o encoder somente quando não há uma implementação injetada para testes."""
    import open_clip

    model, _, preprocess = open_clip.create_model_and_transforms(
        model_name,
        pretrained=pretrained_weights,
    )
    return model, preprocess


class PetEmbeddingExtractor:
    """Gera vetores L2-normalizados a partir de recortes BGR do OpenCV.

    A normalização é obrigatória para que a comparação por cosseno tenha o mesmo
    comportamento no motor de IA e no pgvector. O recorte deve conter apenas um
    Pet; a responsabilidade por detectar e recortar o animal permanece no YOLO.
    """

    def __init__(
        self,
        *,
        model_name: str = DEFAULT_MODEL_NAME,
        pretrained_weights: str = DEFAULT_PRETRAINED_WEIGHTS,
        expected_dimensions: int = DEFAULT_EMBEDDING_DIMENSIONS,
        device: str | None = None,
        model: Any | None = None,
        preprocess: Callable[[Image.Image], torch.Tensor] | None = None,
    ) -> None:
        if expected_dimensions <= 0:
            raise ValueError("A dimensão esperada do embedding deve ser positiva")

        if model is None or preprocess is None:
            model, preprocess = _load_open_clip_model(model_name, pretrained_weights)

        self.model_name = model_name
        self.pretrained_weights = pretrained_weights
        self.expected_dimensions = expected_dimensions
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = model.eval().to(self.device)
        self.preprocess = preprocess

    def extract(self, bgr_image: np.ndarray) -> PetEmbedding:
        """Converte uma imagem BGR em um embedding pronto para persistência."""
        image = self._to_pil_rgb(bgr_image)
        batch = self.preprocess(image).unsqueeze(0).to(self.device)

        with torch.inference_mode():
            features = self.model.encode_image(batch)

        vector = self._normalize(features)
        if vector.numel() != self.expected_dimensions:
            raise ValueError(
                "O modelo retornou "
                f"{vector.numel()} dimensões; eram esperadas {self.expected_dimensions}"
            )

        return PetEmbedding(
            values=[float(value) for value in vector.cpu().tolist()],
            model_name=self.model_name,
            pretrained_weights=self.pretrained_weights,
        )

    @staticmethod
    def _to_pil_rgb(bgr_image: np.ndarray) -> Image.Image:
        if not isinstance(bgr_image, np.ndarray):
            raise TypeError("A imagem deve ser um array NumPy BGR")
        if bgr_image.ndim != 3 or bgr_image.shape[2] != 3:
            raise ValueError("A imagem deve ter três canais BGR")
        if bgr_image.size == 0:
            raise ValueError("A imagem não pode estar vazia")

        return Image.fromarray(bgr_image[:, :, ::-1].copy(), mode="RGB")

    @staticmethod
    def _normalize(features: torch.Tensor) -> torch.Tensor:
        vector = features.detach().float().reshape(-1)
        if not torch.isfinite(vector).all():
            raise ValueError("O embedding contém valores não finitos")

        norm = torch.linalg.vector_norm(vector)
        if norm.item() == 0:
            raise ValueError("O embedding não pode ter norma zero")
        return vector / norm
