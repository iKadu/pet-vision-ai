from collections.abc import Iterable
from typing import Any


def _track_id_from_box(box: Any) -> int | None:
    """Obtém o identificador do tracker, quando a caixa veio de ``model.track``."""
    track_id = getattr(box, "id", None)
    if track_id is None:
        return None

    try:
        value = track_id[0]
        return int(value.item() if hasattr(value, "item") else value)
    except (IndexError, TypeError, ValueError):
        return None


def calculate_centroid(bbox: dict[str, float]) -> dict[str, float]:
    """Calcula o centro de uma bounding box normalizada."""
    return {
        "x": round(bbox["x"] + bbox["width"] / 2, 6),
        "y": round(bbox["y"] + bbox["height"] / 2, 6),
    }


def intersection_over_union(first: dict[str, float], second: dict[str, float]) -> float:
    """Calcula IoU para caixas normalizadas no formato x, y, width, height."""
    left = max(first["x"], second["x"])
    top = max(first["y"], second["y"])
    right = min(first["x"] + first["width"], second["x"] + second["width"])
    bottom = min(first["y"] + first["height"], second["y"] + second["height"])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    union = first["width"] * first["height"] + second["width"] * second["height"] - intersection
    return intersection / union if union > 0 else 0.0


def suppress_overlapping_detections(
    detections: list[dict[str, Any]], iou_threshold: float = 0.7
) -> list[dict[str, Any]]:
    """Mantém a caixa mais confiante quando a mesma espécie é detectada duas vezes."""
    if not 0 < iou_threshold <= 1:
        raise ValueError("O limiar de IoU deve estar entre 0 e 1")

    kept: list[dict[str, Any]] = []
    for detection in sorted(detections, key=lambda item: item["confidence"], reverse=True):
        duplicated = any(
            detection["class_id"] == kept_detection["class_id"]
            and intersection_over_union(detection["bbox"], kept_detection["bbox"]) >= iou_threshold
            for kept_detection in kept
        )
        if not duplicated:
            kept.append(detection)
    return kept


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

        bbox = {
            "x": round(left / frame_width, 6),
            "y": round(top / frame_height, 6),
            "width": round((right - left) / frame_width, 6),
            "height": round((bottom - top) / frame_height, 6),
        }
        detection: dict[str, Any] = {
            "class_id": class_id,
            "class_name": class_names.get(class_id, str(class_id)),
            "confidence": round(float(box.conf[0].item()), 4),
            "bbox": bbox,
            "centroid": calculate_centroid(bbox),
        }
        track_id = _track_id_from_box(box)
        if track_id is not None:
            detection["track_id"] = track_id
        detections.append(detection)

    return detections
