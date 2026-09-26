"""Zonas de risco normalizadas e monitoramento de entrada/saída por track."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Any


@dataclass(frozen=True)
class RiskZone:
    id: str
    name: str
    polygon: tuple[tuple[float, float], ...]


def parse_risk_zones(value: Any) -> list[RiskZone]:
    """Valida a configuração JSON de zonas com coordenadas entre 0 e 1."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("RISK_ZONES deve ser uma lista JSON")

    zones: list[RiskZone] = []
    zone_ids: set[str] = set()
    for raw_zone in value:
        if not isinstance(raw_zone, dict):
            raise ValueError("Cada zona de risco deve ser um objeto")

        zone_id = raw_zone.get("id")
        name = raw_zone.get("name", zone_id)
        raw_polygon = raw_zone.get("polygon")
        if not isinstance(zone_id, str) or not zone_id.strip():
            raise ValueError("Cada zona de risco precisa de um id")
        if zone_id in zone_ids:
            raise ValueError(f"Zona de risco duplicada: {zone_id}")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"A zona {zone_id} precisa de um nome")
        if not isinstance(raw_polygon, list) or len(raw_polygon) < 3:
            raise ValueError(f"A zona {zone_id} precisa de ao menos três pontos")

        polygon: list[tuple[float, float]] = []
        for raw_point in raw_polygon:
            if not isinstance(raw_point, dict):
                raise ValueError(f"Ponto inválido na zona {zone_id}")
            x, y = raw_point.get("x"), raw_point.get("y")
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                raise ValueError(f"Ponto inválido na zona {zone_id}")
            if not isfinite(x) or not isfinite(y) or not 0 <= x <= 1 or not 0 <= y <= 1:
                raise ValueError(f"Os pontos da zona {zone_id} devem estar entre 0 e 1")
            polygon.append((float(x), float(y)))

        zones.append(RiskZone(zone_id, name.strip(), tuple(polygon)))
        zone_ids.add(zone_id)
    return zones


def point_in_polygon(point: tuple[float, float], polygon: tuple[tuple[float, float], ...]) -> bool:
    """Retorna se o ponto está no interior ou na borda de um polígono."""
    x, y = point
    inside = False
    total = len(polygon)
    for index, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(index + 1) % total]
        cross_product = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
        if abs(cross_product) < 1e-9 and min(x1, x2) <= x <= max(x1, x2) and min(y1, y2) <= y <= max(y1, y2):
            return True

        crosses_y = (y1 > y) != (y2 > y)
        if crosses_y:
            intersection_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < intersection_x:
                inside = not inside
    return inside


class RiskZoneMonitor:
    """Detecta mudanças de pertencimento a zonas para cada track persistente."""

    def __init__(self, zones: list[RiskZone]):
        self.zones = zones
        self._active_zone_ids: dict[int, set[str]] = {}

    def update(self, detections: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Anexa zonas ativas às detecções e emite eventos de entrada e saída."""
        enriched_detections: list[dict[str, Any]] = []
        events: list[dict[str, Any]] = []
        zones_by_id = {zone.id: zone for zone in self.zones}

        for detection in detections:
            enriched = detection.copy()
            track_id = detection.get("track_id")
            centroid = detection.get("centroid")
            if not isinstance(track_id, int) or not isinstance(centroid, dict):
                enriched_detections.append(enriched)
                continue

            point = (float(centroid["x"]), float(centroid["y"]))
            active_zone_ids = {
                zone.id for zone in self.zones if point_in_polygon(point, zone.polygon)
            }
            previous_zone_ids = self._active_zone_ids.get(track_id, set())
            self._active_zone_ids[track_id] = active_zone_ids
            enriched["risk_zones"] = [
                {"id": zone.id, "name": zone.name}
                for zone in self.zones
                if zone.id in active_zone_ids
            ]

            for zone_id in active_zone_ids - previous_zone_ids:
                zone = zones_by_id[zone_id]
                events.append(
                    {
                        "event_type": "zone_entered",
                        "track_id": track_id,
                        "zone": {"id": zone.id, "name": zone.name},
                        "centroid": {"x": point[0], "y": point[1]},
                    }
                )
            for zone_id in previous_zone_ids - active_zone_ids:
                zone = zones_by_id[zone_id]
                events.append(
                    {
                        "event_type": "zone_exited",
                        "track_id": track_id,
                        "zone": {"id": zone.id, "name": zone.name},
                        "centroid": {"x": point[0], "y": point[1]},
                    }
                )
            enriched_detections.append(enriched)

        return enriched_detections, events
