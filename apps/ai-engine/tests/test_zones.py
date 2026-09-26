import unittest

from core.zones import RiskZoneMonitor, parse_risk_zones, point_in_polygon


class RiskZoneTests(unittest.TestCase):
    def setUp(self):
        self.zones = parse_risk_zones([
            {
                "id": "sofa",
                "name": "Sofá",
                "polygon": [
                    {"x": 0.1, "y": 0.1},
                    {"x": 0.5, "y": 0.1},
                    {"x": 0.5, "y": 0.5},
                    {"x": 0.1, "y": 0.5},
                ],
            }
        ])

    def test_includes_points_on_the_polygon_edge(self):
        self.assertTrue(point_in_polygon((0.1, 0.3), self.zones[0].polygon))
        self.assertFalse(point_in_polygon((0.8, 0.3), self.zones[0].polygon))

    def test_emits_events_when_a_track_enters_and_exits_a_zone(self):
        monitor = RiskZoneMonitor(self.zones)
        outside, no_events = monitor.update([{"track_id": 7, "centroid": {"x": 0.8, "y": 0.8}}])
        inside, enter_events = monitor.update([{"track_id": 7, "centroid": {"x": 0.2, "y": 0.2}}])
        _, exit_events = monitor.update([{"track_id": 7, "centroid": {"x": 0.8, "y": 0.8}}])

        self.assertEqual(outside[0]["risk_zones"], [])
        self.assertEqual(inside[0]["risk_zones"], [{"id": "sofa", "name": "Sofá"}])
        self.assertEqual(no_events, [])
        self.assertEqual(enter_events[0]["event_type"], "zone_entered")
        self.assertEqual(exit_events[0]["event_type"], "zone_exited")

    def test_rejects_invalid_zone_points(self):
        with self.assertRaises(ValueError):
            parse_risk_zones([
                {
                    "id": "invalid",
                    "polygon": [
                        {"x": 0, "y": 0},
                        {"x": 2, "y": 0},
                        {"x": 0, "y": 1},
                    ],
                }
            ])


if __name__ == "__main__":
    unittest.main()
