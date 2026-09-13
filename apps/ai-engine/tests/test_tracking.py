import unittest

from core.tracking import TrajectoryManager


class TrajectoryManagerTests(unittest.TestCase):
    def test_accumulates_centroids_for_the_same_track(self):
        manager = TrajectoryManager(max_points=3, max_idle_seconds=5)
        first = manager.update([{"track_id": 7, "centroid": {"x": 0.2, "y": 0.3}}], timestamp=10)
        second = manager.update([{"track_id": 7, "centroid": {"x": 0.4, "y": 0.6}}], timestamp=11)

        self.assertEqual(first[0]["trajectory"], [{"x": 0.2, "y": 0.3}])
        self.assertEqual(
            second[0]["trajectory"],
            [{"x": 0.2, "y": 0.3}, {"x": 0.4, "y": 0.6}],
        )

    def test_keeps_history_after_a_short_occlusion_and_expires_after_timeout(self):
        manager = TrajectoryManager(max_idle_seconds=5)
        manager.update([{"track_id": 3, "centroid": {"x": 0.1, "y": 0.1}}], timestamp=10)
        manager.update([], timestamp=14)  # oclusão curta
        resumed = manager.update([{"track_id": 3, "centroid": {"x": 0.2, "y": 0.2}}], timestamp=14.5)
        self.assertEqual(len(resumed[0]["trajectory"]), 2)

        manager.update([], timestamp=20)  # excede a tolerância configurada
        renewed = manager.update([{"track_id": 3, "centroid": {"x": 0.3, "y": 0.3}}], timestamp=20)
        self.assertEqual(renewed[0]["trajectory"], [{"x": 0.3, "y": 0.3}])


if __name__ == "__main__":
    unittest.main()
