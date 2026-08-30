from collections.abc import Iterable
from typing import Any


def normalize_detections(
    boxes: Iterable[Any], frame_width: int, frame_height: int, class_names: dict[int, str]
) -> list[dict[str, Any]]:
    """Converte caixas ``xyxy`` em coordenadas relativas ao tamanho do frame.

    O contrato usa o canto superior esquerdo (``x``, ``y``) e dimensões
    (``width``, ``height``), todos no intervalo de 0 a 1. Isso permite que o
    consumidor desenhe a caixa em streams com qualquer resolução.
    """
    if frame_width <= 0 or frame_height <= 0:
        raise ValueError("O frame precisa ter largura e altura positivas")

    detections: list[dict[str, Any]] = []
    for box in boxes:
        x1, y1, x2, y2 = (float(value) for value in box.xyxy[0].tolist())
        left = min(max(x1, 0.0), float(frame_width))
        top = min(max(y1, 0.0), float(frame_height))
        right = min(max(x2, left), float(frame_width))
        bottom = min(max(y2, top), float(frame_height))
        class_id = int(box.cls[0].item())

        detections.append(
            {
                "class_id": class_id,
                "class_name": class_names.get(class_id, str(class_id)),
                "confidence": round(float(box.conf[0].item()), 4),
                "bbox": {
                    "x": round(left / frame_width, 6),
                    "y": round(top / frame_height, 6),
                    "width": round((right - left) / frame_width, 6),
                    "height": round((bottom - top) / frame_height, 6),
                },
            }
        )

    return detections
