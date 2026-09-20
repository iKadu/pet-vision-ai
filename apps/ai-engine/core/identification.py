"""Cache e intervalo de consultas de identificação por track do ByteTrack."""

from __future__ import annotations

from time import time
from typing import Any


class TrackIdentificationManager:
    """Evita extrair e consultar embeddings a cada frame para o mesmo animal."""

    def __init__(self, min_interval_seconds: float = 3.0, max_idle_seconds: float = 30.0):
        if min_interval_seconds <= 0:
            raise ValueError("min_interval_seconds deve ser maior que zero")
        if max_idle_seconds <= 0:
            raise ValueError("max_idle_seconds deve ser maior que zero")

        self.min_interval_seconds = min_interval_seconds
        self.max_idle_seconds = max_idle_seconds
        self._last_requested: dict[int, float] = {}
        self._last_seen: dict[int, float] = {}
        self._identifications: dict[int, dict[str, Any]] = {}
        self._pending_replacements: dict[int, dict[str, Any]] = {}

    def is_due(self, track_id: int, timestamp: float | None = None) -> bool:
        now = time() if timestamp is None else timestamp
        self._expire_inactive_tracks(now)
        self._last_seen[track_id] = now
        last_requested = self._last_requested.get(track_id)
        return last_requested is None or now - last_requested >= self.min_interval_seconds

    def mark_requested(self, track_id: int, timestamp: float | None = None) -> None:
        now = time() if timestamp is None else timestamp
        self._last_requested[track_id] = now
        self._last_seen[track_id] = now

    def apply_matches(
        self, matches: list[dict[str, Any]], timestamp: float | None = None
    ) -> list[dict[str, Any]]:
        now = time() if timestamp is None else timestamp
        self._expire_inactive_tracks(now)
        new_identifications: list[dict[str, Any]] = []

        for item in matches:
            track_id = item.get("track_id")
            if not isinstance(track_id, int):
                continue

            self._last_seen[track_id] = now
            match = item.get("match")
            previous = self._identifications.get(track_id)
            if isinstance(match, dict):
                # Um track normalmente representa o mesmo animal durante sua vida.
                # Se uma leitura isolada apontar para outro pet, conservamos a
                # associação já exibida até que a nova hipótese seja repetida.
                # Isso impede que o nome no overlay alterne por ruído do embedding.
                if (
                    previous is not None
                    and previous.get("status") == "identified"
                    and previous.get("pet_id") != match.get("petId")
                ):
                    pending = self._pending_replacements.get(track_id)
                    if pending and pending.get("pet_id") == match.get("petId"):
                        pending["count"] += 1
                    else:
                        self._pending_replacements[track_id] = {
                            "pet_id": match.get("petId"),
                            "count": 1,
                        }

                    if self._pending_replacements[track_id]["count"] < 2:
                        continue

                self._pending_replacements.pop(track_id, None)
                self._identifications[track_id] = {
                    "status": "identified",
                    "pet_id": match.get("petId"),
                    "pet_name": match.get("petName"),
                    "similarity": match.get("similarity"),
                    "updated_at": now,
                }
                if (
                    previous is None
                    or previous.get("status") != "identified"
                    or previous.get("pet_id") != match.get("petId")
                ):
                    new_identifications.append({"track_id": track_id, "match": match})
            elif previous is None:
                self._pending_replacements.pop(track_id, None)
                self._identifications[track_id] = {
                    "status": "unknown",
                    "updated_at": now,
                }

        return new_identifications

    def enrich_detections(
        self, detections: list[dict[str, Any]], timestamp: float | None = None
    ) -> list[dict[str, Any]]:
        now = time() if timestamp is None else timestamp
        self._expire_inactive_tracks(now)
        enriched_detections: list[dict[str, Any]] = []

        for detection in detections:
            enriched = detection.copy()
            track_id = detection.get("track_id")
            if isinstance(track_id, int):
                self._last_seen[track_id] = now
                identification = self._identifications.get(track_id)
                if identification:
                    enriched["identification"] = identification.copy()
            enriched_detections.append(enriched)

        return enriched_detections

    def _expire_inactive_tracks(self, now: float) -> None:
        expired_ids = [
            track_id
            for track_id, last_seen in self._last_seen.items()
            if now - last_seen > self.max_idle_seconds
        ]
        for track_id in expired_ids:
            self._last_seen.pop(track_id, None)
            self._last_requested.pop(track_id, None)
            self._identifications.pop(track_id, None)
            self._pending_replacements.pop(track_id, None)
