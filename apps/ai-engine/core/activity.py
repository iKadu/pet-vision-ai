"""Classificação de atividade a partir da trajetória normalizada de cada track."""

from __future__ import annotations

from collections import defaultdict, deque
from math import hypot
from time import time
from typing import Any


class ActivityClassifier:
    """Classifica um track como ativo ou em repouso em uma janela móvel.

    As coordenadas recebidas já são normalizadas para o frame (0 a 1). Por isso,
    ``active_distance_threshold`` independe da resolução da câmera.
    """

    def __init__(
        self,
        window_seconds: float = 10.0,
        active_distance_threshold: float = 0.08,
        max_idle_seconds: float = 30.0,
    ):
        if window_seconds <= 0:
            raise ValueError("ACTIVITY_WINDOW_SECONDS deve ser maior que zero")
        if active_distance_threshold < 0:
            raise ValueError("ACTIVITY_ACTIVE_DISTANCE_THRESHOLD não pode ser negativo")
        if max_idle_seconds <= 0:
            raise ValueError("TRACK_MAX_IDLE_SECONDS deve ser maior que zero")

        self.window_seconds = window_seconds
        self.active_distance_threshold = active_distance_threshold
        self.max_idle_seconds = max_idle_seconds
        self._points: dict[int, deque[tuple[float, float, float]]] = defaultdict(deque)
        self._last_seen: dict[int, float] = {}
        self._states: dict[int, str] = {}

    def update(
        self, detections: list[dict[str, Any]], timestamp: float | None = None
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Anexa atividade a cada detecção e emite somente mudanças de estado."""
        now = time() if timestamp is None else timestamp
        self._expire_inactive_tracks(now)
        enriched_detections: list[dict[str, Any]] = []
        events: list[dict[str, Any]] = []

        for detection in detections:
            enriched = detection.copy()
            track_id = detection.get("track_id")
            centroid = detection.get("centroid")
            if not isinstance(track_id, int) or not isinstance(centroid, dict):
                enriched_detections.append(enriched)
                continue

            point = (now, float(centroid["x"]), float(centroid["y"]))
            points = self._points[track_id]
            points.append(point)
            cutoff = now - self.window_seconds
            while len(points) > 1 and points[0][0] < cutoff:
                points.popleft()
            self._last_seen[track_id] = now

            activity = self._activity_for_points(points)
            enriched["activity"] = activity
            state = activity["state"]
            previous_state = self._states.get(track_id)
            self._states[track_id] = state
            if state != "unknown" and previous_state not in (None, "unknown", state):
                events.append(
                    {
                        "event_type": "activity_changed",
                        "track_id": track_id,
                        "activity": activity,
                        "centroid": {"x": point[1], "y": point[2]},
                    }
                )
            enriched_detections.append(enriched)

        return enriched_detections, events

    def _activity_for_points(self, points: deque[tuple[float, float, float]]) -> dict[str, Any]:
        if len(points) < 2:
            return {
                "state": "unknown",
                "movement_distance": 0.0,
                "window_seconds": 0.0,
                "samples": len(points),
            }

        movement_distance = sum(
            hypot(current[1] - previous[1], current[2] - previous[2])
            for previous, current in zip(points, list(points)[1:])
        )
        elapsed = max(0.0, points[-1][0] - points[0][0])
        state = "active" if movement_distance >= self.active_distance_threshold else "resting"
        return {
            "state": state,
            "movement_distance": round(movement_distance, 6),
            "window_seconds": round(elapsed, 3),
            "samples": len(points),
        }

    def _expire_inactive_tracks(self, now: float) -> None:
        expired_ids = [
            track_id
            for track_id, last_seen in self._last_seen.items()
            if now - last_seen > self.max_idle_seconds
        ]
        for track_id in expired_ids:
            self._last_seen.pop(track_id, None)
            self._points.pop(track_id, None)
            self._states.pop(track_id, None)
