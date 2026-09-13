"""Estado de trajetórias associado aos IDs persistentes do ByteTrack."""

from collections import defaultdict, deque
from time import time
from typing import Any


class TrajectoryManager:
    """Mantém pontos normalizados por pet sem descartar o ID em oclusões curtas."""

    def __init__(self, max_points: int = 120, max_idle_seconds: float = 30.0):
        if max_points <= 0:
            raise ValueError("max_points deve ser maior que zero")
        if max_idle_seconds <= 0:
            raise ValueError("max_idle_seconds deve ser maior que zero")

        self.max_idle_seconds = max_idle_seconds
        self._points: dict[int, deque[dict[str, float]]] = defaultdict(
            lambda: deque(maxlen=max_points)
        )
        self._last_seen: dict[int, float] = {}

    def update(
        self, detections: list[dict[str, Any]], timestamp: float | None = None
    ) -> list[dict[str, Any]]:
        """Acrescenta o centróide de cada track e anexa sua trajetória ao evento."""
        now = time() if timestamp is None else timestamp
        self._expire_inactive_tracks(now)
        tracked_detections: list[dict[str, Any]] = []

        for detection in detections:
            enriched = detection.copy()
            track_id = detection.get("track_id")
            centroid = detection.get("centroid")
            if isinstance(track_id, int) and isinstance(centroid, dict):
                point = {"x": float(centroid["x"]), "y": float(centroid["y"])}
                self._points[track_id].append(point)
                self._last_seen[track_id] = now
                enriched["trajectory"] = list(self._points[track_id])
            tracked_detections.append(enriched)

        return tracked_detections

    def _expire_inactive_tracks(self, now: float) -> None:
        expired_ids = [
            track_id
            for track_id, last_seen in self._last_seen.items()
            if now - last_seen > self.max_idle_seconds
        ]
        for track_id in expired_ids:
            self._last_seen.pop(track_id, None)
            self._points.pop(track_id, None)
