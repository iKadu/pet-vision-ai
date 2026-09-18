"""Rotas HTTP internas para geração de embeddings."""

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from core.embedding_service import ImageEmbeddingService


MAX_EMBEDDING_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_EMBEDDING_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class EmbeddingResponse(BaseModel):
    values: list[float]
    dimensions: int
    model_name: str
    pretrained_weights: str
    normalized: bool = True


def create_embedding_router(embedding_service: ImageEmbeddingService) -> APIRouter:
    router = APIRouter()

    @router.post("/embeddings/image", response_model=EmbeddingResponse)
    async def create_image_embedding(request: Request) -> EmbeddingResponse:
        """Gera um embedding a partir de uma imagem enviada pelo servidor web."""
        content_type = request.headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
        if content_type not in ALLOWED_EMBEDDING_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Envie uma imagem JPG, PNG ou WEBP",
            )

        image_bytes = await request.body()
        if len(image_bytes) > MAX_EMBEDDING_IMAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="A imagem deve ter até 5 MB",
            )

        try:
            embedding = embedding_service.extract_from_bytes(image_bytes)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
        except Exception as error:
            print(f"[IA Engine] Falha ao gerar embedding: {error}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="O gerador de embeddings não está disponível",
            ) from error

        return EmbeddingResponse(
            values=embedding.values,
            dimensions=embedding.dimensions,
            model_name=embedding.model_name,
            pretrained_weights=embedding.pretrained_weights,
        )

    return router
